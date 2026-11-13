// Customers, worked out from the tickets. There is no customer sign-up: everyone who gives the
// same phone number is one customer (spaces and +44 / 0 at the start don't matter). Tickets
// with no real phone number (e.g. "0") are grouped by name instead.
import db from '../db/index.js'

// A phone number's digits, written the UK way: "+44 7700 900123" → "07700900123"
export function phoneDigits(phone) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (digits.startsWith('44') && digits.length === 12) digits = '0' + digits.slice(2)
  return digits
}

// The key that ties a ticket to its customer: "p:07700900123", or "n:sarah" with no phone number
export function customerKey(name, phone) {
  const digits = phoneDigits(phone)
  return digits.length >= 6 ? 'p:' + digits : 'n:' + String(name || '').trim().toLowerCase()
}

// Every ticket (not the old spreadsheet's daily totals), with what is needed for a customer's history
function allTickets() {
  return db
    .prepare(
      `
      SELECT 'dryCleaning' AS type, id, customer_name, phone_number, clothes_description AS description,
             number_of_pieces AS pieces, price, discount, deposit, refunded, paid, collected, cancelled,
             created_at, collected_at, ready_at, loyalty_percent
        FROM dry_cleaning_tickets WHERE imported = 0
      UNION ALL
      SELECT 'serviceWash', id, customer_name, phone_number, load_description, NULL, price, discount,
             deposit, refunded, paid, collected, cancelled, created_at, collected_at, ready_at, loyalty_percent
        FROM service_wash_tickets WHERE imported = 0
      ORDER BY created_at DESC
    `,
    )
    .all()
}

const round = (n) => Math.round(n * 100) / 100

// Adds up one customer's tickets. Cancelled tickets don't count.
//   spent  fully paid tickets count their price, unpaid ones their deposit
//   owed   still to pay on tickets not yet paid
function totals(tickets) {
  const live = tickets.filter((t) => !t.cancelled)
  return {
    visits: live.length,
    spent: round(live.reduce((sum, t) => sum + (t.paid ? t.price : t.deposit), 0)),
    owed: round(live.filter((t) => !t.paid).reduce((sum, t) => sum + t.price - t.deposit, 0)),
    in_shop: live.filter((t) => !t.collected).length,
    first_visit: tickets.at(-1)?.created_at ?? null,
    last_visit: tickets[0]?.created_at ?? null,
  }
}

// Every customer grouped from the tickets, as a Map of key → { key, name, phone, tickets }.
// The name and phone shown are the ones on their newest ticket.
function groupCustomers() {
  const customers = new Map()
  for (const ticket of allTickets()) {
    const key = customerKey(ticket.customer_name, ticket.phone_number)
    if (!customers.has(key)) {
      const digits = phoneDigits(ticket.phone_number)
      customers.set(key, { key, name: ticket.customer_name.trim(), phone: digits.length >= 6 ? ticket.phone_number.trim() : '', tickets: [] })
    }
    customers.get(key).tickets.push(ticket)
  }
  return customers
}

const notes = () => new Map(db.prepare('SELECT customer_key, note FROM customer_notes').all().map((r) => [r.customer_key, r.note]))

// The customers list: every customer with their totals, newest visit first.
// search (optional) matches part of a name (on any of their tickets) or phone number.
export function listCustomers(search = '') {
  const text = search.trim().toLowerCase()
  const digits = text.replace(/\D/g, '')
  const allNotes = notes()
  return [...groupCustomers().values()]
    .filter(
      (c) =>
        !text ||
        c.tickets.some((t) => t.customer_name.toLowerCase().includes(text)) ||
        (digits.length >= 3 && phoneDigits(c.phone).includes(digits)),
    )
    .map(({ tickets, ...c }) => ({ ...c, ...totals(tickets), ...byKind(tickets), note: allNotes.get(c.key) || '' }))
}

// The same totals for each kind of ticket on its own: { dryCleaning: {...}, serviceWash: {...} }
function byKind(tickets) {
  return {
    dryCleaning: totals(tickets.filter((t) => t.type === 'dryCleaning')),
    serviceWash: totals(tickets.filter((t) => t.type === 'serviceWash')),
  }
}

// One customer's profile: their details, totals, note, other names they gave, and every ticket
export function getCustomer(key) {
  const customer = groupCustomers().get(key)
  if (!customer) return null
  const names = [...new Set(customer.tickets.map((t) => t.customer_name.trim()))]
  return {
    key,
    name: customer.name,
    phone: customer.phone,
    other_names: names.filter((n) => n.toLowerCase() !== customer.name.toLowerCase()),
    note: notes().get(key) || '',
    ...totals(customer.tickets),
    ...byKind(customer.tickets),
    tickets: customer.tickets,
  }
}

// Saves (or, when empty, removes) the admin's note about a customer
export function saveNote(key, note) {
  const text = String(note || '').trim()
  if (!text) db.prepare('DELETE FROM customer_notes WHERE customer_key = ?').run(key)
  else
    db.prepare(
      `INSERT INTO customer_notes (customer_key, note) VALUES (?, ?)
       ON CONFLICT (customer_key) DO UPDATE SET note = excluded.note, updated_at = datetime('now', 'localtime')`,
    ).run(key, text)
  return text
}
