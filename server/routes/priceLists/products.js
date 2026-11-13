// The products sold with the till's "Sell Soap & Softener" button (soap, softener, bags...):
// Admin → Products adds, edits and removes them. Removed products disappear from the till
// but old sales keep their name and price. Every change is written to the edit history.
import express from 'express'
import db from '../../db/index.js'
import { logEdit } from '../../lib/editHistory.js'
import { pounds } from '../../lib/money.js'

const router = express.Router()

// Every product, including removed ones, for Admin → Products
router.get('/api/admin/products', (req, res) => {
  res.json(db.prepare('SELECT * FROM products ORDER BY active DESC, id').all())
})

// Checks a product sent by the admin. Returns an error message, or null if it's fine.
function checkProduct({ name, price }) {
  if (!String(name || '').trim()) return 'Please enter the product name'
  if (String(name).trim().length > 40) return 'The name can be at most 40 letters'
  if (typeof price !== 'number' || !(price >= 0) || Math.round(price * 100) / 100 !== price) {
    return 'The price must be £0 or more, with up to 2 decimals'
  }
  return null
}

// Another product with this name (any case), other than the one with id
const sameName = (name, id = -1) =>
  db.prepare('SELECT * FROM products WHERE lower(name) = lower(?) AND id <> ?').get(name, id)

// Add a product: { name, price }. A removed product with the same name is brought back
// with the new price instead.
router.post('/api/admin/products', (req, res) => {
  const error = checkProduct(req.body)
  if (error) return res.status(400).json({ error })
  const name = String(req.body.name).trim()
  const existing = sameName(name)
  if (existing?.active) return res.status(409).json({ error: `${existing.name} is already on the list` })
  let id
  if (existing) {
    db.prepare('UPDATE products SET active = 1, price = ? WHERE id = ?').run(req.body.price, existing.id)
    id = existing.id
  } else {
    id = db.prepare('INSERT INTO products (name, price) VALUES (?, ?)').run(name, req.body.price).lastInsertRowid
  }
  logEdit({ action: 'Product added', details: `${name}: ${pounds(req.body.price)}`, byAdmin: true })
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(id))
})

// Change a product's name or price (send both)
router.put('/api/admin/products/:id', (req, res) => {
  const before = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!before) return res.status(404).json({ error: 'That product does not exist' })
  const error = checkProduct(req.body)
  if (error) return res.status(400).json({ error })
  const name = String(req.body.name).trim()
  if (sameName(name, before.id)) return res.status(409).json({ error: `There is already a product called ${name}` })
  db.prepare('UPDATE products SET name = ?, price = ? WHERE id = ?').run(name, req.body.price, before.id)
  const changes = []
  if (before.name !== name) changes.push(`renamed from "${before.name}"`)
  if (before.price !== req.body.price) changes.push(`${pounds(before.price)} → ${pounds(req.body.price)}`)
  if (changes.length > 0) logEdit({ action: 'Product changed', details: `${name}: ${changes.join(', ')}`, byAdmin: true })
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(before.id))
})

// Remove a product from the till (old sales keep it)
router.delete('/api/admin/products/:id', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ error: 'That product does not exist' })
  db.prepare('UPDATE products SET active = 0 WHERE id = ?').run(product.id)
  logEdit({ action: 'Product removed', details: product.name, byAdmin: true })
  res.json({ removed: true })
})

// Bring a removed product back onto the till
router.post('/api/admin/products/:id/restore', (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)
  if (!product) return res.status(404).json({ error: 'That product does not exist' })
  db.prepare('UPDATE products SET active = 1 WHERE id = ?').run(product.id)
  logEdit({ action: 'Product brought back', details: product.name, byAdmin: true })
  res.json({ restored: true })
})

export default router
