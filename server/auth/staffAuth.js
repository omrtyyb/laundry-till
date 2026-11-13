// Shop workers: their PINs and which worker is signed in on the till.
//
// - Each worker has a name and a short PIN (4 to 6 digits). Only a scrypt hash of the
//   PIN is stored, like the admin password.
// - Signing in on the till gives the browser a cookie (12 hours), so every ticket, sale
//   and refund made there is saved with that worker's id.
// - requireStaff is used on every till route that saves something. If no workers have been
//   added yet, the till keeps working without names.
import crypto from 'node:crypto'
import db from '../db/index.js'
import { hashPassword, hashToken } from './hashing.js'
import { tokenFromRequest } from './cookies.js'

const COOKIE_NAME = 'staff_session'
const SESSION_HOURS = 12

// Checks a PIN is 4 to 6 digits. Returns an error message, or null if it's fine.
export function checkPinFormat(pin) {
  return typeof pin === 'string' && /^\d{4,6}$/.test(pin) ? null : 'The PIN must be 4 to 6 digits'
}

// The hash and salt to save for a PIN
export function hashPin(pin) {
  const salt = crypto.randomBytes(16).toString('hex')
  return { pin_hash: hashPassword(pin, salt), pin_salt: salt }
}

// true if the PIN matches this worker's saved one
export function checkPin(worker, pin) {
  if (typeof pin !== 'string') return false
  const given = Buffer.from(hashPassword(pin, worker.pin_salt), 'hex')
  const expected = Buffer.from(worker.pin_hash, 'hex')
  return crypto.timingSafeEqual(given, expected)
}

// true once the admin has added at least one worker; then the till needs someone signed in
export function staffRequired() {
  return Boolean(db.prepare('SELECT 1 FROM staff WHERE active = 1').get())
}

// The worker signed in on this browser ({ id, name }), or null
export function signedInStaff(req) {
  const token = tokenFromRequest(req, COOKIE_NAME)
  if (!token) return null
  db.prepare("DELETE FROM staff_sessions WHERE expires_at <= datetime('now', 'localtime')").run()
  return (
    db
      .prepare(`
        SELECT staff.id, staff.name FROM staff_sessions
        JOIN staff ON staff.id = staff_sessions.staff_id
        WHERE token_hash = ? AND staff.active = 1
      `)
      .get(hashToken(token)) || null
  )
}

// Signs a worker in on this browser
export function signIn(res, staffId) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare(`
    INSERT INTO staff_sessions (token_hash, staff_id, expires_at)
    VALUES (?, ?, datetime('now', 'localtime', '+${SESSION_HOURS} hours'))
  `).run(hashToken(token), staffId)
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 60 * 60}`,
  )
}

// Signs the worker out of this browser
export function signOut(req, res) {
  const token = tokenFromRequest(req, COOKIE_NAME)
  if (token) db.prepare('DELETE FROM staff_sessions WHERE token_hash = ?').run(hashToken(token))
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`)
}

// Express middleware for till routes that save something. Puts the signed-in worker's id
// in req.staffId (null if no workers have been added yet), or turns the request away.
export function requireStaff(req, res, next) {
  const worker = signedInStaff(req)
  if (worker) {
    req.staffId = worker.id
    return next()
  }
  if (!staffRequired()) {
    req.staffId = null
    return next()
  }
  res.status(401).json({ error: 'Please sign in with your name and PIN first' })
}
