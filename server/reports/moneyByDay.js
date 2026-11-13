// Shared building blocks for the Admin reports: each day's money split by where it came from,
// a day's total, the dates in a range and the days of a month.
import db from '../db/index.js'
import { round } from '../lib/money.js'
import { today } from '../lib/dates.js'
import { DRY_CLEANING_PAYMENTS, SERVICE_WASH_PAYMENTS } from '../lib/takings.js'

// Sales of this item are the coins taken from the washers and dryers
export const MACHINE_COINS = 'Washers Dryers Coins'

// The four kinds of income, in the same order as the charts
export const INCOME_PARTS = ['dryCleaning', 'serviceWash', 'products', 'machineCoins']

// Adds up each day's money between two dates (both included).
// Returns { "2026-10-24": { dryCleaning, serviceWash, products, machineCoins, spending }, ... }
// Tickets count on the day they were paid (a deposit on the day it was taken);
// sales and spending on the day they happened.
export function moneyByDay(from, to) {
  const days = {}
  const add = (sql, part) => {
    for (const row of db.prepare(sql).all(from, to)) {
      days[row.day] ??= { dryCleaning: 0, serviceWash: 0, products: 0, machineCoins: 0, spending: 0 }
      days[row.day][part] = row.total
    }
  }
  add(`SELECT day, SUM(amount) AS total FROM ${DRY_CLEANING_PAYMENTS}
       WHERE day BETWEEN ? AND ? GROUP BY day`, 'dryCleaning')
  add(`SELECT day, SUM(amount) AS total FROM ${SERVICE_WASH_PAYMENTS}
       WHERE day BETWEEN ? AND ? GROUP BY day`, 'serviceWash')
  add(`SELECT date(created_at) AS day, SUM(quantity * unit_price) AS total FROM sales
       WHERE item_name <> '${MACHINE_COINS}' AND date(created_at) BETWEEN ? AND ? GROUP BY day`, 'products')
  add(`SELECT date(created_at) AS day, SUM(quantity * unit_price) AS total FROM sales
       WHERE item_name = '${MACHINE_COINS}' AND date(created_at) BETWEEN ? AND ? GROUP BY day`, 'machineCoins')
  add(`SELECT date(created_at) AS day, SUM(amount) AS total FROM till_spending
       WHERE date(created_at) BETWEEN ? AND ? GROUP BY day`, 'spending')
  return days
}

// A day's total: all income minus till spending
export const dayTotal = (money) =>
  round(INCOME_PARTS.reduce((sum, part) => sum + money[part], 0) - money.spending)

// Every date from one day to another, oldest first, e.g. ["2026-10-01", "2026-10-02", ...]
export function datesBetween(from, to) {
  const dates = []
  for (let day = from; day <= to; day = db.prepare("SELECT date(?, '+1 day') AS day").get(day).day) {
    dates.push(day)
  }
  return dates
}

// Checks a month like "2026-10" and works out its first day and its last day so far.
// Returns { error } or { from, to }.
export function monthRange(month) {
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return { error: 'Please choose a month like 2026-10' }
  }
  const from = month + '-01'
  if (from > today()) {
    return { error: 'That month is in the future' }
  }
  const lastDay = db.prepare("SELECT date(?, '+1 month', '-1 day') AS day").get(from).day
  return { from, to: lastDay < today() ? lastDay : today() }
}
