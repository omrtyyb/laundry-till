// Tables for the shop workers and their till sign-ins.
import db from '../connection.js'

// Shop workers. Each picks their name on the till and types their PIN, so every ticket,
// sale and refund records who did it. Only a scrypt hash of the PIN is stored.
// active = 0 means the admin removed them: they can't sign in, but their name stays on old entries.
db.exec(`
  CREATE TABLE IF NOT EXISTS staff (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL UNIQUE CHECK (trim(name) <> ''),
    pin_hash            TEXT NOT NULL,
    pin_salt            TEXT NOT NULL,
    active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// Which worker is signed in on a till. Works like admin_sessions: the browser keeps a
// random token in a cookie, and only its hash is stored here.
db.exec(`
  CREATE TABLE IF NOT EXISTS staff_sessions (
    token_hash          TEXT PRIMARY KEY,
    staff_id            INTEGER NOT NULL REFERENCES staff (id),
    expires_at          TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
