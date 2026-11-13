// Tables for the money that isn't a ticket: products and their sales, till spending,
// and the card/cash totals saved for each day.
import db from '../connection.js'
import { addStaffColumn } from '../columns.js'

// Products the shop sells over the counter (soap, softener, bag...), each with its current price in pounds.
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL UNIQUE CHECK (trim(name) <> ''),
    price               REAL NOT NULL CHECK (price >= 0 AND price = round(price, 2))
  )
`)

// One row each time something is sold.
// product_id points at the products table, or is empty for an "Other" item typed in at the till.
// item_name and unit_price are saved on every sale, so old sales stay correct
// if a product is renamed or its price changes later.
db.exec(`
  CREATE TABLE IF NOT EXISTS sales (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id          INTEGER REFERENCES products (id),
    item_name           TEXT NOT NULL CHECK (trim(item_name) <> ''),
    quantity            INTEGER NOT NULL CHECK (typeof(quantity) = 'integer' AND quantity >= 1),
    unit_price          REAL NOT NULL CHECK (unit_price >= 0 AND unit_price = round(unit_price, 2)),
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// Money taken out of the till to pay for something, e.g. "Milk for the shop", £1.20.
db.exec(`
  CREATE TABLE IF NOT EXISTS till_spending (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    description         TEXT NOT NULL CHECK (trim(description) <> ''),
    amount              REAL NOT NULL CHECK (amount > 0 AND amount = round(amount, 2)),
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// The day's takings, saved from the Admin page: one row per day.
// day_total is everything taken minus till spending, card_total is what the admin typed in,
// and cash_total is the rest (day_total - card_total).
db.exec(`
  CREATE TABLE IF NOT EXISTS daily_takings (
    date                TEXT PRIMARY KEY,
    day_total           REAL NOT NULL,
    card_total          REAL NOT NULL CHECK (card_total >= 0 AND card_total = round(card_total, 2)),
    cash_total          REAL NOT NULL,
    saved_at            TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)
// staff_id is the worker who made the sale or till spending (empty on entries made
// before staff names were added)
for (const table of ['sales', 'till_spending']) {
  addStaffColumn(table, 'staff_id')
}

// active is 1 for products shown on the till's Sell screen, 0 once the admin removes one
// (kept so old sales still point at it, and it can be brought back)
if (!db.prepare('PRAGMA table_info(products)').all().some((c) => c.name === 'active')) {
  db.exec('ALTER TABLE products ADD COLUMN active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))')
}
