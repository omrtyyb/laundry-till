// Product sales at the till: the products list, saving a sale, and one sale's details.
import express from 'express'
import db from '../../db/index.js'
import { today } from '../../lib/dates.js'
import { refreshTakings } from '../../lib/takings.js'
import { requireStaff } from '../../auth/staffAuth.js'

const router = express.Router()

// One sale or one till spending by its id, for the details pop-up on the till's activity list
router.get('/api/sales/:id', (req, res) => {
  const sale = db
    .prepare(
      'SELECT sales.*, staff.name AS made_by FROM sales LEFT JOIN staff ON staff.id = sales.staff_id WHERE sales.id = ?',
    )
    .get(req.params.id)
  if (!sale) return res.status(404).json({ error: `There is no sale number ${req.params.id}` })
  res.json(sale)
})

// List the products for the selling screen (not ones the admin removed)
router.get('/api/products', (req, res) => {
  const products = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id').all()
  res.json(products)
})

// Save a sale. Send either:
//   { product_id, quantity }               for a product from the list (the price comes from the database)
//   { item_name, unit_price, quantity }    for any other item typed in at the till
router.post('/api/sales', requireStaff, (req, res) => {
  const { product_id, quantity } = req.body
  let { item_name, unit_price } = req.body

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ error: 'Quantity must be a whole number, 1 or more' })
  }

  if (product_id) {
    const product = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(product_id)
    if (!product) {
      return res.status(400).json({ error: 'That product does not exist' })
    }
    item_name = product.name
    unit_price = product.price
  } else if (!item_name || unit_price == null) {
    return res.status(400).json({ error: 'Please enter what the item is and its price' })
  }

  try {
    const result = db
      .prepare(
        `
        INSERT INTO sales (product_id, item_name, quantity, unit_price, staff_id)
        VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(product_id || null, item_name, quantity, unit_price, req.staffId)

    const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(result.lastInsertRowid)
    refreshTakings(today()) // keep today's saved card/cash totals up to date
    res.status(201).json(sale)
  } catch (err) {
    // For example a price with more than 2 decimal places
    res.status(400).json({ error: err.message })
  }
})

export default router
