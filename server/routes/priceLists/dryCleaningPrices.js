// The dry cleaning price list: the till reads it; Admin → Price list adds, edits and removes items.
// Every admin change is written to the edit history.
import express from 'express'
import db from '../../db/index.js'
import { logEdit } from '../../lib/editHistory.js'
import { CATEGORIES } from '../../db/defaultPriceList.js'
import { priceText } from './priceText.js'

const router = express.Router()

// Item names are kept in small letters without dashes, e.g. "2-Piece Suit" becomes "2piece suit",
// so they are easy to search
const tidyName = (name) => String(name).trim().replace(/[-–]/g, '').toLowerCase()

// Items in group order, then in the order they were added
const ORDER = `CASE category ${CATEGORIES.map((c, i) => `WHEN '${c.replace(/'/g, "''")}' THEN ${i}`).join(' ')} ELSE 99 END, id`

// The price list for the till (only items still offered)
router.get('/api/price-list', (req, res) => {
  res.json({
    categories: CATEGORIES,
    items: db.prepare(`SELECT * FROM price_list WHERE active = 1 ORDER BY ${ORDER}`).all(),
  })
})

// Every item, including removed ones, for Admin → Price list
router.get('/api/admin/price-list', (req, res) => {
  res.json({
    categories: CATEGORIES,
    items: db.prepare(`SELECT * FROM price_list ORDER BY ${ORDER}`).all(),
  })
})

// Checks an item sent by the admin. Returns an error message, or null if it's fine.
function checkItem({ category, name, clean_min, clean_max, press_min, press_max }) {
  if (!CATEGORIES.includes(category)) return 'Please choose a group'
  if (!String(name || '').trim()) return 'Please enter the item name'
  for (const value of [clean_min, clean_max, press_min, press_max]) {
    if (typeof value !== 'number' || value < 0 || Math.round(value * 100) / 100 !== value) {
      return 'Prices must be £0 or more, with up to 2 decimals'
    }
  }
  if (clean_max < clean_min || press_max < press_min) return 'The highest price must not be below the lowest'
  return null
}

// Add an item: { category, name, clean_min, clean_max, press_min, press_max }
router.post('/api/admin/price-list', (req, res) => {
  const error = checkItem(req.body)
  if (error) return res.status(400).json({ error })
  const { category, name, clean_min, clean_max, press_min, press_max } = req.body
  const result = db
    .prepare(
      'INSERT INTO price_list (category, name, clean_min, clean_max, press_min, press_max) VALUES (?, ?, ?, ?, ?, ?)',
    )
    .run(category, tidyName(name), clean_min, clean_max, press_min, press_max)
  logEdit({
    action: 'Price list item added',
    details: `${tidyName(name)}: dry clean ${priceText(clean_min, clean_max)}, press ${priceText(press_min, press_max)}`,
    byAdmin: true,
  })
  res.status(201).json(db.prepare('SELECT * FROM price_list WHERE id = ?').get(result.lastInsertRowid))
})

// Change an item's name, group or prices (send all the fields)
router.put('/api/admin/price-list/:id', (req, res) => {
  const before = db.prepare('SELECT * FROM price_list WHERE id = ?').get(req.params.id)
  if (!before) return res.status(404).json({ error: 'That item does not exist' })
  const error = checkItem(req.body)
  if (error) return res.status(400).json({ error })
  const { category, name, clean_min, clean_max, press_min, press_max } = req.body
  db.prepare(
    'UPDATE price_list SET category = ?, name = ?, clean_min = ?, clean_max = ?, press_min = ?, press_max = ? WHERE id = ?',
  ).run(category, tidyName(name), clean_min, clean_max, press_min, press_max, before.id)

  // Say exactly what changed, e.g. "Shirt: dry clean £3.50 → £4.00"
  const changes = []
  if (before.name !== tidyName(name)) changes.push(`renamed from "${before.name}"`)
  if (before.category !== category) changes.push(`moved from ${before.category} to ${category}`)
  const oldClean = priceText(before.clean_min, before.clean_max)
  const newClean = priceText(clean_min, clean_max)
  if (oldClean !== newClean) changes.push(`dry clean ${oldClean} → ${newClean}`)
  const oldPress = priceText(before.press_min, before.press_max)
  const newPress = priceText(press_min, press_max)
  if (oldPress !== newPress) changes.push(`press ${oldPress} → ${newPress}`)
  if (changes.length > 0) {
    logEdit({
      action: 'Price list item changed',
      details: `${tidyName(name)}: ${changes.join(', ')}`,
      byAdmin: true,
    })
  }
  res.json(db.prepare('SELECT * FROM price_list WHERE id = ?').get(before.id))
})

// Remove an item from the till (old tickets keep it), or bring it back
router.delete('/api/admin/price-list/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM price_list WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'That item does not exist' })
  db.prepare('UPDATE price_list SET active = 0 WHERE id = ?').run(item.id)
  logEdit({
    action: 'Price list item removed',
    details: item.name,
    byAdmin: true,
  })
  res.json({ removed: true })
})

router.post('/api/admin/price-list/:id/restore', (req, res) => {
  const item = db.prepare('SELECT * FROM price_list WHERE id = ?').get(req.params.id)
  if (!item) return res.status(404).json({ error: 'That item does not exist' })
  db.prepare('UPDATE price_list SET active = 1 WHERE id = ?').run(item.id)
  logEdit({
    action: 'Price list item brought back',
    details: item.name,
    byAdmin: true,
  })
  res.json({ restored: true })
})

export default router
