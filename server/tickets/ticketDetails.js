// Reading one ticket with everything the till and Admin show about it.
import db from '../db/index.js'

// A ticket with the names of the workers who made, took payment for, collected and cancelled it,
// and (for dry cleaning) the items on it
export function ticketWithNames(table, id) {
  const ticket = db
    .prepare(
      `
      SELECT t.*, made.name AS made_by, collector.name AS collected_by_name, canceller.name AS cancelled_by_name
      FROM ${table} t
      LEFT JOIN staff made ON made.id = t.staff_id
      LEFT JOIN staff collector ON collector.id = t.collected_by
      LEFT JOIN staff canceller ON canceller.id = t.cancelled_by
      WHERE t.id = ?
    `,
    )
    .get(id)
  if (ticket && table === 'dry_cleaning_tickets') {
    ticket.items = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ? ORDER BY id').all(id)
  }
  return ticket
}
