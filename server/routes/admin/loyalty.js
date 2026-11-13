// Loyalty rewards: the rules set in Admin → Loyalty rewards, and the till's check of whether
// a customer's new ticket gets one. See lib/loyalty.js.
import express from 'express'
import { getRules, saveRule, loyaltyStatus, KINDS } from '../../lib/loyalty.js'
import { logEdit } from '../../lib/editHistory.js'

const router = express.Router()

// 2 → "2nd", 10 → "10th"
const ordinal = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : { 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th')

// GET /api/admin/loyalty → { dryCleaning: { every, percent, active } | null, serviceWash: ... }
router.get('/api/admin/loyalty', (req, res) => {
  res.json(getRules())
})

// PUT /api/admin/loyalty/dryCleaning { every: 10, percent: 20, active: true }
router.put('/api/admin/loyalty/:kind', (req, res) => {
  const { every, percent, active } = req.body || {}
  const result = saveRule(req.params.kind, { every: Number(every), percent: Number(percent), active })
  if (result.error) return res.status(400).json({ error: result.error })
  const label = KINDS[req.params.kind].label
  logEdit({
    action: 'Loyalty reward changed',
    details: `${label[0].toUpperCase() + label.slice(1)}: every ${ordinal(result.rule.every)} ticket ${result.rule.percent}% off${result.rule.active ? '' : ' (switched off)'}`,
    byAdmin: true,
  })
  res.json(result.rule)
})

// For the till's new ticket form (open to the till, like the customer suggestions):
// GET /api/loyalty/status?kind=dryCleaning&name=Sarah&phone=07700900123
router.get('/api/loyalty/status', (req, res) => {
  const kind = String(req.query.kind || '')
  if (!KINDS[kind]) return res.status(400).json({ error: 'Unknown kind of ticket' })
  const name = String(req.query.name || '').trim()
  const phone = String(req.query.phone || '').trim()
  if (!name || !phone) return res.json({ active: false })
  res.json(loyaltyStatus(kind, name, phone))
})

export default router
