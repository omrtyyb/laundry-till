// The cash drawer check for one day:
//   should hold = opening float + the day's cash (day total - card; till spending is already
//                 taken off the day total)
//   difference  = counted - should hold   (below 0: short, above 0: over)
// The day's cash is only known once the card amount is saved (the day is closed), so until
// then "should hold" and the difference are null.
import db from '../db/index.js'
import { round } from './money.js'
import { savedTakings } from './takings.js'

// The notes and coins staff can count, in pounds
export const DENOMINATIONS = [50, 20, 10, 5, 2, 1, 0.5, 0.2, 0.1, 0.05, 0.02, 0.01]

// One day's cash drawer, with the workers' names, or null if nothing was saved that day
export function cashDrawer(date) {
  const row = db
    .prepare(
      `SELECT c.*, f.name AS float_by_name, k.name AS counted_by_name
         FROM cash_counts c
         LEFT JOIN staff f ON f.id = c.float_by
         LEFT JOIN staff k ON k.id = c.counted_by
        WHERE c.date = ?`,
    )
    .get(date)
  if (!row) return null
  const takings = savedTakings(date)[0]
  const cash = takings ? takings.cash_total : null
  const shouldHold = cash !== null && row.opening_float !== null ? round(row.opening_float + cash) : null
  return {
    ...row,
    breakdown: row.breakdown ? JSON.parse(row.breakdown) : null,
    cash_taken: cash,
    should_hold: shouldHold,
    difference: shouldHold !== null && row.counted !== null ? round(row.counted - shouldHold) : null,
    banked: row.counted !== null && row.left_in !== null ? round(row.counted - row.left_in) : null,
  }
}

// What to suggest as this morning's float: what was left in the drawer at the last count
export function suggestedFloat(date) {
  const last = db
    .prepare('SELECT left_in FROM cash_counts WHERE date < ? AND left_in IS NOT NULL ORDER BY date DESC LIMIT 1')
    .get(date)
  return last ? last.left_in : null
}
