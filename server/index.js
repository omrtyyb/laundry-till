// Starts the laundry till server: npm run dev (restarts when a file changes) or npm start.
//
// Where things are:
//   app.js        the Express app and the list of every group of routes
//   routes/       what each URL does (admin/, reports/, priceLists/, till/, tickets/)
//   db/           the database file, and the tables in db/schema/
//   lib/          helpers shared by the routes: money, dates, day totals, edit history, backups
//   auth/         the admin password, staff PINs and who may use which routes
//   tickets/      helpers shared by the ticket routes
//   reports/      the numbers and PDFs behind the Admin reports
//   printing/     receipt printer settings, receipt layout and sending to the printer
//   scripts/      commands run by hand: seed, set-password, backup
import app from './app.js'
import db from './db/index.js'
import { refreshAllTakings } from './lib/takings.js'
import { startBackups } from './lib/backups.js'
import { startCopying } from './lib/backupCopies.js'

const PORT = process.env.PORT || 3001

// When the server starts, bring every saved day up to date
refreshAllTakings()
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

startBackups()
startCopying() // second copy on the USB stick, whenever it's plugged in

// Close the database properly when the server is stopped (Ctrl+C, a restart or the computer
// shutting down), so everything is moved from the -wal side file into laundry-till.db
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close()
    db.close()
    process.exit(0)
  })
}
