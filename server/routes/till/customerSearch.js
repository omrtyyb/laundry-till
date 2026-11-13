// The till's search boxes: customers seen before (for a new ticket) and finding a ticket.
import express from 'express'
import db from '../../db/index.js'

const router = express.Router()

// Customers seen before, for the suggestions under Name and Phone number on a new ticket.
// e.g. /api/customers/suggest?q=sar or ?q=0763. Matches part of a name or a phone number.
// Only the 2 best matches are sent, so the list stays short. One row per name + phone pair,
// with how many tickets and the last visit.
router.get('/api/customers/suggest', (req, res) => {
  const text = String(req.query.q || '').trim()
  if (text.length < 2) return res.json([])

  // % and _ typed in the box are searched for as normal letters
  const escaped = text.replace(/[\\%_]/g, '\\$&')
  const pattern = '%' + escaped + '%'
  const startsWith = escaped + '%'
  const customers = db
    .prepare(
      `
      SELECT customer_name, phone_number, COUNT(*) AS tickets, MAX(created_at) AS last_visit
      FROM (
        SELECT customer_name, phone_number, created_at FROM dry_cleaning_tickets WHERE imported = 0
        UNION ALL
        SELECT customer_name, phone_number, created_at FROM service_wash_tickets WHERE imported = 0
      )
      WHERE customer_name LIKE ? ESCAPE '\\' OR phone_number LIKE ? ESCAPE '\\'
      GROUP BY lower(trim(customer_name)), trim(phone_number)
      -- names or numbers that start with what was typed come first, then the most recent
      ORDER BY (customer_name LIKE ? ESCAPE '\\' OR phone_number LIKE ? ESCAPE '\\') DESC, last_visit DESC
      LIMIT 2
    `,
    )
    .all(pattern, pattern, startsWith, startsWith)
  res.json(customers)
})

// Search dry cleaning and service wash tickets by ticket id or customer name, for the
// search box on the till's activity list. e.g. /api/tickets/search?q=sarah or ?q=36
// Searches every ticket, not just today's; newest first, at most 20.
// A garment tag number like 123-2 (ticket 123, piece 2; from the printed tags or a barcode
// scanner) finds dry cleaning ticket 123 only, as tags are only printed for dry cleaning.
// The barcode on a printed ticket is D123 (dry cleaning) or S123 (service wash), and finds
// just that ticket, as both kinds have their own ticket 123.
router.get('/api/tickets/search', (req, res) => {
  const text = String(req.query.q || '').trim()
  if (!text) return res.json([])

  const scanned = text.match(/^([DS])\s*(\d+)$/i)
  if (scanned) {
    const dry = scanned[1].toUpperCase() === 'D'
    const ticket = db
      .prepare(
        `SELECT ? AS type, id, customer_name, price, paid, collected, cancelled, created_at, deposit, ready_at, rack_slot
           FROM ${dry ? 'dry_cleaning_tickets' : 'service_wash_tickets'} WHERE id = ? AND imported = 0`,
      )
      .get(dry ? 'dryCleaning' : 'serviceWash', Number(scanned[2]))
    return res.json(ticket ? [ticket] : [])
  }

  const tag = text.match(/^(\d+)\s*[-/]\s*(\d+)$/)
  if (tag) {
    const ticket = db
      .prepare(
        `SELECT 'dryCleaning' AS type, id, customer_name, price, paid, collected, cancelled, created_at, deposit,
                ready_at, rack_slot, number_of_pieces
           FROM dry_cleaning_tickets WHERE id = ? AND imported = 0`,
      )
      .get(Number(tag[1]))
    return res.json(ticket ? [{ ...ticket, piece: Number(tag[2]) }] : [])
  }

  const id = /^\d+$/.test(text) ? Number(text) : -1
  const tickets = db
    .prepare(
      `
      SELECT * FROM (
        SELECT 'dryCleaning' AS type, id, customer_name, price, paid, collected, cancelled, created_at, deposit, ready_at, rack_slot
          FROM dry_cleaning_tickets WHERE imported = 0
        UNION ALL
        SELECT 'serviceWash', id, customer_name, price, paid, collected, cancelled, created_at, deposit, ready_at, rack_slot
          FROM service_wash_tickets WHERE imported = 0
      )
      WHERE id = ? OR customer_name LIKE '%' || ? || '%' ESCAPE '\\'
      ORDER BY created_at DESC
      LIMIT 20
    `,
    )
    // % and _ typed in the box are searched for as normal letters
    .all(id, text.replace(/[\\%_]/g, '\\$&'))
  res.json(tickets)
})

export default router
