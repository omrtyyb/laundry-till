// The ticket summary (Admin → Tickets → Ticket summary).
import db from '../db/index.js'
import { round } from '../lib/money.js'

// Every dry cleaning or service wash ticket made between two dates and times, with the
// total number of pieces and the total price. Paid or not doesn't matter; cancelled tickets
// and the daily totals imported from the old spreadsheet are left out. price is what the
// customer pays (after any discount).
// e.g. ?kind=dryCleaning&from=2026-10-26T09:00&to=2026-10-26T18:30 (both included)
export function ticketSummary(query) {
  const kind = query.kind === 'serviceWash' ? 'serviceWash' : 'dryCleaning'
  // "2026-10-26T09:00" (from the date and time boxes) becomes "2026-10-26 09:00:00"
  const asTime = (text, seconds) =>
    typeof text === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text) ? text.replace('T', ' ') + seconds : null
  const from = asTime(query.from, ':00')
  const to = asTime(query.to, ':59') // the whole "to" minute is included
  if (!from || !to) return { error: 'Please choose a from and a to date and time' }
  if (to < from) return { error: 'The "to" date and time is before the "from" one' }

  const tickets =
    kind === 'dryCleaning'
      ? db
          .prepare(
            `SELECT id, created_at, customer_name, clothes_description AS description,
                    number_of_pieces AS pieces, price, paid, collected
             FROM dry_cleaning_tickets
             WHERE cancelled = 0 AND imported = 0 AND created_at BETWEEN ? AND ?
             ORDER BY created_at, id`,
          )
          .all(from, to)
      : db
          .prepare(
            `SELECT id, created_at, customer_name,
                    CASE WHEN load_size IS NULL THEN load_description
                         ELSE load_size || ': ' || load_description END AS description,
                    NULL AS pieces, price, paid, collected
             FROM service_wash_tickets
             WHERE cancelled = 0 AND imported = 0 AND created_at BETWEEN ? AND ?
             ORDER BY created_at, id`,
          )
          .all(from, to)

  return {
    kind,
    from,
    to,
    tickets,
    totals: {
      tickets: tickets.length,
      pieces: tickets.reduce((sum, t) => sum + (t.pieces || 0), 0),
      money: round(tickets.reduce((sum, t) => sum + t.price, 0)),
    },
  }
}
