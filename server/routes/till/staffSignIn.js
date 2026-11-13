// Signing a shop worker in and out on the till with their name and PIN.
import express from 'express'
import db from '../../db/index.js'
import { signedInStaff, staffRequired, signIn, signOut, checkPin } from '../../auth/staffAuth.js'

const router = express.Router()

// The workers to pick from when signing in on the till (names only)
router.get('/api/staff', (req, res) => {
  res.json(db.prepare('SELECT id, name FROM staff WHERE active = 1 ORDER BY name').all())
})

// Who is signed in on this till, and whether signing in is needed at all
router.get('/api/staff/session', (req, res) => {
  res.json({ staff: signedInStaff(req), staffRequired: staffRequired() })
})

// Sign in with { staff_id, pin }
router.post('/api/staff/login', (req, res) => {
  const worker = db.prepare('SELECT * FROM staff WHERE id = ? AND active = 1').get(req.body.staff_id)
  if (!worker || !checkPin(worker, req.body.pin)) {
    return res.status(401).json({ error: 'Wrong PIN' })
  }
  signIn(res, worker.id)
  res.json({ staff: { id: worker.id, name: worker.name } })
})

router.post('/api/staff/logout', (req, res) => {
  signOut(req, res)
  res.json({ staff: null })
})

export default router
