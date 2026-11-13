// Admin → Day summary: one day's totals, and saving or changing how much of a day's money was
// paid by card (the rest is cash). A day with its card amount saved is "closed".
import express from 'express'
import db from '../../db/index.js'
import { round } from '../../lib/money.js'
import { checkDate } from '../../lib/dates.js'
import { logEdit } from '../../lib/editHistory.js'
import { dailyTotals, savedTakings } from '../../lib/takings.js'
import { cashDrawer } from '../../lib/cashDrawer.js'

const router = express.Router()

// One day's totals for the Admin page, e.g. /api/daily-summary?date=2026-10-24
// Without a date it uses today. Also sends the card/cash split if one was saved for that day.
router.get('/api/daily-summary', (req, res) => {
  const date = req.query.date || db.prepare("SELECT date('now', 'localtime') AS today").get().today

  const error = checkDate(date)
  if (error) {
    return res.status(400).json({ error })
  }

  const takings = savedTakings(date)[0] || null
  // cashDrawer: the opening float and the cash counted at closing, if saved at the till
  res.json({ ...dailyTotals(date), takings, cashDrawer: cashDrawer(date) })
})

// Save how much of a day's money was paid by card. The rest is cash.
// Send { date: "2026-10-24", card_total: 80.5 }.
// Each day is saved once; after that the card amount is changed with the PUT route below.
router.post('/api/daily-takings', (req, res) => {
  const { date, card_total } = req.body

  const error = checkDate(date)
  if (error) {
    return res.status(400).json({ error })
  }
  if (typeof card_total !== 'number' || card_total < 0) {
    return res.status(400).json({ error: 'Please enter the card total, £0 or more' })
  }

  const alreadySaved = db.prepare('SELECT * FROM daily_takings WHERE date = ?').get(date)
  if (alreadySaved) {
    return res.status(409).json({
      error: 'Card and cash for this day have already been saved. Use Edit to change them.',
    })
  }

  // The server works out the day total itself, so it always matches the database
  const dayTotal = dailyTotals(date).dayTotal
  const cashTotal = round(dayTotal - card_total)

  try {
    db.prepare(
      `
      INSERT INTO daily_takings (date, day_total, card_total, cash_total)
      VALUES (?, ?, ?, ?)
    `,
    ).run(date, dayTotal, card_total, cashTotal)

    logEdit({
      action: 'Card amount saved',
      details: `${date}: card £${card_total.toFixed(2)}, cash £${cashTotal.toFixed(2)}, day total £${dayTotal.toFixed(2)}`,
      amount: card_total,
      byAdmin: true,
    })
    res.status(201).json(savedTakings(date)[0])
  } catch (err) {
    // For example a card total with more than 2 decimal places
    res.status(400).json({ error: err.message })
  }
})

// Change the card amount for a day that was already saved, e.g.
// PUT /api/daily-takings/2026-10-25 with { card_total: 60 }. Cash and the day total are worked out again.
router.put('/api/daily-takings/:date', (req, res) => {
  const { date } = req.params
  const { card_total } = req.body

  const before = db.prepare('SELECT * FROM daily_takings WHERE date = ?').get(date)
  if (!before) {
    return res.status(404).json({ error: 'Card and cash have not been saved for this day yet' })
  }
  if (typeof card_total !== 'number' || card_total < 0) {
    return res.status(400).json({ error: 'Please enter the card total, £0 or more' })
  }

  const dayTotal = dailyTotals(date).dayTotal
  try {
    db.prepare(
      `
      UPDATE daily_takings
      SET card_total = ?, day_total = ?, cash_total = ?, saved_at = datetime('now', 'localtime')
      WHERE date = ?
    `,
    ).run(card_total, dayTotal, round(dayTotal - card_total), date)

    logEdit({
      action: 'Card amount changed',
      details: `${date}: card £${before.card_total.toFixed(2)} → £${card_total.toFixed(2)}, cash now £${round(dayTotal - card_total).toFixed(2)}`,
      amount: card_total,
      byAdmin: true,
    })
    res.json(savedTakings(date)[0])
  } catch (err) {
    // For example a card total with more than 2 decimal places
    res.status(400).json({ error: err.message })
  }
})

export default router
