// Admin → Uncollected tickets: everything still waiting in the shop, and the money still owed.
import express from 'express'
import db from '../../db/index.js'
import { round } from '../../lib/money.js'
import { today } from '../../lib/dates.js'
import { logEdit } from '../../lib/editHistory.js'
import { getSettings } from '../../printing/printerSettings.js'
import { TICKET_KINDS } from '../../printing/ticketReceipt.js'
import { whatsappNumber, whatsappReminderText, FINAL_NOTICE_DAYS, CHARITY_DAYS } from '../../printing/whatsappReceipt.js'

const router = express.Router()

// Every ticket that hasn't been collected yet, oldest first, for the Admin page.
// The pickup day is a weekday name, so the pickup date is the first time that weekday
// comes round after the ticket was made (a ticket made on a Monday for "Monday" is next week).
// A ticket is overdue when its pickup date is before today.
router.get('/api/uncollected-tickets', (req, res) => {
  const tickets = db
    .prepare(
      `
      SELECT 'dryCleaning' AS type, id, customer_name, phone_number,
             clothes_description AS description, pickup_time, price, paid, deposit, created_at,
             ready_at, rack_slot, reminder_count, reminded_at, final_notice_at
        FROM dry_cleaning_tickets WHERE collected = 0 AND cancelled = 0 AND imported = 0
      UNION ALL
      SELECT 'serviceWash', id, customer_name, phone_number,
             load_description, pickup_time, price, paid, deposit, created_at,
             ready_at, rack_slot, reminder_count, reminded_at, final_notice_at
        FROM service_wash_tickets WHERE collected = 0 AND cancelled = 0 AND imported = 0
      ORDER BY created_at
    `,
    )
    .all()

  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const todayDate = today()

  for (const ticket of tickets) {
    const madeOn = new Date(ticket.created_at.slice(0, 10) + 'T12:00:00')
    const daysUntilPickup = (DAYS.indexOf(ticket.pickup_time) - madeOn.getDay() + 7) % 7 || 7
    madeOn.setDate(madeOn.getDate() + daysUntilPickup)
    const pad = (n) => String(n).padStart(2, '0')
    ticket.pickup_date = `${madeOn.getFullYear()}-${pad(madeOn.getMonth() + 1)}-${pad(madeOn.getDate())}`
    ticket.overdue = ticket.pickup_date < todayDate
    ticket.days_waiting = daysWaiting(ticket, todayDate)
  }

  // Money still owed: unpaid tickets that are still in the shop, less any deposits taken
  const owed = round(
    tickets.filter((ticket) => !ticket.paid).reduce((sum, ticket) => sum + ticket.price - ticket.deposit, 0),
  )

  res.json({ tickets, owed, charityDays: CHARITY_DAYS })
})

// Whole days between two dates like 2026-10-24
const daysBetween = (from, to) => Math.round((new Date(to + 'T12:00:00') - new Date(from + 'T12:00:00')) / 86400000)

// Days a ticket has been waiting to be collected: since it was marked ready, or (if it was
// never marked ready) since its pickup day. 0 before then.
function daysWaiting(ticket, todayDate) {
  const since = ticket.ready_at ? ticket.ready_at.slice(0, 10) : ticket.pickup_date
  return Math.max(0, daysBetween(since, todayDate))
}

const TABLES = { dryCleaning: 'dry_cleaning_tickets', serviceWash: 'service_wash_tickets' }
const KINDS = { dryCleaning: TICKET_KINDS['dry-cleaning-tickets'], serviceWash: TICKET_KINDS['service-wash-tickets'] }

// A WhatsApp reminder for a ticket still in the shop, e.g.
// POST /api/uncollected-tickets/dryCleaning/12/remind { final: true }
// Answers { link } to open WhatsApp with the message typed in, and records that a reminder
// (or the final "will be given to charity" notice) was sent.
router.post('/api/uncollected-tickets/:type/:id/remind', (req, res) => {
  const table = TABLES[req.params.type]
  if (!table) return res.status(404).json({ error: 'Unknown ticket type' })
  const ticket = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id)
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
  if (ticket.collected || ticket.cancelled) return res.status(409).json({ error: 'This ticket is no longer in the shop' })
  const number = whatsappNumber(ticket.phone_number)
  if (!number) return res.status(400).json({ error: `"${ticket.phone_number}" is not a phone number WhatsApp can use` })

  const todayDate = today()
  const final = Boolean(req.body?.final)
  const collectByDate = new Date(todayDate + 'T12:00:00')
  collectByDate.setDate(collectByDate.getDate() + FINAL_NOTICE_DAYS)
  const collectBy = collectByDate.toISOString().slice(0, 10)
  // The pickup date, worked out the same way as the list above
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const madeOn = new Date(ticket.created_at.slice(0, 10) + 'T12:00:00')
  madeOn.setDate(madeOn.getDate() + ((DAYS.indexOf(ticket.pickup_time) - madeOn.getDay() + 7) % 7 || 7))
  const waiting = daysWaiting({ ...ticket, pickup_date: madeOn.toISOString().slice(0, 10) }, todayDate)

  const text = whatsappReminderText(KINDS[req.params.type], ticket, getSettings(), { final, daysWaiting: waiting, collectBy })
  db.prepare(
    `UPDATE ${table} SET reminder_count = reminder_count + 1, reminded_at = datetime('now', 'localtime')
       ${final ? ", final_notice_at = datetime('now', 'localtime')" : ''} WHERE id = ?`,
  ).run(ticket.id)
  if (final) {
    logEdit({ action: 'Final notice sent', details: `Ticket ${ticket.id} (${ticket.customer_name}): collect by ${collectBy}`, byAdmin: true })
  }
  res.json({ link: `https://wa.me/${number}?text=${encodeURIComponent(text)}` })
})

export default router
