// The admin's edit history: who changed what, and when.
import db from '../db/index.js'

// Adds one row to the edit history. e.g.
// logEdit({ action: 'Card amount changed', details: '25 Oct 2026: £25.00 → £60.00', amount: 60, byAdmin: true })
export function logEdit({ action, details, amount = null, staffId = null, byAdmin = false }) {
  db.prepare(
    'INSERT INTO edit_history (action, details, amount, staff_id, by_admin) VALUES (?, ?, ?, ?, ?)',
  ).run(action, details, amount, staffId, byAdmin ? 1 : 0)
}
