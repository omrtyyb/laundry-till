# Setup and running

## Requirements

- **Node.js 22** or newer, with npm.
- **macOS, Windows or Linux.** `better-sqlite3` ships ready-built binaries for common systems. If
  npm has to build it, it needs the Xcode command line tools (macOS), *Desktop development with C++*
  from Visual Studio Build Tools (Windows), or `build-essential` and Python (Linux).
- Optional: an ESC/POS receipt printer (USB or network) and a USB barcode scanner.

## Install and run for development

```bash
git clone <repo url> laundry-till
cd laundry-till
```

Terminal 1, the server (http://localhost:3001):

```bash
cd server
npm install
npm run dev
```

Terminal 2, the client (http://localhost:5173):

```bash
cd client
npm install
npm run dev
```

Open http://localhost:5173. Requests to `/api/...` are forwarded to the server. Check the server
with http://localhost:3001/api/health.

`npm run dev` in `server/` restarts the server whenever a file changes (`node --watch`). Vite
reloads the page when a client file changes.

The database file and its tables are created the first time the server starts, and the dry
cleaning price list and service wash load sizes are filled in.

## Admin password

The Admin area needs a password. There is no default: set one the first time, or reset a
forgotten one, on the computer that runs the server:

```bash
cd server
npm run set-password
```

It asks for the new password twice (at least 8 characters; what you type isn't shown) and logs out
every browser. Once logged in, the password can also be changed in Admin → Security.

The password is never stored, only a scrypt hash, so it can't be read back from the database.
**Don't write the shop's real password in this repo, an issue or a commit.** The owner shares it
privately with anyone who needs it. A developer working on their own copy sets their own password
with the command above.

## Test data

```bash
cd server
npm run seed            # made-up tickets, sales and spending for the past 7 days
npm run seed -- 14      # the past 14 days
npm run seed -- today   # today only
```

The seed saves a copy of the database first (`data/before-seed-<date>.db`), so it can be undone by
restoring that copy. On a new database it also adds a few products to sell. Names are made up and
phone numbers are from Ofcom's range kept for TV and drama (07700 900xxx).

To work on a separate demo database without touching the shop's data, point the server at another
file and the client at another port:

```bash
cd server && DB_PATH=/tmp/demo.db PORT=3101 npm run dev
cd client && API_PORT=3101 npx vite --port 5174
```

## Settings

The server reads these environment variables. None are needed for normal use.

| Variable | Default | What it does |
| --- | --- | --- |
| `PORT` | `3001` | The server's port. |
| `DB_PATH` | `server/data/laundry-till.db` | Where the database file is kept. |
| `BACKUP_DIR` | `<database folder>/backups` | Where automatic and manual backups go. |
| `BACKUP_COPY_DIR` | – | A folder to copy every backup into when no USB drive is picked in Admin → Backups. |
| `API_PORT` (client) | `3001` | Which server port Vite forwards `/api` to. |

## Using it on other devices in the shop

Any tablet or phone on the shop's Wi-Fi can use the till. Start the client so it listens on the
network:

```bash
cd client
npx vite --host
```

Vite prints a *Network* address such as `http://192.168.1.20:5173`; open that on the other device.
Each device signs in its own worker. Keep the server on the shop network only: it has no HTTPS of
its own, so don't open port 3001 or 5173 to the internet.

## Building the client

```bash
cd client
npm run build     # makes client/dist
npm run preview   # serves client/dist on http://localhost:4173 for a check
npm run lint      # oxlint
```

The server doesn't serve `client/dist` itself; in the shop the app runs with `npm run dev` in both
folders.

## Receipt printer

Set it up in Admin → Printer.

- **USB (macOS and Linux):** add the printer in the system's printer settings first, as a *raw* or
  *generic* printer, then pick its queue in Admin → Printer. The server sends ESC/POS bytes with
  `lp -o raw`.
- **Network:** type the printer's IP address; the server sends to port 9100.
- **Any other printer:** the browser's print window opens with the ticket laid out for a receipt.

*Test print* tries the settings before they are saved.

## Backups

The server backs up the database when it starts and every night into `server/data/backups/`
(the last 30 days, plus one per month for a year). Everything else, including restore, is in
Admin → Backups. Before changing data by hand, make a named backup:

```bash
cd server
npm run backup -- before-my-change
```

Stop the server with Ctrl+C before copying `laundry-till.db` yourself: recent changes can still be
in the `-wal` file next to it.

## What is never committed

`.gitignore` keeps these out of Git, because they hold real shop data or are rebuilt anyway:

- `server/data/` (the database, its `-wal` and `-shm` files, and every backup) and any `*.db`
- `node_modules/`, `client/dist/`, logs
- `.env` files
- exported `*.xlsx`, `*.csv` and `*.pdf` reports

## Troubleshooting

| Problem | Fix |
| --- | --- |
| `Error: listen EADDRINUSE :::3001` | The server is already running in another terminal, or something else uses the port. Stop it, or use `PORT=3002` and `API_PORT=3002`. |
| The till loads but nothing saves or lists stay empty | Start the server in `server/` and check http://localhost:3001/api/health. |
| `better-sqlite3` fails to install | Install the build tools listed under *Requirements*, delete `node_modules`, and run `npm install` again. |
| Forgot the admin password | `npm run set-password` in `server/`. |
| A day's totals look wrong after editing data by hand | Restart the server; it recalculates every saved day when it starts. |
| Nothing prints | Admin → Printer → *Test print*. On USB check the printer queue name; on a network check the IP address and that the printer is on the same network. |
