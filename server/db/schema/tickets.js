// The dry cleaning and service wash ticket tables, the items on each dry cleaning ticket,
// and every column added to the tickets since the first version (in the order they were added).
import db from '../connection.js'
import { addStaffColumn } from '../columns.js'

// Dry cleaning tickets. The id is the ticket number.
// pickup_time is a day of the week, matching the till form.
// price is in pounds (GBP) with up to 2 decimal places, e.g. 12.50.
// paid is true/false: SQLite has no boolean type, so 1 means paid and 0 means not paid.
// created_at is filled in automatically with the shop's local date and time.
db.exec(`
  CREATE TABLE IF NOT EXISTS dry_cleaning_tickets (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name       TEXT NOT NULL CHECK (trim(customer_name) <> ''),
    phone_number        TEXT NOT NULL,
    clothes_description TEXT NOT NULL,
    number_of_pieces    INTEGER NOT NULL CHECK (typeof(number_of_pieces) = 'integer' AND number_of_pieces >= 1),
    pickup_time         TEXT NOT NULL CHECK (pickup_time IN (
                          'Monday', 'Tuesday', 'Wednesday', 'Thursday',
                          'Friday', 'Saturday', 'Sunday')),
    price               REAL NOT NULL CHECK (price >= 0 AND price = round(price, 2)),
    paid                INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// Add the paid column to a tickets table created before it existed, keeping its tickets
const columns = db.prepare('PRAGMA table_info(dry_cleaning_tickets)').all()
if (!columns.some((column) => column.name === 'paid')) {
  db.exec('ALTER TABLE dry_cleaning_tickets ADD COLUMN paid INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1))')
}

// Service wash tickets: the same idea as dry cleaning, with a load description
// instead of clothes and no number of pieces.
db.exec(`
  CREATE TABLE IF NOT EXISTS service_wash_tickets (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name       TEXT NOT NULL CHECK (trim(customer_name) <> ''),
    phone_number        TEXT NOT NULL,
    load_description    TEXT NOT NULL,
    pickup_time         TEXT NOT NULL CHECK (pickup_time IN (
                          'Monday', 'Tuesday', 'Wednesday', 'Thursday',
                          'Friday', 'Saturday', 'Sunday')),
    price               REAL NOT NULL CHECK (price >= 0 AND price = round(price, 2)),
    paid                INTEGER NOT NULL DEFAULT 0 CHECK (paid IN (0, 1)),
    created_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

// paid_at is when a ticket was paid: straight away when the ticket was made,
// or later when the customer collects and pays. The day's totals count a ticket
// on the day it was paid. Older tickets get the column added here, keeping their data;
// tickets that were already paid are counted as paid when they were made.
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'paid_at')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN paid_at TEXT`)
    db.exec(`UPDATE ${table} SET paid_at = created_at WHERE paid = 1`)
  }
}

// collected is true/false like paid: 0 when the ticket is made, 1 once the customer
// has picked up their items. collected_at is when that happened.
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'collected')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN collected INTEGER NOT NULL DEFAULT 0 CHECK (collected IN (0, 1))`)
    db.exec(`ALTER TABLE ${table} ADD COLUMN collected_at TEXT`)
  }
}

// cancelled is true/false like paid: 1 once a ticket has been cancelled at the till
// (only allowed on the day it was made). cancelled_at is when that happened.
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'cancelled')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN cancelled INTEGER NOT NULL DEFAULT 0 CHECK (cancelled IN (0, 1))`)
    db.exec(`ALTER TABLE ${table} ADD COLUMN cancelled_at TEXT`)
  }
}

// Who did what: staff_id is the worker who made the ticket. Tickets also record who took
// the payment (if paid later), who collected and who cancelled them.
// These are empty on tickets made before staff names were added.
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  addStaffColumn(table, 'staff_id')
  addStaffColumn(table, 'paid_by')
  addStaffColumn(table, 'collected_by')
  addStaffColumn(table, 'cancelled_by')
}

// imported = 1 marks a ticket that holds a whole day's dry cleaning or service wash money
// brought in from the old spreadsheet. It counts towards the day's money, but not as a
// real customer ticket (ticket counts, customers, search and the till list leave it out).
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'imported')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN imported INTEGER NOT NULL DEFAULT 0 CHECK (imported IN (0, 1))`)
  }
}

