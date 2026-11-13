// Admin → Top customers and busiest hours.
import express from 'express'
import db from '../../db/index.js'

const router = express.Router()

// ---------- Top customers and busiest hours ----------
// Customers are matched by phone number across both kinds of ticket.
// Only paid tickets count towards what a customer has spent. Cancelled tickets and
// imported daily totals from the old spreadsheet don't count.
router.get('/api/reports/customers', (req, res) => {
  const customers = db
    .prepare(`
      WITH tickets AS (
        SELECT customer_name, phone_number, price, paid, deposit, created_at FROM dry_cleaning_tickets WHERE cancelled = 0 AND imported = 0
        UNION ALL
        SELECT customer_name, phone_number, price, paid, deposit, created_at FROM service_wash_tickets WHERE cancelled = 0 AND imported = 0
      )
      SELECT phone_number,
             -- the name on their most recent ticket
             (SELECT customer_name FROM tickets t2 WHERE t2.phone_number = t.phone_number
              ORDER BY created_at DESC LIMIT 1) AS customer_name,
             COUNT(*) AS visits,
             -- fully paid tickets count their price; unpaid ones their deposit, if any
             ROUND(SUM(CASE WHEN paid = 1 THEN price ELSE deposit END), 2) AS spent,
             MAX(created_at) AS last_visit
      FROM tickets t
      GROUP BY phone_number
      ORDER BY spent DESC, visits DESC
      LIMIT 10
    `)
    .all()

  // How many tickets were made in each hour of the day, e.g. 9 means 9:00 to 9:59
  const counts = Object.fromEntries(
    db
      .prepare(`
        SELECT CAST(strftime('%H', created_at) AS INTEGER) AS hour, COUNT(*) AS count FROM (
          SELECT created_at FROM dry_cleaning_tickets WHERE cancelled = 0 AND imported = 0
          UNION ALL
          SELECT created_at FROM service_wash_tickets WHERE cancelled = 0 AND imported = 0
        ) GROUP BY hour
      `)
      .all()
      .map((row) => [row.hour, row.count]),
  )
  const hours = Array.from({ length: 24 }, (_, hour) => ({ hour, count: counts[hour] || 0 }))

  res.json({ customers, hours })
})

export default router
