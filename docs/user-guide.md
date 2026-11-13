# User guide

A tour of every screen, for shop staff, the shop owner and developers who need to know what each
part does. All screenshots come from a demo copy filled with made-up customers
(`npm run seed`); the phone numbers are from Ofcom's range kept for TV and drama.

- [The till](#the-till)
- [Admin](#admin)
- [Colours](#colours)
- [Touchscreens, phones and barcode scanners](#touchscreens-phones-and-barcode-scanners)

---

## The till

The till is the screen staff use all day. It opens straight away with no password.

![Till home screen](screenshots/till-01-home.png)

Six big buttons cover everything that happens at the counter. On the right, **Till activity** lists
everything done today and earlier tickets still open, newest first. The search box at the top finds a
ticket by number or name, and a barcode scanner can scan a printed ticket straight into it.

### Staff sign-in

Once the owner has added workers in Admin → Staff, the till asks who is working before anything
can be saved. Every ticket, sale, collection and refund then records who did it. With no workers set
up, the till works without names.

| Pick your name | Type your PIN |
| --- | --- |
| ![Who is working](screenshots/till-02-staff-sign-in.png) | ![PIN entry](screenshots/till-03-pin.png) |

The signed-in worker's name shows at the top right, with **Sign out**:

![Till with a worker signed in](screenshots/till-04-home-signed-in.png)

### Dry cleaning ticket

![New dry cleaning ticket](screenshots/till-05-dry-cleaning-ticket.png)

- **Name and phone number.** Typing either suggests known customers, so returning customers are
  filled in with one tap.
- **Items.** Pick items from the shop's price list, as *Dry clean* or *Press only*. Each adds its
  price to the ticket. Some items have a price range (e.g. a long coat £13–£20), and the price can
  be set anywhere inside it. A search box finds items quickly.
- **Clothes description, number of pieces and pickup day.**
- **Price, discount and deposit.** A discount can be a percentage or pounds. *Paid in full* or a
  deposit can be taken now; the rest is paid on collection.
- **Loyalty reward.** When the customer's next ticket earns a reward (Admin → Loyalty rewards), the
  form offers it, ticked by default.

Saving prints the ticket (once a printer is set up) with a barcode, plus small garment tags to pin
to each piece if turned on.

### Service wash ticket

![New service wash ticket](screenshots/till-06-service-wash-ticket.png)

The same as dry cleaning, but the worker picks a **load size** from the service wash price list,
and the price must be inside that size's range.

### Sell soap & softener

![Sell form](screenshots/till-07-sell.png)

Tap a product and the quantity. *Other* lets staff type in something that isn't on the list, with its
price. Products and prices are set in Admin → Products to sell.

### Spend coin from till

![Spend form](screenshots/till-08-spend.png)

Records cash taken out of the till to pay for something, such as milk or a repair call-out. It is
taken off the day's total.

### Money in

![Money in](screenshots/till-09-money-in.png)

Three kinds of money coming in:

- **Collection dry clean / service wash:** type or scan the ticket number, then mark it collected and
  take any money still owed.
- **Collection laundry machines:** coins emptied from the washers and dryers.

### Cash drawer

![Cash drawer](screenshots/till-10-cash-drawer.png)

- **Morning:** the opening float, the change put in the drawer. It suggests what was left in last
  night.
- **Closing:** count the cash as one total or note by note, type the card machine total, and how much
  is left in for tomorrow. The count is *blind*: what the drawer should hold, and any difference, show
  only after saving, so the count isn't nudged towards the expected number. Saving with the card
  total also closes the day.

### Ticket details

Tapping anything in the activity list opens its details, with every action allowed for its state:

![Ticket details](screenshots/till-11-activity-details.png)

- **Mark as paid / Mark as collected**
- **Mark as ready:** the clothes are back and hanging, with an optional rack slot such as *B3*.
- **Cancel ticket:** only on the day it was made and before collection. Money already paid is
  refunded and taken off today's total.
- **Print ticket / Print garment tags**
- **Send receipt on WhatsApp:** opens WhatsApp with the receipt (or a "ready to collect" message)
  already typed to the customer. Nothing is sent until staff press send, and no WhatsApp account
  setup is needed.

---

## Admin

**Admin** at the top left of the till opens the owner's area. It needs the admin password, set
with `npm run set-password` (see [Setup](setup.md#admin-password)). A log-in lasts 12 hours.

![Admin login](screenshots/admin-00-login.png)

The menu on the left opens each section.

### Day summary

![Day summary](screenshots/admin-01-day-summary.png)

One day's money by kind: dry cleaning, service washes, product sales (with each product), and till
spending, then the total. Typing the **card machine total** and saving *closes the day*: the rest is
cash. Below, the cash drawer's float and count for that day, and any difference.

### Tickets

![Uncollected tickets](screenshots/admin-02-tickets.png)

Four tabs and a search box that finds any ticket by number or name.

- **Uncollected tickets:** everything still in the shop, oldest first, with the money still owed.
  Overdue tickets can get a WhatsApp reminder, and a final "will be given to charity" notice.
- **Dry cleaning tickets / Service wash tickets:** every ticket, sortable by any column, with
  **New ticket** for tickets made in Admin.

  ![Ticket list](screenshots/admin-02b-ticket-list.png)

- **Edit** on any ticket opens the editor, which can change everything on it: customer, items,
  price, discount, deposit, paid, collected or cancelled. Every change goes in the edit history, and
  saved day totals are recalculated.

  ![Ticket editor](screenshots/admin-02c-ticket-editor.png)

- **Ticket summary:** every ticket between two dates and times, with totals and a PDF.

  ![Ticket summary](screenshots/admin-02d-ticket-summary.png)

### Customers

![Customers](screenshots/admin-03-customers.png)

Customers are worked out from tickets: the same phone number is one customer (or the same name when
no real number was given). Each row shows tickets, money spent, money still to pay and the last visit.
Clicking a customer opens their profile, with loyalty progress, a private note, and every order:

![Customer profile](screenshots/admin-03b-customer-profile.png)

### Loyalty rewards

![Loyalty rewards](screenshots/admin-04-loyalty.png)

One rule each for dry cleaning and service wash: *every Nth ticket gets X% off*. The till offers the
reward when it's due, and counting starts again after a reward is given.

### Last 7 / 30 days chart

![Days chart](screenshots/admin-05-chart.png)

Each day's money stacked by kind, with till spending below the line and a dotted line for the same day
the week before. *Show as table* gives the numbers.

### Monthly summary

![Monthly summary](screenshots/admin-06-monthly.png)

A month's totals by kind, ticket counts, best and worst day, and card and cash. Downloads as a PDF.

### Where the money comes from

![Money sources](screenshots/admin-07-money-sources.png)

Each kind of income's share (%) of a day, week or month.

### Days list: card & cash check

![Days list](screenshots/admin-08-days-list.png)

One row per day with card and cash, and the cash drawer's difference. Days that were never closed are
flagged so they can be closed.

### Top customers & busiest hours

![Top customers](screenshots/admin-09-top-customers.png)

The customers who spend most, and which hours of the day are busiest.

### Export to Excel

![Excel export](screenshots/admin-10-excel.png)

One `.xlsx` file for any date range, with sheets for daily money, dry cleaning, service wash, sales,
till spending and customers. Each sheet has totals and filters, ready for an accountant.

### Price list

![Price list](screenshots/admin-11-price-list.png)

The dry cleaning price list (Dry clean and Press only prices, fixed or a range) and the service wash
load sizes. Removed items disappear from the till but stay on old tickets, and can be brought back.

### Products to sell

![Products](screenshots/admin-12-products.png)

The products on the till's Sell screen and their prices.

### Edit history

![Edit history](screenshots/admin-13-edit-history.png)

A record of every cancel, refund, card amount, price change and admin edit, with who did it and when.
Entries can't be changed or deleted.

### Staff

![Staff](screenshots/admin-14-staff.png)

Add workers with a 4–6 digit PIN, rename them, change a PIN, or remove them. Removed workers can't sign
in, but their name stays on everything they did.

### Printer

![Printer settings](screenshots/admin-15-printer.png)

- **Printer model** presets for common ESC/POS receipt printers (Epson, Xprinter, Rongta, HOIN,
  Munbyn, generic 58 mm and 80 mm) and *Any other printer* (the browser's print window).
- **Connection:** USB (a printer queue on the computer) or network (IP address, port 9100).
- Paper width, cut, cash drawer kick, copies, and whether to print new tickets automatically.
- **Garment tags:** style, what's on them, and a preview.
- **Receipt text:** shop name, lines under it (address, phone, hours) and a footer, with a live
  preview. *Test print* tries the settings before saving.

### Backups

![Backups](screenshots/admin-16-backups.png)

The till backs itself up when it starts and every night. Here the owner can back up now, download,
restore or delete a backup; pick a USB stick or external drive for a second copy of every backup;
restore from a drive (e.g. to set up a new computer); and turn on a 22:30 backup that runs even when
the till is closed. See [Architecture → Backups](architecture.md#backups).

### Security

![Security](screenshots/admin-17-security.png)

Change the admin password. Every other logged-in browser is logged out.

---

## Colours

Each kind of money has one colour everywhere: buttons, activity list, reports and charts.

| Kind | Colour |
| --- | --- |
| Dry cleaning | Purple |
| Service wash | Teal |
| Product sales | Green |
| Machine money | Blue |
| Till spending | Amber |
| Cancelled | Red |
| Card / cash | Grey |

## Touchscreens, phones and barcode scanners

- On a touchscreen wider than a phone, tapping a number box (price, pieces, amount, PIN, card total)
  opens a big on-screen number pad. To force it on or off on one computer, run
  `localStorage.numberPad = "on"` (or `"off"`) in the browser console.
- Phones use their own number keyboard and get a one-column layout.
- Printed tickets end with a Code 128 barcode (`D123` for dry cleaning, `S123` for service wash). Any
  USB barcode scanner that types like a keyboard works in the till's search box.
