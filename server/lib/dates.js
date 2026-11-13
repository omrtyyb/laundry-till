// Date helpers. Dates are the shop's local date, written like 2026-10-24.
import db from '../db/index.js'

// Today's date in the shop's local time, e.g. "2026-10-25"
export function today() {
  return db.prepare("SELECT date('now', 'localtime') AS today").get().today
}

// Checks a date from the Admin page. Returns an error message, or null if the date is fine.
// The date must look like 2026-10-24, be a real day, and not be in the future.
export function checkDate(date) {
  const today = db.prepare("SELECT date('now', 'localtime') AS today").get().today
  const isRealDate = db.prepare('SELECT date(?) = ? AS ok').get(date, date).ok === 1
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !isRealDate) {
    return 'Please choose a date like 2026-10-24'
  }
  if (date > today) {
    return 'That date is in the future'
  }
  return null
}
