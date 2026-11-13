// The till's activity list (the sidebar).
import express from 'express'
import db from '../../db/index.js'

const router = express.Router()

// Everything that has happened at the till, newest first, for the till's sidebar.
// Each table keeps its own numbering, so the same id can appear for two different types.
// Once the admin saves a day's card and cash, that day is closed: the list only shows
// entries from after the last closed day, so it starts empty for the next day.
// Anything added on the closed day after it was closed still shows, so it isn't missed.
// (For paid-later rows, created_at is the time they were paid.)
router.get('/api/till-activity', (req, res) => {
  const lastClosed = db.prepare('SELECT date, saved_at FROM daily_takings ORDER BY date DESC LIMIT 1').get() || {
    date: '',
    saved_at: '',
  }

  const activity = db
    .prepare(
      `
      SELECT * FROM (
      SELECT 'dryCleaning' AS type, id, 'Dry cleaning: ' || customer_name AS description,
             price AS amount, paid, collected, cancelled, created_at, staff_id, deposit, ready_at, rack_slot
        FROM dry_cleaning_tickets WHERE imported = 0
      UNION ALL
      SELECT 'serviceWash', id, 'Service wash: ' || customer_name,
             price, paid, collected, cancelled, created_at, staff_id, deposit, ready_at, rack_slot
        FROM service_wash_tickets WHERE imported = 0
      UNION ALL
      -- A ticket paid after it was made gets a second row, at the time of payment,
      -- because that's when the money came in. It only shows when the ticket itself
      -- isn't on the list (made before the last closed day); otherwise the ticket's own
      -- row just shows it as paid or collected, so each ticket is listed once.
      -- (for a ticket with a deposit, the amount is only the rest that was paid)
      SELECT 'dryCleaningCollected', id,
             CASE WHEN collected = 1 AND collected_at = paid_at THEN 'Collected and paid: ' ELSE 'Paid: ' END
               || 'dry cleaning, ' || customer_name,
             price - deposit, paid, collected, cancelled, paid_at,
             CASE WHEN collected = 1 AND collected_at = paid_at THEN collected_by ELSE paid_by END, 0, ready_at, rack_slot
        FROM dry_cleaning_tickets
       WHERE paid = 1 AND paid_at > created_at AND imported = 0
         AND NOT (date(created_at) > @date OR created_at > @savedAt)
      UNION ALL
      SELECT 'serviceWashCollected', id,
             CASE WHEN collected = 1 AND collected_at = paid_at THEN 'Collected and paid: ' ELSE 'Paid: ' END
               || 'service wash, ' || customer_name,
             price - deposit, paid, collected, cancelled, paid_at,
             CASE WHEN collected = 1 AND collected_at = paid_at THEN collected_by ELSE paid_by END, 0, ready_at, rack_slot
        FROM service_wash_tickets
       WHERE paid = 1 AND paid_at > created_at AND imported = 0
         AND NOT (date(created_at) > @date OR created_at > @savedAt)
      UNION ALL
      SELECT 'sale', id, 'Sold ' || quantity || ' x ' || item_name,
             round(quantity * unit_price, 2), NULL, NULL, NULL, created_at, staff_id, 0, NULL, NULL
        FROM sales
      UNION ALL
      SELECT 'spending', id, 'Till spend: ' || description,
             amount, NULL, NULL, NULL, created_at, staff_id, 0, NULL, NULL
        FROM till_spending
      ) AS activity
      -- staff_name is the worker who made the entry (or collected it, for collected rows)
      LEFT JOIN (SELECT id AS worker_id, name AS staff_name FROM staff) ON worker_id = activity.staff_id
      WHERE date(created_at) > @date OR created_at > @savedAt
      ORDER BY created_at DESC, id DESC
    `,
    )
    .all({ date: lastClosed.date, savedAt: lastClosed.saved_at })

  res.json(activity)
})

export default router
