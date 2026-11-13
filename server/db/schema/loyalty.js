// Loyalty rewards set in Admin → Loyalty rewards, e.g. "every 10th dry cleaning ticket gets 20% off".
// One rule per kind of ticket:
//   kind     'dryCleaning' or 'serviceWash'
//   every    the reward is on every this-many-th ticket of that kind, e.g. 10
//   percent  taken off that ticket's price, e.g. 20
//   active   1 while the reward is on; 0 keeps the numbers but stops offering it
// On tickets, loyalty_percent is the reward given on that ticket (empty when none). The count
// for the next reward starts again after it. See lib/loyalty.js.
import db from '../connection.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS loyalty_rules (
    kind                TEXT PRIMARY KEY CHECK (kind IN ('dryCleaning', 'serviceWash')),
    every               INTEGER NOT NULL CHECK (typeof(every) = 'integer' AND every >= 2),
    percent             REAL NOT NULL CHECK (percent > 0 AND percent <= 100),
    active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now', 'localtime'))
  )
`)

for (const table of ['dry_cleaning_tickets', 'service_wash_tickets']) {
  if (!db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === 'loyalty_percent')) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN loyalty_percent REAL`)
  }
}
