# Laundry Till

- `client/` — React front end (Vite). Runs on http://localhost:5173
- `server/` — Node.js back end (Express). Runs on http://localhost:3001

## Running in VS Code

Open two terminals (Terminal → New Terminal, then the split button).

Terminal 1, the server:

    cd server
    npm install
    npm run dev

Terminal 2, the client:

    cd client
    npm install
    npm run dev

Then open http://localhost:5173. Requests from the client to `/api/...` are forwarded to the server.
Check the server with http://localhost:3001/api/health.

## Database

The server uses SQLite through `better-sqlite3`. The database is one file,
`server/data/laundry-till.db`, created automatically the first time the server starts.
Set `DB_PATH` to store it somewhere else.

Backups (`server/lib/backups.js`): the server saves a complete copy when it starts and every night
in `server/data/backups/` (last 30 days plus one per month for a year). Before changing data by hand,
run `npm run backup -- <name>` in `server/`, which makes `data/before-<name>-<date>.db`.
Admin → Backups (`client/src/admin/Backups.jsx`, `server/routes/admin/backups.js`) lists the backups,
has a "Back up now" button (`data/backups/laundry-till-manual-<date>-<time>.db`, never deleted
automatically), and Download, Restore and Delete for each backup.
- Restore (`server/lib/restore.js`) first saves the data as it is now as
  `laundry-till-before-restore-<date>-<time>.db` (restore that to undo), then refills every table
  from the backup while the server keeps running. The admin password, admin log-ins, printer and
  backup settings stay as they are; staff sign in again.
- Second copy on a USB stick / external drive (`server/lib/backupCopies.js`, `backup_settings`
  table): picked on the Backups page; whenever it's plugged in, missing backups are copied into a
  "Laundry till backups" folder on it (checked every minute). `BACKUP_COPY_DIR` still works as a
  fallback folder when no drive is picked. Backups on any plugged-in drive are listed under
  "Restore from a USB stick or external drive" with a Restore button
  (POST /api/admin/backups/restore-from-drive), e.g. to set the till up on a new computer.
- Back up even when the till is closed (`server/lib/backgroundJob.js`,
  `server/scripts/nightly-backup.js`): turned on from the Backups page. Mac: launch agent
  `~/Library/LaunchAgents/com.laundrytill.backup.plist` (22:30 and at login); Windows: scheduled
  task "Laundry till backup" (22:30, catches up if the PC was off); Linux: crontab lines marked
  `# laundry-till-backup` (22:30 and at start-up). Log: `data/backups/background-backup.log`.
Admin → Customers (`client/src/admin/Customers.jsx`, `server/routes/admin/customers.js`,
`server/lib/customers.js`): customers worked out from tickets (same phone number = one customer,
by name when there is no real number), each with totals, an admin note (`customer_notes` table)
and every ticket.
Admin → Loyalty rewards (`client/src/admin/LoyaltyRewards.jsx`, `server/routes/admin/loyalty.js`,
`server/lib/loyalty.js`, table `loyalty_rules`): one rule per kind, every Nth ticket gets X% off.
The new ticket form shows it when due (`client/src/till/LoyaltyOffer.jsx`, ticked by default, the
worker can untick); a given reward is saved as `loyalty_percent` on the ticket and its money off is
added to `discount`. Counting restarts after a ticket with a reward.
Admin → Export to Excel (`client/src/admin/ExcelExport.jsx`, `GET /api/reports/excel?from=&to=`,
`server/reports/excelExport.js`, uses the `exceljs` package): one .xlsx with sheets Daily money,
Dry cleaning, Service wash, Sales, Till spending and Customers, each with SUM totals and filters.
Don't copy `laundry-till.db` by hand while the server is running: new data can still be in
the `-wal` file next to it. Stop the server with Ctrl+C, which closes the database properly.
The connection lives in `server/db/connection.js` and the tables in `server/db/schema/`.

## Where the front-end code lives (`client/src`)

- `App.jsx`: switches between the till screen and the admin page
- `NumberPad.jsx`: the on-screen number pad for touchscreens
- `PrintingBar.jsx`: the thin moving line at the bottom of the screen while a ticket prints
- `Overlay.jsx`: the dark background behind every pop-up; clicking it or pressing Escape closes the pop-up
- `till/`: the till screen
  - `TillPage.jsx`: the five big buttons, the pop-ups they open, and the activity list
  - `TicketForm.jsx` + `ticketTypes.js`: new dry cleaning / service wash ticket
  - `CustomerSuggestions.jsx`: known customers suggested while typing a name or phone
  - `PriceListPicker.jsx`: picking dry cleaning items from the price list
  - `SellForm.jsx`: selling soap, softener, bags and other items
  - `SpendForm.jsx`: money taken out of the till
  - `MoneyInForm.jsx`, `CollectTicket.jsx`, `CollectMachineMoney.jsx`: the Money In pop-up
  - `ActivitySidebar.jsx`: the "Till activity" list on the right
  - `ActivityDetails.jsx`: the pop-up with full details of a clicked list item
  - `StaffSignIn.jsx`: workers pick their name and type their PIN
  - `TillIcons.jsx`: the button icons
