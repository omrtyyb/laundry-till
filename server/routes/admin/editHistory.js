// Admin → Edit history.
import express from 'express'
import db from '../../db/index.js'

const router = express.Router()

// The edit history for Admin, newest first, with who did each change
router.get('/api/admin/history', (req, res) => {
  const history = db
    .prepare(
      `
      SELECT edit_history.*,
             CASE WHEN by_admin = 1 THEN 'Admin' ELSE COALESCE(staff.name, 'No one signed in') END AS done_by
      FROM edit_history
      LEFT JOIN staff ON staff.id = edit_history.staff_id
      ORDER BY edit_history.id DESC
      LIMIT 500
    `,
    )
    .all()
  res.json(history)
})

export default router
