// Admin → Customers: every customer, each one's profile and order history, and a note about them.
// Customers are worked out from the tickets (see lib/customers.js).
import express from 'express'
import { listCustomers, getCustomer, saveNote } from '../../lib/customers.js'
import { loyaltyStatus } from '../../lib/loyalty.js'

const router = express.Router()

// GET /api/admin/customers?q=sarah → [{ key, name, phone, visits, spent, owed, in_shop, last_visit, note }]
router.get('/api/admin/customers', (req, res) => {
  res.json(listCustomers(String(req.query.q || '')))
})

// GET /api/admin/customers/p:07700900123 → the profile and every ticket, newest first
router.get('/api/admin/customers/:key', (req, res) => {
  const customer = getCustomer(req.params.key)
  if (!customer) return res.status(404).json({ error: 'Customer not found' })
  // Where they stand with each loyalty reward (see lib/loyalty.js)
  const loyalty = Object.fromEntries(
    ['dryCleaning', 'serviceWash'].map((kind) => [kind, loyaltyStatus(kind, customer.name, customer.phone || '0')]),
  )
  res.json({ ...customer, loyalty })
})

// PUT /api/admin/customers/p:07700900123/note { note: "No starch" } → { note }
router.put('/api/admin/customers/:key/note', (req, res) => {
  if (!getCustomer(req.params.key)) return res.status(404).json({ error: 'Customer not found' })
  const note = String(req.body?.note ?? '')
  if (note.length > 1000) return res.status(400).json({ error: 'The note is too long (1000 letters at most)' })
  res.json({ note: saveNote(req.params.key, note) })
})

export default router
