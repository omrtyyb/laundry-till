// The service wash load sizes and their price ranges: the till reads them; Admin → Price list
// adds, edits and removes them. Every admin change is written to the edit history.
import express from 'express'
import db from '../../db/index.js'
import { logEdit } from '../../lib/editHistory.js'
import { priceText } from './priceText.js'

const router = express.Router()

// The load sizes for the till (only ones still offered)
router.get('/api/service-wash-prices', (req, res) => {
  res.json(db.prepare('SELECT * FROM service_wash_prices WHERE active = 1 ORDER BY price_min, id').all())
})

// Every load size, including removed ones, for Admin → Price list
router.get('/api/admin/service-wash-prices', (req, res) => {
  res.json(db.prepare('SELECT * FROM service_wash_prices ORDER BY price_min, id').all())
})

// Checks a load size sent by the admin. Returns an error message, or null if it's fine.
function checkLoadSize({ name, price_min, price_max }) {
  if (!String(name || '').trim()) return 'Please enter the load size name'
  for (const value of [price_min, price_max]) {
    if (typeof value !== 'number' || value < 0 || Math.round(value * 100) / 100 !== value) {
      return 'Prices must be £0 or more, with up to 2 decimals'
    }
  }
  if (price_max < price_min) return 'The highest price must not be below the lowest'
  return null
}

// Add a load size: { name, price_min, price_max }
router.post('/api/admin/service-wash-prices', (req, res) => {
  const error = checkLoadSize(req.body)
  if (error) return res.status(400).json({ error })
  const name = String(req.body.name).trim()
  const result = db
    .prepare('INSERT INTO service_wash_prices (name, price_min, price_max) VALUES (?, ?, ?)')
    .run(name, req.body.price_min, req.body.price_max)
  logEdit({
    action: 'Service wash price added',
    details: `${name}: ${priceText(req.body.price_min, req.body.price_max)}`,
    byAdmin: true,
  })
  res.status(201).json(db.prepare('SELECT * FROM service_wash_prices WHERE id = ?').get(result.lastInsertRowid))
})

// Change a load size's name or prices (send all the fields)
router.put('/api/admin/service-wash-prices/:id', (req, res) => {
  const before = db.prepare('SELECT * FROM service_wash_prices WHERE id = ?').get(req.params.id)
  if (!before) return res.status(404).json({ error: 'That load size does not exist' })
  const error = checkLoadSize(req.body)
  if (error) return res.status(400).json({ error })
  const name = String(req.body.name).trim()
  db.prepare('UPDATE service_wash_prices SET name = ?, price_min = ?, price_max = ? WHERE id = ?').run(
    name,
    req.body.price_min,
    req.body.price_max,
    before.id,
  )
  const changes = []
  if (before.name !== name) changes.push(`renamed from "${before.name}"`)
  const oldPrice = priceText(before.price_min, before.price_max)
  const newPrice = priceText(req.body.price_min, req.body.price_max)
  if (oldPrice !== newPrice) changes.push(`${oldPrice} → ${newPrice}`)
  if (changes.length > 0) {
    logEdit({ action: 'Service wash price changed', details: `${name}: ${changes.join(', ')}`, byAdmin: true })
  }
  res.json(db.prepare('SELECT * FROM service_wash_prices WHERE id = ?').get(before.id))
})

// Remove a load size from the till (old tickets keep it), or bring it back
router.delete('/api/admin/service-wash-prices/:id', (req, res) => {
  const size = db.prepare('SELECT * FROM service_wash_prices WHERE id = ?').get(req.params.id)
  if (!size) return res.status(404).json({ error: 'That load size does not exist' })
  db.prepare('UPDATE service_wash_prices SET active = 0 WHERE id = ?').run(size.id)
  logEdit({ action: 'Service wash price removed', details: size.name, byAdmin: true })
  res.json({ removed: true })
})

router.post('/api/admin/service-wash-prices/:id/restore', (req, res) => {
  const size = db.prepare('SELECT * FROM service_wash_prices WHERE id = ?').get(req.params.id)
  if (!size) return res.status(404).json({ error: 'That load size does not exist' })
  db.prepare('UPDATE service_wash_prices SET active = 1 WHERE id = ?').run(size.id)
  logEdit({ action: 'Service wash price brought back', details: size.name, byAdmin: true })
  res.json({ restored: true })
})

export default router
