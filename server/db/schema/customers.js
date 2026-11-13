// Notes the admin keeps about a customer, e.g. "No starch on shirts" or "Pays by card".
// Customers have no table of their own: a customer is everyone with the same phone number on
// their tickets (or, when no real phone number was given, the same name). See lib/customers.js.
//   customer_key  "p:07700900123" (by phone) or "n:sarah" (by name), from customerKey()
import db from '../connection.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS customer_notes (
    customer_key        TEXT PRIMARY KEY,
    note                TEXT NOT NULL,
    updated_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
