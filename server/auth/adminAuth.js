// Admin password and log-in sessions.
//
// How it works:
// - The password is never stored. Only a hash made with scrypt (built into Node) and a
//   random salt are kept in the admin_password table.
// - Logging in with the right password creates a random session token. The browser keeps
//   it in an httpOnly, SameSite=Strict cookie (page scripts can't read it), and the
//   database keeps only a hash of it, with an expiry 12 hours later.
// - requireAdmin checks that cookie on every admin route, so the reports can't be read
//   without logging in, even by calling the server directly.
import crypto from 'node:crypto'
import db from '../db/index.js'
import { hashPassword, hashToken } from './hashing.js'
import { tokenFromRequest } from './cookies.js'

const COOKIE_NAME = 'admin_session'
const SESSION_HOURS = 12
const MIN_PASSWORD_LENGTH = 8

// true once an admin password has been set
export function hasPassword() {
  return Boolean(db.prepare('SELECT 1 FROM admin_password WHERE id = 1').get())
}

// Saves a new password (as a hash with a fresh salt) and logs out every browser
export function setPassword(password) {
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`The password must be at least ${MIN_PASSWORD_LENGTH} characters`)
  }
  const salt = crypto.randomBytes(16).toString('hex')
  db.prepare(`
    INSERT INTO admin_password (id, password_hash, salt) VALUES (1, ?, ?)
    ON CONFLICT (id) DO UPDATE SET
      password_hash = excluded.password_hash,
      salt = excluded.salt,
      updated_at = datetime('now', 'localtime')
  `).run(hashPassword(password, salt), salt)
  db.prepare('DELETE FROM admin_sessions').run()
}

// true if the password matches the saved one
export function checkPassword(password) {
  const saved = db.prepare('SELECT * FROM admin_password WHERE id = 1').get()
  if (!saved || typeof password !== 'string') return false
  const given = Buffer.from(hashPassword(password, saved.salt), 'hex')
  const expected = Buffer.from(saved.password_hash, 'hex')
  // Compare in a way that takes the same time whether it matches or not
  return crypto.timingSafeEqual(given, expected)
}

// ---------- Sessions ----------

// true if the request comes from a logged-in browser whose session hasn't expired
export function isLoggedIn(req) {
  const token = tokenFromRequest(req, COOKIE_NAME)
  if (!token) return false
  // Remove expired sessions first, so an old cookie stops working
  db.prepare("DELETE FROM admin_sessions WHERE expires_at <= datetime('now', 'localtime')").run()
  return Boolean(db.prepare('SELECT 1 FROM admin_sessions WHERE token_hash = ?').get(hashToken(token)))
}

// Starts a session and sends the cookie to the browser
export function logIn(res) {
  const token = crypto.randomBytes(32).toString('hex')
  db.prepare(`
    INSERT INTO admin_sessions (token_hash, expires_at)
    VALUES (?, datetime('now', 'localtime', '+${SESSION_HOURS} hours'))
  `).run(hashToken(token))
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_HOURS * 60 * 60}`,
  )
}

// Ends this browser's session and clears its cookie
export function logOut(req, res) {
  const token = tokenFromRequest(req, COOKIE_NAME)
  if (token) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token))
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`)
}

// Express middleware: lets the request through only if the admin is logged in
export function requireAdmin(req, res, next) {
  if (isLoggedIn(req)) return next()
  res.status(401).json({ error: 'Please log in as admin' })
}

export { MIN_PASSWORD_LENGTH }
