// The database, with every table created (or brought up to date) before anything uses it.
//
// Each file in schema/ creates one group of tables when they don't exist yet, and adds any
// columns that were added to the app later, keeping the data already there. They run in
// this order, once, when the server starts.
import db, { DB_PATH } from './connection.js'
import './schema/money.js' // products, sales, till spending, saved day takings
import './schema/staff.js' // shop workers and who is signed in on the till
import './schema/editHistory.js' // the admin's edit history
import './schema/priceLists.js' // dry cleaning price list and service wash load sizes
import './schema/tickets.js' // dry cleaning and service wash tickets and their items
import './schema/admin.js' // admin password and log-ins
import './schema/printer.js' // receipt printer settings
import './schema/cashCounts.js' // the cash drawer: opening float and end of day count
import './schema/customers.js' // notes the admin keeps about customers
import './schema/loyalty.js' // loyalty rewards: every Nth ticket gets a discount
import './schema/backups.js' // backup settings: the USB stick or drive that gets a second copy

export { DB_PATH }
export default db
