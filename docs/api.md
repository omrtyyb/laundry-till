# API reference

The server answers JSON on `http://localhost:3001/api/...`. The React app calls it through `client/src/utils/api.js`;
in development Vite forwards `/api` to the server.

## Conventions

- **Bodies** are JSON (`Content-Type: application/json`). Money is a number of pounds, e.g. `12.5`.
- **Errors** come back as `{ "error": "A sentence a shop worker can read" }` with status `400`
  (bad input), `401` (not logged in or not signed in), `404` (not found) or `409` (not allowed in the
  ticket's current state, e.g. cancelling a collected ticket).
- **Access** is one of:
  - **Open:** anyone on the shop network.
  - **Staff:** needs a worker signed in on the till (`staff_session` cookie) once at least one worker
    exists. With no workers set up, these routes are open.
  - **Admin:** needs the admin log-in cookie (`admin_session`). All admin prefixes are listed in
    `server/auth/accessRules.js`.
- `:kind` in a ticket URL is `dry-cleaning-tickets` or `service-wash-tickets`.

## Health

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/health` | Open | `{ "status": "ok", "database": "connected" }` |

## Staff sign-in (till)

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/staff` | Open | Active workers' ids and names, for the sign-in buttons. |
| GET | `/api/staff/session` | Open | Who is signed in on this browser, and whether sign-in is required. |
| POST | `/api/staff/login` | Open | `{ staff_id, pin }`. Sets the staff cookie. |
| POST | `/api/staff/logout` | Open | Signs the worker out. |

## Tickets

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| POST | `/api/dry-cleaning-tickets` | Staff | New dry cleaning ticket. Body: `customer_name`, `phone_number`, `clothes_description`, `number_of_pieces`, `pickup_time` (weekday), `price` (before discount), `paid`, `deposit`, `discount`, `items` (`[{ price_list_id, service, quantity, unit_price }]`), optional `loyalty`. |
| POST | `/api/service-wash-tickets` | Staff | New service wash ticket. Body: `customer_name`, `phone_number`, `load_description`, `load_size_id`, `pickup_time`, `price`, `paid`, `deposit`, `discount`, optional `loyalty`. The price must be inside the load size's range. |
| GET | `/api/:kind/:id` | Open | One ticket with its items and the workers' names. |
| POST | `/api/:kind/:id/pay` | Staff | Marks it paid (records `paid_by`, `paid_at`). |
| POST | `/api/:kind/:id/ready` | Staff | Marks it ready to collect. Body: optional `{ slot }`, the rack slot. |
| POST | `/api/:kind/:id/collect` | Staff | Marks it collected, and paid if it wasn't. |
| POST | `/api/:kind/:id/cancel` | Staff | Cancels it (same day only, not once collected), refunding anything paid. |
| POST | `/api/:kind/:id/print` | Open | Prints the ticket. Body: `{ auto }` (only print if new-ticket printing is on) or `{ tagsOnly }` (garment tags only). |
| GET | `/api/:kind/:id/whatsapp` | Open | A `wa.me` link with the receipt typed in. `?message=ready` for the "ready to collect" text instead. |
| GET | `/api/tickets/search?q=` | Open | Finds tickets by number, scanned barcode (`D123`, `S123`) or name. |
| GET | `/api/customers/suggest?q=` | Open | Known customers matching a typed name or phone number. |
| GET | `/api/loyalty/status?kind=&name=&phone=` | Open | Whether this customer's next ticket gets a loyalty reward. |

## Price lists and products

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/price-list` | Open | Active dry cleaning price list items, by category. |
| GET | `/api/service-wash-prices` | Open | Active service wash load sizes. |
| GET | `/api/products` | Open | Active products for the Sell screen. |
| GET / POST | `/api/admin/price-list` | Admin | List all items (including removed) / add one. |
| PUT / DELETE | `/api/admin/price-list/:id` | Admin | Change / remove an item. |
| POST | `/api/admin/price-list/:id/restore` | Admin | Bring a removed item back. |
| GET / POST | `/api/admin/service-wash-prices` | Admin | List / add load sizes. |
| PUT / DELETE | `/api/admin/service-wash-prices/:id` | Admin | Change / remove a load size. |
| POST | `/api/admin/service-wash-prices/:id/restore` | Admin | Bring one back. |
| GET / POST | `/api/admin/products` | Admin | List / add products. |
| PUT / DELETE | `/api/admin/products/:id` | Admin | Change / remove a product. |
| POST | `/api/admin/products/:id/restore` | Admin | Bring one back. |

## Till money

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| POST | `/api/sales` | Staff | `{ product_id, quantity }`, or `{ item_name, unit_price, quantity }` for an *Other* item. |
| GET | `/api/sales/:id` | Open | One sale. |
| POST | `/api/till-spending` | Staff | `{ description, amount }`. |
| GET | `/api/till-spending/:id` | Open | One till spending entry. |
| GET | `/api/till-activity` | Open | The activity list on the right of the till. |
| GET | `/api/cash-drawer` | Open | Today's float and count, and what last night left in. |
| POST | `/api/cash-drawer/float` | Staff | `{ amount }`, the morning float. |
| POST | `/api/cash-drawer/count` | Staff | End-of-day count: `counted` or `breakdown` (`{ "20": 3, "0.5": 4 }`), `left_in`, `card_total`, `note`. Closes the day. |

## Admin log-in

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/admin/session` | Open | Whether this browser is logged in, and whether a password has been set. |
| POST | `/api/admin/login` | Open | `{ password }`. Sets a 12-hour admin cookie. |
| POST | `/api/admin/logout` | Open | Logs this browser out. |
| POST | `/api/admin/change-password` | Admin | `{ current_password, new_password }`. Logs out every other browser. |

## Admin: day and tickets

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/daily-summary?date=` | Admin | One day's totals by kind, product sales, spending, and the cash drawer. |
| POST | `/api/daily-takings` | Admin | `{ date, card_total }`. Closes the day. |
| PUT | `/api/daily-takings/:date` | Admin | `{ card_total }`. Changes a closed day's card amount (logged). |
| GET | `/api/daily-chart?days=7` | Admin | Money by kind per day, 7 or 30 days. |
| GET | `/api/admin/tickets?kind=` | Admin | Every ticket of one kind (`dryCleaning` or `serviceWash`). |
| POST | `/api/admin/tickets/dryCleaning` | Admin | New dry cleaning ticket made in Admin (same body as the till). |
| POST | `/api/admin/tickets/serviceWash` | Admin | New service wash ticket made in Admin. |
| PUT | `/api/admin/tickets/:kind/:id` | Admin | Change anything on a ticket, `:kind` is `dryCleaning` or `serviceWash` (logged to edit history). |
| GET | `/api/uncollected-tickets` | Admin | Every ticket still in the shop, oldest first, and the money still owed. |
| POST | `/api/uncollected-tickets/:type/:id/remind` | Admin | Records a WhatsApp reminder. Body: `{ final }` for the last notice. |
| GET | `/api/admin/history` | Admin | The edit history. |

## Admin: customers and loyalty

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/admin/customers?q=` | Admin | Customers worked out from tickets, with totals. |
| GET | `/api/admin/customers/:key` | Admin | One customer (`p:07700900123` or `n:sarah`) and every ticket, newest first. |
| PUT | `/api/admin/customers/:key/note` | Admin | `{ note }`. |
| GET | `/api/admin/loyalty` | Admin | Both loyalty rules. |
| PUT | `/api/admin/loyalty/:kind` | Admin | `{ every, percent, active }`, `:kind` is `dryCleaning` or `serviceWash`. |

## Admin: reports

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET | `/api/reports/month?month=YYYY-MM` | Admin | Monthly totals, tickets, best and worst days, card and cash. |
| GET | `/api/reports/month-pdf?month=` | Admin | The same as a PDF. |
| GET | `/api/reports/share?period=day\|week\|month&date=` | Admin | Each kind of income's share of the period. |
| GET | `/api/reports/days?month=` | Admin | One row per day with card and cash; flags days never closed. |
| GET | `/api/reports/customers` | Admin | Top customers and busiest hours. |
| GET | `/api/reports/ticket-summary?kind=&from=&to=` | Admin | Every ticket between two date-times, with totals. |
| GET | `/api/reports/ticket-summary-pdf?...` | Admin | The same as a PDF. |
| GET | `/api/reports/excel?from=&to=` | Admin | One `.xlsx` with sheets for daily money, dry cleaning, service wash, sales, till spending and customers. |

## Admin: staff, printer, backups

| Method | URL | Access | What it does |
| --- | --- | --- | --- |
| GET / POST | `/api/admin/staff` | Admin | List workers / add one (`{ name, pin }`). |
| PUT / DELETE | `/api/admin/staff/:id` | Admin | Rename or change PIN / remove. |
| POST | `/api/admin/staff/:id/restore` | Admin | Bring a removed worker back. |
| GET / PUT | `/api/admin/printer` | Admin | Read / save the printer settings. |
| POST | `/api/admin/printer/test` | Admin | Print a test page with the settings in the body (not saved). |
| POST | `/api/admin/printer/tag-preview` | Admin | Preview garment tags. |
| POST | `/api/admin/printer/test-tags` | Admin | Print test garment tags. |
| GET / POST | `/api/admin/backups` | Admin | List backups, drives and the background job / back up now. |
| GET | `/api/admin/backups/:name/download` | Admin | Download a backup file. |
| POST | `/api/admin/backups/:name/restore` | Admin | Restore a backup (saves the current data first). |
| DELETE | `/api/admin/backups/:name` | Admin | Delete a backup. |
| PUT | `/api/admin/backups/copy-drive` | Admin | Pick the USB stick or drive for second copies. |
| POST | `/api/admin/backups/copy-now` | Admin | Copy missing backups to the drive now. |
| POST | `/api/admin/backups/restore-from-drive` | Admin | Restore a backup found on a plugged-in drive. |
| PUT | `/api/admin/backups/background-job` | Admin | Turn the 22:30 backup on or off. |

## Trying it with curl

```bash
# Log in as admin and keep the cookie
curl -c cookies.txt -H 'Content-Type: application/json' \
  -d '{"password":"<admin password>"}' http://localhost:3001/api/admin/login

# Today's totals
curl -b cookies.txt http://localhost:3001/api/daily-summary
```
