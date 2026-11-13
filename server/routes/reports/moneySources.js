// Admin → Where the money comes from.
import express from 'express'
import db from '../../db/index.js'
import { round } from '../../lib/money.js'
import { checkDate, today } from '../../lib/dates.js'
import { INCOME_PARTS, moneyByDay, monthRange } from '../../reports/moneyByDay.js'

const router = express.Router()

// ---------- Where the money comes from ----------
// e.g. /api/reports/share?period=week&date=2026-10-25
// period is "day" (that day), "week" (the 7 days ending on that day) or "month" (that calendar month)
router.get('/api/reports/share', (req, res) => {
  const period = ['day', 'week', 'month'].includes(req.query.period) ? req.query.period : 'week'
  const date = req.query.date || today()
  const error = checkDate(date)
  if (error) {
    return res.status(400).json({ error })
  }

  let from = date
  let to = date
  if (period === 'week') {
    from = db.prepare("SELECT date(?, '-6 days') AS day").get(date).day
  } else if (period === 'month') {
    const range = monthRange(date.slice(0, 7))
    from = range.from
    to = range.to
  }

  const totals = { dryCleaning: 0, serviceWash: 0, products: 0, machineCoins: 0 }
  for (const money of Object.values(moneyByDay(from, to))) {
    for (const part of INCOME_PARTS) totals[part] += money[part]
  }
  const income = INCOME_PARTS.reduce((sum, part) => sum + totals[part], 0)

  res.json({
    period,
    from,
    to,
    income: round(income),
    parts: INCOME_PARTS.map((part) => ({
      key: part,
      amount: round(totals[part]),
      // Share of the income, to one decimal place, e.g. 55.3
      percent: income > 0 ? Math.round((totals[part] / income) * 1000) / 10 : 0,
    })),
  })
})

export default router