- `admin/`: the admin page
  - `AdminPage.jsx`: the menu of reports
  - `DaySummary.jsx` + `TakingsForm.jsx`: one day's totals, and card and cash
  - `TicketsSection.jsx`: Admin → Tickets: a search box (ticket number or name) and three tabs:
    `UncollectedTickets.jsx` (tickets still in the shop) and `TicketList.jsx`
    (every dry cleaning or service wash ticket, sortable). Edit on any ticket opens
    `TicketEditor.jsx`, which can change everything on it (saved to the edit history); `TicketSummary.jsx` is the Ticket summary tab
    (tickets between two dates and times, with totals and a PDF). The dry cleaning and
    service wash tabs have a New ticket button that opens the till's `TicketForm.jsx`
  - `DaysChart.jsx`: the last 7 / 30 days chart
  - `MonthlySummary.jsx`: one month's totals, tickets, best/worst day, card and cash
  - `MoneySources.jsx`: each kind of income's share (%) of a day, week or month
  - `DaysList.jsx`: one row per day with card and cash, flags days never closed
  - `CustomersAndHours.jsx`: top customers and busiest hours
  - `MonthPicker.jsx`, `chartColors.js`: shared by the reports
  - `AdminArea.jsx`, `AdminLogin.jsx`: the password screen before the Admin page
  - `SecuritySettings.jsx`: change the admin password
  - `StaffManager.jsx`: add, rename, change PIN, remove workers
  - `EditHistory.jsx`: log of every cancel, refund, card amount and price change
  - `ServiceWashPrices.jsx`: Admin → Price list, the service wash load sizes and their price ranges
  - `PriceListManager.jsx`: Admin → Price list
  - `PrinterSettings.jsx`: Admin → Printer (model, USB or network, shop details, test print)
- `utils/`: `dates.js` and `money.js`, small helpers used everywhere; `print.js` sends print
  jobs and opens the print window for "Any other printer" (ticket barcodes drawn with the free
  `jsbarcode` package)
- `App.css`: all the styles

## Where the back-end code lives (`server`)

Every file starts with a comment saying what it does, and every route says which URL it answers.

- `index.js`: starts the server (saved days brought up to date, backups, closing the database on Ctrl+C)
- `app.js`: the Express app and the list of every group of routes, in order
- `routes/`: what each URL does
  - `admin/`: `adminLogin.js` (log in, change password), `staffManagement.js` (workers and PINs),
    `ticketList.js` and `ticketEditor.js` (Admin → Tickets), `dayTakings.js` (day summary, card and
    cash), `dailyChart.js` (7 / 30 days chart), `uncollectedTickets.js`, `editHistory.js`,
    `printerSettings.js` (Admin → Printer)
  - `reports/`: `monthlySummary.js` (and its PDF), `moneySources.js`, `daysList.js`, `customers.js`,
    `ticketSummary.js` (and its PDF)
  - `priceLists/`: `dryCleaningPrices.js`, `serviceWashPrices.js`
  - `till/`: `staffSignIn.js`, `customerSearch.js`, `sales.js`, `tillSpending.js`, `tillActivity.js`
  - `tickets/`: `newDryCleaningTicket.js`, `newServiceWashTicket.js`, `ticketActions.js`
    (look up, pay, collect, cancel), `ticketPrinting.js`
  - `health.js`: `/api/health`
- `db/`: the database
  - `connection.js`: opens the file (`DB_PATH`) and its settings
  - `index.js`: what every other file imports; runs the files in `schema/` in order
  - `schema/`: the tables, one file per group (`tickets.js`, `money.js`, `staff.js`, `priceLists.js`,
    `editHistory.js`, `admin.js`, `printer.js`), each also adding any columns added to the app later
  - `columns.js`: helpers for adding those columns
  - `defaultPriceList.js`: the shop's dry cleaning price list (copied into the database once)
- `lib/`: helpers shared by the routes: `money.js` (rounding), `dates.js` (today, checking a date),
  `takings.js` (a day's totals and the saved card/cash days), `editHistory.js`, `backups.js`
- `auth/`: `adminAuth.js` (admin password and 12-hour log-in), `staffAuth.js` (workers' PINs and
  till sign-in), `accessRules.js` (which routes need the admin), `hashing.js`, `cookies.js`
- `tickets/`: helpers shared by the ticket routes: `ticketKinds.js`, `ticketDetails.js`,
  `ticketMoneyChecks.js` (discount and deposit), `ticketHistory.js`
- `reports/`: the numbers and PDFs behind the reports: `moneyByDay.js`, `monthSummary.js`,
  `monthPdf.js`, `ticketSummary.js`, `ticketSummaryPdf.js`, `pdfWriter.js` (a small PDF maker,
  no extra package needed)
- `printing/`: receipt printing: `printerModels.js`, `printerSettings.js`, `receiptLayout.js`,
  `ticketReceipt.js` (printed tickets end with a Code 128 barcode, D123 for dry cleaning or
  S123 for service wash, which the till search box opens when scanned), `testPage.js`,
  `escpos.js` (ESC/POS commands, barcodes drawn by the printer itself), `sendToPrinter.js`
  (USB through `lp` or network on port 9100), `printAndAnswer.js`
- `scripts/`: commands run by hand in `server/`: `seed.js` (`npm run seed`, test data),
  `set-password.js` (`npm run set-password`), `backup.js` (`npm run backup -- <name>`)

## Admin password

Staff can use the till without a password. The Admin page needs the admin password,
and the server checks it on every admin route.

Set it the first time (or reset a forgotten one) on the shop PC:

    cd server
    npm run set-password

Once logged in, the password can also be changed in Admin → Security.

## Staff names

In Admin → Staff, add each worker with a 4–6 digit PIN. Once at least one worker exists,
the till asks who is working (name + PIN) before saving anything, and every ticket, sale,
collection and refund records who did it. Until then, the till works without names.

## Touchscreens and phones

On a touchscreen wider than a phone, tapping any number box (price, pieces, amount,
quantity, PIN, card total) opens a big on-screen number pad. Phones use their own number
keyboard instead, and get a one-column layout. To force the pad on or off on one computer,
run `localStorage.numberPad = "on"` (or `"off"`) in the browser console.
