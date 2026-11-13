// Admin → Staff: add, rename, change the PIN of, remove and bring back shop workers.
import express from 'express'
import db from '../../db/index.js'
import { checkPinFormat, hashPin } from '../../auth/staffAuth.js'

const router = express.Router()

// Every worker, including removed ones (never the PIN)
router.get('/api/admin/staff', (req, res) => {
  res.json(db.prepare('SELECT id, name, active, created_at FROM staff ORDER BY active DESC, name').all())
})

// Add a worker: { name, pin }
router.post('/api/admin/staff', (req, res) => {
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ error: 'Please enter a name' })
  const pinError = checkPinFormat(req.body.pin)
  if (pinError) return res.status(400).json({ error: pinError })
  if (db.prepare('SELECT 1 FROM staff WHERE name = ?').get(name)) {
    return res.status(409).json({ error: `There is already a worker called ${name}` })
  }
  const { pin_hash, pin_salt } = hashPin(req.body.pin)
  const result = db
    .prepare('INSERT INTO staff (name, pin_hash, pin_salt) VALUES (?, ?, ?)')
    .run(name, pin_hash, pin_salt)
  res.status(201).json(db.prepare('SELECT id, name, active FROM staff WHERE id = ?').get(result.lastInsertRowid))
})

// Change a worker's name and/or PIN: { name?, pin? }. A new PIN signs them out everywhere.
router.put('/api/admin/staff/:id', (req, res) => {
  const worker = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)
  if (!worker) return res.status(404).json({ error: 'That worker does not exist' })

  if (req.body.name !== undefined) {
    const name = String(req.body.name).trim()
    if (!name) return res.status(400).json({ error: 'Please enter a name' })
    if (db.prepare('SELECT 1 FROM staff WHERE name = ? AND id <> ?').get(name, worker.id)) {
      return res.status(409).json({ error: `There is already a worker called ${name}` })
    }
    db.prepare('UPDATE staff SET name = ? WHERE id = ?').run(name, worker.id)
  }
  if (req.body.pin !== undefined) {
    const pinError = checkPinFormat(req.body.pin)
    if (pinError) return res.status(400).json({ error: pinError })
    const { pin_hash, pin_salt } = hashPin(req.body.pin)
    db.prepare('UPDATE staff SET pin_hash = ?, pin_salt = ? WHERE id = ?').run(pin_hash, pin_salt, worker.id)
    db.prepare('DELETE FROM staff_sessions WHERE staff_id = ?').run(worker.id)
  }
  res.json(db.prepare('SELECT id, name, active FROM staff WHERE id = ?').get(worker.id))
})

// Remove a worker: they can't sign in any more, but their name stays on past entries.
// They can be brought back with the restore route below.
router.delete('/api/admin/staff/:id', (req, res) => {
  const worker = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id)
  if (!worker) return res.status(404).json({ error: 'That worker does not exist' })
  db.prepare('UPDATE staff SET active = 0 WHERE id = ?').run(worker.id)
  db.prepare('DELETE FROM staff_sessions WHERE staff_id = ?').run(worker.id)
  res.json({ removed: true })
})

// Bring back a removed worker
router.post('/api/admin/staff/:id/restore', (req, res) => {
  const result = db.prepare('UPDATE staff SET active = 1 WHERE id = ?').run(req.params.id)
  if (result.changes === 0) return res.status(404).json({ error: 'That worker does not exist' })
  res.json({ restored: true })
})

export default router
