// Admin → the chart of the last 7 or 30 days.
import express from 'express'
import db from '../../db/index.js'
import { round } from '../../lib/money.js'
import { today } from '../../lib/dates.js'
import { DRY_CLEANING_PAYMENTS, SERVICE_WASH_PAYMENTS } from '../../lib/takings.js'

const router = express.Router()

// Totals for each of the last 7 or 30 days (ending today), for the Admin chart.
// e.g. /api/daily-chart?days=7. Machine coins are the "Washers Dryers Coins" sales,
// kept apart from the other product sales. weekBeforeTotal is the day total from
// exactly 7 days earlier, to compare with.
router.get('/api/daily-chart', (req, res) => {
  const numberOfDays = req.query.days === '30' ? 30 : 7
  const MACHINE_COINS = 'Washers Dryers Coins'

  // One query per table, grouped by day, over the whole range plus the week before
  const byDay = (sql) => {
    const rows = db.prepare(sql).all(numberOfDays + 7)
    return Object.fromEntries(rows.map((row) => [row.day, row.total]))
  }
  const since = "date('now', 'localtime', '-' || ? || ' days')"

  const dryCleaning = byDay(`SELECT day, SUM(amount) AS total FROM ${DRY_CLEANING_PAYMENTS}
    WHERE day > ${since} GROUP BY day`)
  const serviceWash = byDay(`SELECT day, SUM(amount) AS total FROM ${SERVICE_WASH_PAYMENTS}
    WHERE day > ${since} GROUP BY day`)
  const products = byDay(`SELECT date(created_at) AS day, SUM(quantity * unit_price) AS total FROM sales
    WHERE item_name <> '${MACHINE_COINS}' AND date(created_at) > ${since} GROUP BY day`)
  const machineCoins = byDay(`SELECT date(created_at) AS day, SUM(quantity * unit_price) AS total FROM sales
    WHERE item_name = '${MACHINE_COINS}' AND date(created_at) > ${since} GROUP BY day`)
  const spending = byDay(`SELECT date(created_at) AS day, SUM(amount) AS total FROM till_spending
    WHERE date(created_at) > ${since} GROUP BY day`)

  const dayTotal = (day) =>
    round(
      (dryCleaning[day] || 0) +
        (serviceWash[day] || 0) +
        (products[day] || 0) +
        (machineCoins[day] || 0) -
        (spending[day] || 0),
    )

  // The list of days, oldest first, ending today
  const dayBefore = (day, n) => db.prepare("SELECT date(?, '-' || ? || ' days') AS day").get(day, n).day
  const todayDate = today()
  const days = []
  for (let i = numberOfDays - 1; i >= 0; i--) {
    const day = dayBefore(todayDate, i)
    days.push({
      date: day,
      dryCleaning: round(dryCleaning[day] || 0),
      serviceWash: round(serviceWash[day] || 0),
      products: round(products[day] || 0),
      machineCoins: round(machineCoins[day] || 0),
      spending: round(spending[day] || 0),
      dayTotal: dayTotal(day),
      weekBeforeTotal: dayTotal(dayBefore(day, 7)),
    })
  }

  res.json(days)
})

export default router
