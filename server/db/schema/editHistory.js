// The admin's edit history table.
import db from '../connection.js'

// Edit history for the admin: one row for every ticket cancel (and its refund) and every
// card amount saved or changed, with who did it and when. Rows are only ever added.
// staff_id is the worker signed in on the till; by_admin = 1 when it was done in Admin.
db.exec(`
  CREATE TABLE IF NOT EXISTS edit_history (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    action              TEXT NOT NULL,
    details             TEXT NOT NULL,
    amount              REAL,
    staff_id            INTEGER REFERENCES staff (id),
    by_admin            INTEGER NOT NULL DEFAULT 0 CHECK (by_admin IN (0, 1)),
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
