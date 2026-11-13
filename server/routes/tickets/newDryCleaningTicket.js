// Making a new dry cleaning ticket, at the till (POST /api/dry-cleaning-tickets) or in
// Admin → Tickets (POST /api/admin/tickets/dryCleaning).
import express from 'express'
import db from '../../db/index.js'
import { round } from '../../lib/money.js'
import { today } from '../../lib/dates.js'
import { refreshTakings } from '../../lib/takings.js'
import { staffOrAdmin } from '../../auth/accessRules.js'
import { logNewTicket } from '../../tickets/ticketHistory.js'
import { checkDiscountAndDeposit } from '../../tickets/ticketMoneyChecks.js'
import { loyaltyForNewTicket } from '../../lib/loyalty.js'

const router = express.Router()

// Save a new dry cleaning ticket and send back the saved ticket
router.post(['/api/dry-cleaning-tickets', '/api/admin/tickets/dryCleaning'], staffOrAdmin, (req, res) => {
  const {
    customer_name,
    phone_number,
    clothes_description,
    number_of_pieces,
    pickup_time,
    price: fullPrice, // before any discount
    paid,
    deposit = 0,
    discount = 0,
    items = [],
  } = req.body

  if (!customer_name || !phone_number || !clothes_description || !number_of_pieces || !pickup_time || fullPrice == null) {
    return res.status(400).json({ error: 'Please fill in every field' })
  }

  if (!Number.isInteger(number_of_pieces) || number_of_pieces < 1) {
    return res.status(400).json({ error: 'Number of pieces must be a whole number, 1 or more' })
  }

  // A loyalty reward the worker chose to give (body.loyalty) adds its money off to any other discount
  const loyalty = loyaltyForNewTicket('dryCleaning', req.body, fullPrice)
  if (loyalty.error) return res.status(400).json({ error: loyalty.error })
  const checked = checkDiscountAndDeposit({ fullPrice, discount: typeof discount === 'number' ? round(discount + loyalty.amount) : discount, deposit, paid })
  if (checked.error) return res.status(400).json({ error: checked.error })
  const { price } = checked

  // Items picked from the price list, e.g. [{ price_list_id: 2, service: 'clean', quantity: 2, unit_price: 3.5 }].
  // Each must be on the price list, and its price within that item's range.
  if (!Array.isArray(items)) {
    return res.status(400).json({ error: 'The items are not in the right form' })
  }
  const lines = []
  for (const item of items) {
    const listed = db.prepare('SELECT * FROM price_list WHERE id = ? AND active = 1').get(item.price_list_id)
    if (!listed) return res.status(400).json({ error: 'One of the items is not on the price list' })
    if (item.service !== 'clean' && item.service !== 'press') {
      return res.status(400).json({ error: 'Each item must be dry clean or press only' })
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      return res.status(400).json({ error: 'Each item needs a whole number of 1 or more' })
    }
    const [min, max] =
      item.service === 'clean' ? [listed.clean_min, listed.clean_max] : [listed.press_min, listed.press_max]
    if (typeof item.unit_price !== 'number' || item.unit_price < min || item.unit_price > max) {
      return res.status(400).json({
        error:
          min === max
            ? `The price for ${listed.name} must be £${min.toFixed(2)}`
            : `The price for ${listed.name} must be between £${min.toFixed(2)} and £${max.toFixed(2)}`,
      })
    }
    lines.push({ ...item, item_name: listed.name })
  }

  try {
    // The ticket and its items are saved together, or not at all
    const saveTicket = db.transaction(() => {
      const result = db
        .prepare(
          `
        INSERT INTO dry_cleaning_tickets
          (customer_name, phone_number, clothes_description, number_of_pieces, pickup_time, price, paid, paid_at, staff_id, deposit, discount, loyalty_percent)
        VALUES (?, ?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now', 'localtime') END, ?, ?, ?, ?)
      `,
        )
        .run(
          customer_name,
          phone_number,
          clothes_description,
          number_of_pieces,
          pickup_time,
          price,
          paid ? 1 : 0, // The database stores true as 1 and false as 0
          paid ? 1 : 0, // If paid now, paid_at is set to now
          req.staffId, // the worker signed in on the till
          paid ? 0 : deposit, // money taken now towards the price
          round(discount + loyalty.amount),
          loyalty.percent,
        )
      const addItem = db.prepare(`
      INSERT INTO ticket_items (ticket_id, price_list_id, item_name, service, quantity, unit_price)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
      for (const line of lines) {
        addItem.run(
          result.lastInsertRowid,
          line.price_list_id,
          line.item_name,
          line.service,
          line.quantity,
          line.unit_price,
        )
      }
      return result.lastInsertRowid
    })

    const ticket = db.prepare('SELECT * FROM dry_cleaning_tickets WHERE id = ?').get(saveTicket())
    if (req.byAdmin) logNewTicket('Dry cleaning', ticket)

    refreshTakings(today()) // keep today's saved card/cash totals up to date
    res.status(201).json(ticket)
  } catch (err) {
    // For example a pickup day that isn't Monday to Sunday
    res.status(400).json({ error: err.message })
  }
})

export default router
