// Admin → Tickets: the list of every ticket of one kind.
import express from 'express'
import db from '../../db/index.js'

const router = express.Router()

// Every dry cleaning or service wash ticket for Admin → Tickets, newest first, with the names
// of the workers who made, collected and cancelled it. e.g. /api/admin/tickets?kind=dryCleaning
// The daily totals imported from the old spreadsheet are left out.
router.get('/api/admin/tickets', (req, res) => {
  const table = req.query.kind === 'serviceWash' ? 'service_wash_tickets' : 'dry_cleaning_tickets'
  const tickets = db
    .prepare(`
      SELECT t.*, made.name AS made_by, payer.name AS paid_by_name,
             collector.name AS collected_by_name, canceller.name AS cancelled_by_name
      FROM ${table} t
      LEFT JOIN staff made ON made.id = t.staff_id
      LEFT JOIN staff payer ON payer.id = t.paid_by
      LEFT JOIN staff collector ON collector.id = t.collected_by
      LEFT JOIN staff canceller ON canceller.id = t.cancelled_by
      WHERE t.imported = 0
      ORDER BY t.created_at DESC, t.id DESC
    `)
    .all()
  res.json(tickets)
})

export default router