// deposit is money taken for a dry cleaning or service wash ticket when it's made (0 if none).
// The rest (price - deposit) is paid on collection. A deposit counts on the day it was taken,
// and the rest on the day it's paid.
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'deposit')) {
    db.exec(
      `ALTER TABLE ${table} ADD COLUMN deposit REAL NOT NULL DEFAULT 0 CHECK (deposit >= 0 AND deposit = round(deposit, 2))`,
    )
  }
}

// discount is money taken off a dry cleaning or service wash ticket (0 if none). price is what
// the customer pays after the discount, so the totals need no change; price + discount is the
// price before it, shown on the printed ticket.
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'discount')) {
    db.exec(
      `ALTER TABLE ${table} ADD COLUMN discount REAL NOT NULL DEFAULT 0 CHECK (discount >= 0 AND discount = round(discount, 2))`,
    )
  }
}

// refunded is money given back to the customer when a ticket was cancelled (0 if none).
// It is taken off that kind's money (dry cleaning or service wash) on the day of the cancel,
// instead of being saved as till spending. Refunds saved as till spending before this
// ("Dry cleaning ticket 12 - cancelled") are moved onto their tickets once; the day totals
// stay the same, as both were counted on the day of the cancel.
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'refunded')) {
    db.exec(
      `ALTER TABLE ${table} ADD COLUMN refunded REAL NOT NULL DEFAULT 0 CHECK (refunded >= 0 AND refunded = round(refunded, 2))`,
    )
    const label = table === 'dry_cleaning_tickets' ? 'Dry cleaning' : 'Service wash'
    db.transaction(() => {
      for (const spending of db.prepare('SELECT * FROM till_spending WHERE description LIKE ?').all(`${label} ticket % - cancelled`)) {
        const id = spending.description.match(/ticket (\d+) - cancelled$/)?.[1]
        if (!id) continue
        const moved = db.prepare(`UPDATE ${table} SET refunded = refunded + ? WHERE id = ? AND cancelled = 1`).run(spending.amount, id)
        if (moved.changes) db.prepare('DELETE FROM till_spending WHERE id = ?').run(spending.id)
      }
    })()
  }
}

// The items on each dry cleaning ticket, e.g. 2 × Shirt (dry clean) at £3.50.
// item_name and unit_price are copied from the price list when the ticket is made,
// so later price changes don't change old tickets.
db.exec(`
  CREATE TABLE IF NOT EXISTS ticket_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id           INTEGER NOT NULL REFERENCES dry_cleaning_tickets (id),
    price_list_id       INTEGER REFERENCES price_list (id),
    item_name           TEXT NOT NULL,
    service             TEXT NOT NULL CHECK (service IN ('clean', 'press')),
    quantity            INTEGER NOT NULL CHECK (typeof(quantity) = 'integer' AND quantity >= 1),
    unit_price          REAL NOT NULL CHECK (unit_price >= 0 AND unit_price = round(unit_price, 2))
  )
`)

// load_size is the size picked from the service wash price list, e.g. "Medium load"
// (empty on tickets made before the price list existed)
if (!db.prepare('PRAGMA table_info(service_wash_tickets)').all().some((c) => c.name === 'load_size')) {
  db.exec('ALTER TABLE service_wash_tickets ADD COLUMN load_size TEXT')
}

// ready_at is when the clothes came back and the ticket was marked ready to collect (empty
// until then), and rack_slot is where they hang, e.g. "14" or "B3" (empty if not given)
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'ready_at')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ready_at TEXT`)
    db.exec(`ALTER TABLE ${table} ADD COLUMN rack_slot TEXT`)
  }
}

// Reminders for tickets left in the shop (Admin → Uncollected tickets): how many WhatsApp
// reminders were sent, the last one, and when the final "will be given to charity" notice went
for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  const ticketColumns = db.prepare(`PRAGMA table_info(${table})`).all()
  if (!ticketColumns.some((column) => column.name === 'reminder_count')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN reminder_count INTEGER NOT NULL DEFAULT 0`)
    db.exec(`ALTER TABLE ${table} ADD COLUMN reminded_at TEXT`)
    db.exec(`ALTER TABLE ${table} ADD COLUMN final_notice_at TEXT`)
  }
}
