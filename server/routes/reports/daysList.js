// Admin → Days: one row per day of a month, with card and cash and which days still need closing.
import express from 'express'
import db from '../../db/index.js'
import { today } from '../../lib/dates.js'
import { savedTakings } from '../../lib/takings.js'
import { cashDrawer } from '../../lib/cashDrawer.js'
import { moneyByDay, dayTotal, datesBetween, monthRange } from '../../reports/moneyByDay.js'

const router = express.Router()

// ---------- Days list with card and cash check ----------
// e.g. /api/reports/days?month=2026-10 : one row per day, newest first
router.get('/api/reports/days', (req, res) => {
  const month = req.query.month || today().slice(0, 7)
  const range = monthRange(month)
  if (range.error) {
    return res.status(400).json({ error: range.error })
  }
  const { from, to } = range

  const byDay = moneyByDay(from, to)
  const ticketsByDay = Object.fromEntries(
    db
      .prepare(`
        SELECT date(created_at) AS day, COUNT(*) AS count FROM (
          SELECT created_at FROM dry_cleaning_tickets WHERE cancelled = 0 AND imported = 0
          UNION ALL
          SELECT created_at FROM service_wash_tickets WHERE cancelled = 0 AND imported = 0
        ) WHERE date(created_at) BETWEEN ? AND ? GROUP BY day
      `)
      .all(from, to)
      .map((row) => [row.day, row.count]),
  )
  const takingsByDay = Object.fromEntries(
    savedTakings(from, to).map((row) => [row.date, row]),
  )

  const todayDate = today()
  const rows = datesBetween(from, to)
    .reverse()
    .map((date) => {
      const takings = takingsByDay[date]
      const hasActivity = Boolean(byDay[date])
      return {
        date,
        dayTotal: byDay[date] ? dayTotal(byDay[date]) : 0,
        tickets: ticketsByDay[date] || 0,
        card: takings ? takings.card_total : null,
        cash: takings ? takings.cash_total : null,
        closed: Boolean(takings),
        // counted cash - what the drawer should hold (null if not counted)
        cashDifference: cashDrawer(date)?.difference ?? null,
        // A past day that had money in or out but was never closed: the card amount is missing
        needsClosing: hasActivity && !takings && date < todayDate,
      }
    })

  res.json({ month, days: rows })
})

export default router
