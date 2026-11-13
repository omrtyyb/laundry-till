// The dry cleaning price list and the service wash load sizes, filled with the shop's
// own prices the first time the server starts.
import db from '../connection.js'
import { PRICE_LIST } from '../defaultPriceList.js'

// The dry cleaning price list. Each item has a Dry clean price and a Press only price;
// a range (e.g. Long coat £13–£20) has a lowest (min) and highest (max) price, a single
// price has min = max. active = 0 means the admin removed it from the till.
const priceListIsNew = !db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'price_list'").get()
db.exec(`
  CREATE TABLE IF NOT EXISTS price_list (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    category            TEXT NOT NULL,
    name                TEXT NOT NULL CHECK (trim(name) <> ''),
    clean_min           REAL NOT NULL CHECK (clean_min >= 0 AND clean_min = round(clean_min, 2)),
    clean_max           REAL NOT NULL CHECK (clean_max >= clean_min AND clean_max = round(clean_max, 2)),
    press_min           REAL NOT NULL CHECK (press_min >= 0 AND press_min = round(press_min, 2)),
    press_max           REAL NOT NULL CHECK (press_max >= press_min AND press_max = round(press_max, 2)),
    active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
  )
`)
// The first time, fill it from the shop's price list (db/defaultPriceList.js)
if (priceListIsNew) {
  const add = db.prepare(
    'INSERT INTO price_list (category, name, clean_min, clean_max, press_min, press_max) VALUES (?, ?, ?, ?, ?, ?)',
  )
  db.transaction(() => {
    for (const item of PRICE_LIST) {
      add.run(item.category, item.name, item.clean[0], item.clean[1], item.press[0], item.press[1])
    }
  })()
}

// The service wash price list: one row per load size, with a lowest and highest price
// (e.g. Small load £14–£16). The till picks a load size and the price must be inside its range.
const serviceWashPricesIsNew = !db
  .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'service_wash_prices'")
  .get()
db.exec(`
  CREATE TABLE IF NOT EXISTS service_wash_prices (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    name                TEXT NOT NULL CHECK (trim(name) <> ''),
    price_min           REAL NOT NULL CHECK (price_min >= 0 AND price_min = round(price_min, 2)),
    price_max           REAL NOT NULL CHECK (price_max >= price_min AND price_max = round(price_max, 2)),
    active              INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1))
  )
`)
// The first time, fill it with the shop's load sizes
if (serviceWashPricesIsNew) {
  const add = db.prepare('INSERT INTO service_wash_prices (name, price_min, price_max) VALUES (?, ?, ?)')
  add.run('Small load', 14, 16)
  add.run('Medium load', 16, 18)
  add.run('Large load / feathers / duvets', 18, 24)
}
