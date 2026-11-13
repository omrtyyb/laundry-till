// Till spending: money taken out of the till to pay for something.
import express from 'express'
import db from '../../db/index.js'
import { today } from '../../lib/dates.js'
import { refreshTakings } from '../../lib/takings.js'
import { requireStaff } from '../../auth/staffAuth.js'

const router = express.Router()

// One till spending by its id, for the details pop-up on the till's activity list
router.get('/api/till-spending/:id', (req, res) => {
  const spending = db
    .prepare(
      'SELECT till_spending.*, staff.name AS made_by FROM till_spending LEFT JOIN staff ON staff.id = till_spending.staff_id WHERE till_spending.id = ?',
    )
    .get(req.params.id)
  if (!spending) return res.status(404).json({ error: `There is no till spending number ${req.params.id}` })
  res.json(spending)
})

// Save money taken out of the till, e.g. { description: "Milk", amount: 1.2 }
router.post('/api/till-spending', requireStaff, (req, res) => {
  const { description, amount } = req.body

  if (!description || amount == null) {
    return res.status(400).json({ error: 'Please enter a description and an amount' })
  }

  try {
    const result = db
      .prepare('INSERT INTO till_spending (description, amount, staff_id) VALUES (?, ?, ?)')
      .run(description, amount, req.staffId)

    const spending = db.prepare('SELECT * FROM till_spending WHERE id = ?').get(result.lastInsertRowid)
    refreshTakings(today()) // keep today's saved card/cash totals up to date
    res.status(201).json(spending)
  } catch (err) {
    // For example an amount of £0
    res.status(400).json({ error: err.message })
  }
})

export default router
