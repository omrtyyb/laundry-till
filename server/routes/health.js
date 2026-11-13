// GET /api/health: is the server running and can it read the database?
import express from 'express'
import db from '../db/index.js'

const router = express.Router()

router.get('/api/health', (req, res) => {
  const dbOk = db.prepare('SELECT 1 AS ok').get().ok === 1
  res.json({ status: 'ok', database: dbOk ? 'connected' : 'error' })
})

export default router
