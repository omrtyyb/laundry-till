// Making a new service wash ticket, at the till (POST /api/service-wash-tickets) or in
// Admin → Tickets (POST /api/admin/tickets/serviceWash).
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

// Save a new service wash ticket and send back the saved ticket
router.post(['/api/service-wash-tickets', '/api/admin/tickets/serviceWash'], staffOrAdmin, (req, res) => {
  // price is before any discount
  const {
    customer_name,
    phone_number,
    load_description,
    pickup_time,
    price: fullPrice,
    paid,
    deposit = 0,
    discount = 0,
    load_size_id,
  } = req.body

  if (!customer_name || !phone_number || !load_description || !pickup_time || fullPrice == null) {
    return res.status(400).json({ error: 'Please fill in every field' })
  }

  // The load size from the service wash price list; the price must be inside its range
  const loadSize = db.prepare('SELECT * FROM service_wash_prices WHERE id = ? AND active = 1').get(load_size_id)
  if (!loadSize) return res.status(400).json({ error: 'Please choose the load size' })
  if (typeof fullPrice !== 'number' || fullPrice < loadSize.price_min || fullPrice > loadSize.price_max) {
    return res.status(400).json({
      error:
        loadSize.price_min === loadSize.price_max
          ? `The price for a ${loadSize.name.toLowerCase()} must be £${loadSize.price_min.toFixed(2)}`
          : `The price for a ${loadSize.name.toLowerCase()} must be between £${loadSize.price_min.toFixed(2)} and £${loadSize.price_max.toFixed(2)}`,
    })
  }

  // A loyalty reward the worker chose to give (body.loyalty) adds its money off to any other discount
  const loyalty = loyaltyForNewTicket('serviceWash', req.body, fullPrice)
  if (loyalty.error) return res.status(400).json({ error: loyalty.error })
  const checked = checkDiscountAndDeposit({ fullPrice, discount: typeof discount === 'number' ? round(discount + loyalty.amount) : discount, deposit, paid })
  if (checked.error) return res.status(400).json({ error: checked.error })
  const { price } = checked

  try {
    const result = db
      .prepare(
        `
        INSERT INTO service_wash_tickets
          (customer_name, phone_number, load_description, pickup_time, price, paid, paid_at, staff_id, deposit, discount, load_size, loyalty_percent)
        VALUES (?, ?, ?, ?, ?, ?, CASE WHEN ? = 1 THEN datetime('now', 'localtime') END, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        customer_name,
        phone_number,
        load_description,
        pickup_time,
        price,
        paid ? 1 : 0, // The database stores true as 1 and false as 0
        paid ? 1 : 0, // If paid now, paid_at is set to now
        req.staffId, // the worker signed in on the till
        paid ? 0 : deposit, // money taken now towards the price
        round(discount + loyalty.amount),
        loadSize.name,
        loyalty.percent,
      )

    const ticket = db.prepare('SELECT * FROM service_wash_tickets WHERE id = ?').get(result.lastInsertRowid)
    if (req.byAdmin) logNewTicket('Service wash', ticket)

    refreshTakings(today()) // keep today's saved card/cash totals up to date
    res.status(201).json(ticket)
  } catch (err) {
    // For example a pickup day that isn't Monday to Sunday
    res.status(400).json({ error: err.message })
  }
})

export default router
