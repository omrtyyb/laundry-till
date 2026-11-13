// The receipt printer settings table. The settings themselves are explained in
// printing/printerSettings.js.
import db from '../connection.js'

// The printer settings: one row holding them as JSON
db.exec(`
  CREATE TABLE IF NOT EXISTS printer_settings (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    settings            TEXT NOT NULL,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
