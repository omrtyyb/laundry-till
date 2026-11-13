// The monthly summary: the month's totals, tickets, best and worst day, and card and cash.
import db from '../db/index.js'
import { round } from '../lib/money.js'
import { savedTakings } from '../lib/takings.js'
import { INCOME_PARTS, moneyByDay, dayTotal } from './moneyByDay.js'

// Everything in the monthly summary for one month (from and to are its first and last day so far)
export function monthSummary(month, from, to) {
  const byDay = moneyByDay(from, to)

  // Add every day together for the month's totals
  const totals = { dryCleaning: 0, serviceWash: 0, products: 0, machineCoins: 0, spending: 0 }
  for (const money of Object.values(byDay)) {
    for (const part of Object.keys(totals)) totals[part] += money[part]
  }
  for (const part of Object.keys(totals)) totals[part] = round(totals[part])
  const income = round(INCOME_PARTS.reduce((sum, part) => sum + totals[part], 0))

  // Best and worst day, out of the days that had anything happen
  const days = Object.entries(byDay)
    .map(([date, money]) => ({ date, total: dayTotal(money) }))
    .sort((a, b) => b.total - a.total)

  // Tickets made this month (both kinds) and their average price
  const tickets = db
    .prepare(`
      SELECT COUNT(*) AS count, AVG(price) AS average,
             SUM(type = 'dryCleaning') AS dryCleaning, SUM(type = 'serviceWash') AS serviceWash
      FROM (
        SELECT 'dryCleaning' AS type, price, created_at FROM dry_cleaning_tickets WHERE cancelled = 0 AND imported = 0
        UNION ALL
        SELECT 'serviceWash', price, created_at FROM service_wash_tickets WHERE cancelled = 0 AND imported = 0
      )
      WHERE date(created_at) BETWEEN ? AND ?
    `)
    .get(from, to)

  // Card and cash, from the days the admin closed
  const closed = savedTakings(from, to)
  const takings = {
    closedDays: closed.length,
    card: closed.reduce((sum, row) => sum + row.card_total, 0),
    cash: closed.reduce((sum, row) => sum + row.cash_total, 0),
  }

  return {
    month,
    totals: { ...totals, income, total: round(income - totals.spending) },
    tickets: {
      count: tickets.count,
      dryCleaning: tickets.dryCleaning || 0,
      serviceWash: tickets.serviceWash || 0,
      averagePrice: round(tickets.average || 0),
    },
    bestDay: days[0] || null,
    worstDay: days[days.length - 1] || null,
    activeDays: days.length,
    takings: { closedDays: takings.closedDays, card: round(takings.card), cash: round(takings.cash) },
  }
}
