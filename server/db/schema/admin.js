// The admin password and admin log-in tables.
import db from '../connection.js'

// The admin password. Only a scrypt hash and its random salt are stored, never the
// password itself. There is at most one row (id = 1). Set it with: npm run set-password
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_password (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    password_hash       TEXT NOT NULL,
    salt                TEXT NOT NULL,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// Admin log-ins. Each row is one logged-in browser. token_hash is a SHA-256 hash of the
// random token kept in that browser's cookie, so the database alone can't be used to log in.
db.exec(`
  CREATE TABLE IF NOT EXISTS admin_sessions (
    token_hash          TEXT PRIMARY KEY,
    expires_at          TEXT NOT NULL,
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
