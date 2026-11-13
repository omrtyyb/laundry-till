// The till's "Cash drawer" button: the opening float in the morning, and counting the cash
// at closing. The count is "blind": staff see what the drawer should hold only after they
// save what they counted. Saving the count with the card machine total also closes the day
// (the same as saving the card amount in Admin → Day summary), if it isn't closed already.
import express from 'express'
import db from '../../db/index.js'
import { today } from '../../lib/dates.js'
import { round, pounds } from '../../lib/money.js'
import { logEdit } from '../../lib/editHistory.js'
import { dailyTotals, savedTakings } from '../../lib/takings.js'
import { requireStaff } from '../../auth/staffAuth.js'
import { cashDrawer, suggestedFloat, DENOMINATIONS } from '../../lib/cashDrawer.js'

const router = express.Router()

const isMoney = (value) => typeof value === 'number' && value >= 0 && Math.round(value * 100) / 100 === value

// Today's drawer for the till. The amounts it should hold are only sent once counted.
router.get('/api/cash-drawer', (req, res) => {
  const date = today()
  const drawer = cashDrawer(date)
  const counted = drawer?.counted !== null && drawer?.counted !== undefined
  const takings = savedTakings(date)[0]
  res.json({
    date,
    denominations: DENOMINATIONS,
    opening_float: drawer?.opening_float ?? null,
    float_by_name: drawer?.float_by_name ?? null,
    suggested_float: suggestedFloat(date),
    // The card total is asked for at closing unless the day was already closed in Admin
    card_saved: Boolean(takings),
    count: counted ? drawer : null,
  })
})

// Put in this morning's float: { amount: 50 }. Can be changed later in the day.
router.post('/api/cash-drawer/float', requireStaff, (req, res) => {
  const { amount } = req.body
  if (!isMoney(amount)) return res.status(400).json({ error: 'Please enter the float, £0 or more' })
  const date = today()
  const before = db.prepare('SELECT opening_float FROM cash_counts WHERE date = ?').get(date)
  db.prepare(
    `INSERT INTO cash_counts (date, opening_float, float_by, float_at) VALUES (?, ?, ?, datetime('now', 'localtime'))
     ON CONFLICT (date) DO UPDATE SET opening_float = excluded.opening_float, float_by = excluded.float_by,
       float_at = excluded.float_at`,
  ).run(date, amount, req.staffId)
  if (before?.opening_float != null && before.opening_float !== amount) {
    logEdit({ action: 'Opening float changed', details: `${date}: ${pounds(before.opening_float)} → ${pounds(amount)}`, amount, staffId: req.staffId })
  }
  res.json({ opening_float: amount })
})

// Save the count at closing:
//   { counted, breakdown?, left_in, note?, opening_float?, card_total? }
// opening_float is needed if no float was put in this morning; card_total if the day isn't
// closed yet. Counting again replaces the last count (the change goes in the edit history).
router.post('/api/cash-drawer/count', requireStaff, (req, res) => {
  const { counted, left_in, opening_float, card_total } = req.body
  const note = String(req.body.note || '').trim().slice(0, 200)
  const date = today()
  const before = cashDrawer(date)

  if (!isMoney(counted)) return res.status(400).json({ error: 'Please enter the cash counted, £0 or more' })
  if (!isMoney(left_in)) return res.status(400).json({ error: 'Please enter the cash left in for tomorrow, £0 or more' })
  if (left_in > counted) return res.status(400).json({ error: 'You can’t leave in more cash than was counted' })
  const float = before?.opening_float ?? opening_float
  if (!isMoney(float)) return res.status(400).json({ error: 'Please enter this morning’s float, £0 or more' })
  const dayClosed = Boolean(savedTakings(date)[0])
  if (!dayClosed && !isMoney(card_total)) return res.status(400).json({ error: 'Please enter the card machine total, £0 or more' })

  // The notes and coins, if counted one by one: only known values and whole numbers
  let breakdown = null
  if (req.body.breakdown && typeof req.body.breakdown === 'object') {
    const clean = {}
    for (const value of DENOMINATIONS) {
      const howMany = req.body.breakdown[String(value)]
      if (howMany === undefined || howMany === 0) continue
      if (!Number.isInteger(howMany) || howMany < 0) return res.status(400).json({ error: 'Each number of notes and coins must be a whole number' })
      clean[String(value)] = howMany
    }
    const sum = round(Object.entries(clean).reduce((total, [value, howMany]) => total + Number(value) * howMany, 0))
    if (sum !== counted) return res.status(400).json({ error: 'The notes and coins don’t add up to the total counted' })
    breakdown = JSON.stringify(clean)
  }

  db.transaction(() => {
    if (!dayClosed) {
      const dayTotal = dailyTotals(date).dayTotal
      db.prepare('INSERT INTO daily_takings (date, day_total, card_total, cash_total) VALUES (?, ?, ?, ?)').run(
        date,
        dayTotal,
        card_total,
        round(dayTotal - card_total),
      )
      logEdit({
        action: 'Card amount saved at the till',
        details: `${date}: card ${pounds(card_total)}, cash ${pounds(round(dayTotal - card_total))}, day total ${pounds(dayTotal)}`,
        amount: card_total,
        staffId: req.staffId,
      })
    }
    db.prepare(
      `INSERT INTO cash_counts (date, opening_float, float_by, float_at, counted, breakdown, left_in, note, counted_by, counted_at)
       VALUES (@date, @float, @staff, datetime('now', 'localtime'), @counted, @breakdown, @left_in, @note, @staff, datetime('now', 'localtime'))
       ON CONFLICT (date) DO UPDATE SET opening_float = COALESCE(cash_counts.opening_float, excluded.opening_float),
         float_by = COALESCE(cash_counts.float_by, excluded.float_by), float_at = COALESCE(cash_counts.float_at, excluded.float_at),
         counted = excluded.counted, breakdown = excluded.breakdown, left_in = excluded.left_in, note = excluded.note,
         counted_by = excluded.counted_by, counted_at = excluded.counted_at`,
    ).run({ date, float, staff: req.staffId, counted, breakdown, left_in, note: note || null })
    if (before?.counted != null) {
      logEdit({ action: 'Cash counted again', details: `${date}: ${pounds(before.counted)} → ${pounds(counted)}`, amount: counted, staffId: req.staffId })
    }
  })()

  res.json(cashDrawer(date))
})

export default router
