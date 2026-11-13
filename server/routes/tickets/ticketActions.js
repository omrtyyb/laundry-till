// What the till does with an existing ticket: look it up, mark it paid, mark it collected
// (and paid, if it wasn't), or cancel it. The same routes are made for both kinds of ticket.
import express from 'express'
import db from '../../db/index.js'
import { today } from '../../lib/dates.js'
import { logEdit } from '../../lib/editHistory.js'
import { refreshTakings } from '../../lib/takings.js'
import { requireStaff } from '../../auth/staffAuth.js'
import { TICKET_TABLES } from '../../tickets/ticketKinds.js'
import { ticketWithNames } from '../../tickets/ticketDetails.js'

const router = express.Router()

for (const [urlName, table] of Object.entries(TICKET_TABLES)) {
  // e.g. GET /api/dry-cleaning-tickets/12 sends back ticket number 12
  router.get(`/api/${urlName}/:id`, (req, res) => {
    const ticket = ticketWithNames(table, req.params.id)
    if (!ticket) {
      return res.status(404).json({ error: `There is no ticket number ${req.params.id}` })
    }
    res.json(ticket)
  })

  // e.g. POST /api/dry-cleaning-tickets/12/collect marks ticket 12 as collected.
  // If it wasn't paid yet, it is paid now too, and the money counts on today's total.
  router.post(`/api/${urlName}/:id/collect`, requireStaff, (req, res) => {
    const ticket = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id)
    if (!ticket) {
      return res.status(404).json({ error: `There is no ticket number ${req.params.id}` })
    }
    if (ticket.cancelled === 1) {
      return res.status(409).json({ error: `Ticket number ${ticket.id} was cancelled` })
    }
    if (ticket.collected === 1) {
      return res.status(409).json({
        error: `Ticket number ${ticket.id} has already been collected`,
      })
    }

    db.prepare(
      `
      UPDATE ${table}
      SET collected = 1,
          collected_at = datetime('now', 'localtime'),
          paid_at = CASE WHEN paid = 1 THEN paid_at ELSE datetime('now', 'localtime') END,
          paid_by = CASE WHEN paid = 1 THEN paid_by ELSE @staffId END,
          paid = 1,
          collected_by = @staffId
      WHERE id = @id
    `,
    ).run({ staffId: req.staffId, id: ticket.id })
    refreshTakings(today()) // keep today's saved card/cash totals up to date
    res.json(ticketWithNames(table, ticket.id))
  })

  // e.g. POST /api/dry-cleaning-tickets/12/ready { slot: "14" } marks ticket 12 as ready to
  // collect, hanging in slot 14 (the slot can be left empty). Doing it again changes the slot
  // and keeps the time it first became ready.
  router.post(`/api/${urlName}/:id/ready`, requireStaff, (req, res) => {
    const ticket = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id)
    if (!ticket) {
      return res.status(404).json({ error: `There is no ticket number ${req.params.id}` })
    }
    if (ticket.cancelled === 1) {
      return res.status(409).json({ error: `Ticket number ${ticket.id} was cancelled` })
    }
    if (ticket.collected === 1) {
      return res.status(409).json({ error: `Ticket number ${ticket.id} has already been collected` })
    }
    const slot = String(req.body?.slot ?? '').trim()
    if (slot.length > 20) {
      return res.status(400).json({ error: 'The rack or slot can be at most 20 letters' })
    }
    db.prepare(
      `UPDATE ${table} SET ready_at = COALESCE(ready_at, datetime('now', 'localtime')), rack_slot = ? WHERE id = ?`,
    ).run(slot || null, ticket.id)
    res.json(ticketWithNames(table, ticket.id))
  })

  // e.g. POST /api/dry-cleaning-tickets/12/pay marks ticket 12 as paid, but not collected:
  // the customer pays now and picks it up later. The money counts on today's total.
  router.post(`/api/${urlName}/:id/pay`, requireStaff, (req, res) => {
    const ticket = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id)
    if (!ticket) {
      return res.status(404).json({ error: `There is no ticket number ${req.params.id}` })
    }
    if (ticket.cancelled === 1) {
      return res.status(409).json({ error: `Ticket number ${ticket.id} was cancelled` })
    }
    if (ticket.paid === 1) {
      return res.status(409).json({ error: `Ticket number ${ticket.id} has already been paid` })
    }

    db.prepare(
      `UPDATE ${table} SET paid = 1, paid_at = datetime('now', 'localtime'), paid_by = ? WHERE id = ?`,
    ).run(req.staffId, ticket.id)
    refreshTakings(today()) // keep today's saved card/cash totals up to date
    res.json(ticketWithNames(table, ticket.id))
  })

  // e.g. POST /api/dry-cleaning-tickets/12/cancel cancels ticket 12.
  // Only allowed on the day the ticket was made, and not once it has been collected.
  // If the customer had paid, the money given back is saved on the ticket (refunded) and
  // taken off today's dry cleaning (or service wash) money, so the day's total stays right.
  router.post(`/api/${urlName}/:id/cancel`, requireStaff, (req, res) => {
    const ticket = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id)
    if (!ticket) {
      return res.status(404).json({ error: `There is no ticket number ${req.params.id}` })
    }
    if (ticket.cancelled === 1) {
      return res.status(409).json({ error: `Ticket number ${ticket.id} is already cancelled` })
    }
    if (ticket.collected === 1) {
      return res.status(409).json({
        error: `Ticket number ${ticket.id} has already been collected`,
      })
    }
    if (ticket.created_at.slice(0, 10) !== today()) {
      return res.status(409).json({ error: 'Only tickets made today can be cancelled' })
    }

    const kind = table === 'dry_cleaning_tickets' ? 'Dry cleaning' : 'Service wash'
    // Give back what was paid: the full price if paid, otherwise any deposit
    const refundAmount = ticket.paid === 1 ? ticket.price : ticket.deposit || 0
    const refund = refundAmount > 0

    db.prepare(
      `UPDATE ${table} SET cancelled = 1, cancelled_at = datetime('now', 'localtime'), cancelled_by = ?, refunded = ? WHERE id = ?`,
    ).run(req.staffId, refundAmount, ticket.id)

    logEdit({
      action: refund ? 'Ticket cancelled and refunded' : 'Ticket cancelled',
      details:
        `${kind} ticket ${ticket.id} for ${ticket.customer_name}, £${ticket.price.toFixed(2)} ` +
        (ticket.paid ? 'paid' : ticket.deposit > 0 ? `with a £${ticket.deposit.toFixed(2)} deposit` : 'not paid') +
        (refund
          ? `; £${refundAmount.toFixed(2)} given back, taken off ${kind.toLowerCase()}`
          : '; nothing given back'),
      amount: refund ? refundAmount : null,
      staffId: req.staffId,
    })

    refreshTakings(today()) // keep today's saved card/cash totals up to date
    res.json({
      ticket: ticketWithNames(table, ticket.id),
      refunded: refundAmount,
    })
  })
}

export default router
