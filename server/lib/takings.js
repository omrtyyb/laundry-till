// Adding up the shop's money: one day's totals, and the card/cash totals saved for each day
// in Admin. Tickets count on the day they were paid (a deposit on the day it was taken);
// sales and till spending on the day they happened.
import db from '../db/index.js'
import { round } from './money.js'

// A ticket table's money, one row per payment, with the day it came in:
// deposits on the day the ticket was made, and the rest (price - deposit) on the day it was paid.
// Money given back for a cancelled ticket is taken off on the day it was cancelled.
// Use it as a table: SELECT day, SUM(amount) FROM ${DRY_CLEANING_PAYMENTS} ...
const ticketPayments = (table) => `(
  SELECT date(created_at) AS day, deposit AS amount FROM ${table} WHERE deposit > 0
  UNION ALL
  SELECT date(paid_at) AS day, price - deposit AS amount FROM ${table} WHERE paid = 1
  UNION ALL
  SELECT date(cancelled_at) AS day, -refunded AS amount FROM ${table} WHERE refunded > 0
)`
export const DRY_CLEANING_PAYMENTS = ticketPayments('dry_cleaning_tickets')
export const SERVICE_WASH_PAYMENTS = ticketPayments('service_wash_tickets')

// Adds up one day's money. Dates are the shop's local date.
export function dailyTotals(date) {
  // Each query only counts rows from the chosen day. The ? is filled in with the date.
  const total = (sql) => db.prepare(sql).get(date).total

  const dryCleaning = total(`SELECT COALESCE(SUM(amount), 0) AS total FROM ${DRY_CLEANING_PAYMENTS} WHERE day = ?`)
  const serviceWash = total(`SELECT COALESCE(SUM(amount), 0) AS total FROM ${SERVICE_WASH_PAYMENTS} WHERE day = ?`)
  const sales = total('SELECT COALESCE(SUM(quantity * unit_price), 0) AS total FROM sales WHERE date(created_at) = ?')
  const spending = total('SELECT COALESCE(SUM(amount), 0) AS total FROM till_spending WHERE date(created_at) = ?')

  // Sales split by item, e.g. Soap: 5 sold, £5.00
  const salesByItem = db
    .prepare(`
      SELECT item_name, SUM(quantity) AS quantity, SUM(quantity * unit_price) AS total
      FROM sales WHERE date(created_at) = ?
      GROUP BY item_name ORDER BY total DESC
    `)
    .all(date)

  return {
    date,
    dryCleaning: round(dryCleaning),
    serviceWash: round(serviceWash),
    sales: round(sales),
    salesByItem: salesByItem.map((item) => ({ ...item, total: round(item.total) })),
    spending: round(spending),
    dayTotal: round(dryCleaning + serviceWash + sales - spending),
  }
}

// Saved card/cash days, with the day total and cash worked out again from the
// tickets, sales and spending, so they can never be out of date. Only the card
// amount is taken as saved, e.g. savedTakings('2026-10-01', '2026-10-31').
export function savedTakings(from, to = from) {
  return db
    .prepare('SELECT * FROM daily_takings WHERE date BETWEEN ? AND ? ORDER BY date')
    .all(from, to)
    .map((row) => {
      const dayTotal = dailyTotals(row.date).dayTotal
      return { ...row, day_total: dayTotal, cash_total: round(dayTotal - row.card_total) }
    })
}

// If a day's card and cash were already saved, recalculate its day total and cash
// so they include anything added or paid since. The card amount stays as entered.
export function refreshTakings(date) {
  const takings = db.prepare('SELECT * FROM daily_takings WHERE date = ?').get(date)
  if (!takings) return
  const dayTotal = dailyTotals(date).dayTotal
  db.prepare('UPDATE daily_takings SET day_total = ?, cash_total = ? WHERE date = ?').run(
    dayTotal,
    round(dayTotal - takings.card_total),
    date,
  )
}
// Brings every saved day up to date (run when the server starts)
export function refreshAllTakings() {
  for (const { date } of db.prepare('SELECT date FROM daily_takings').all()) {
    refreshTakings(date)
  }
}
