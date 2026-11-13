// Admin → Monthly summary, on screen and as a PDF.
import express from 'express'
import { today } from '../../lib/dates.js'
import { monthRange } from '../../reports/moneyByDay.js'
import { monthSummary } from '../../reports/monthSummary.js'
import { monthPdf } from '../../reports/monthPdf.js'

const router = express.Router()

// e.g. /api/reports/month?month=2026-10 (without a month it uses this month)
router.get('/api/reports/month', (req, res) => {
  const month = req.query.month || today().slice(0, 7)
  const range = monthRange(month)
  if (range.error) {
    return res.status(400).json({ error: range.error })
  }
  res.json(monthSummary(month, range.from, range.to))
})

// ---------- Monthly summary as a PDF ----------
// e.g. /api/reports/month-pdf?month=2026-10 downloads "laundry-till-2026-10.pdf".
// Page 1: the month's totals. Then a table with one row per day:
// date, products, machine coins, spent from the till, service wash, dry cleaning, cash, card, day total.
router.get('/api/reports/month-pdf', (req, res) => {
  const month = req.query.month || today().slice(0, 7)
  const range = monthRange(month)
  if (range.error) {
    return res.status(400).json({ error: range.error })
  }
  const pdf = monthPdf(month, range.from, range.to)
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="laundry-till-${month}.pdf"`)
  res.send(pdf)
})

export default router
