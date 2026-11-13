// Loyalty rewards: every Nth dry cleaning (or service wash) ticket a customer has gets a
// percentage off, e.g. every 10th dry cleaning ticket gets 20% off. The admin sets the rules
// in Admin → Loyalty rewards; the till offers the reward on a new ticket and the worker
// chooses whether to give it.
//
// How tickets are counted, for one customer (same phone number, see lib/customers.js) and
// one kind of ticket:
// - Cancelled tickets and the old spreadsheet's daily totals don't count.
// - Counting starts again after the last ticket that was given the reward.
// - The reward is due when the new ticket would be the Nth since then. If the worker doesn't
//   give it, it stays due on the customer's next ticket of that kind.
import db from '../db/index.js'
import { customerKey } from './customers.js'
import { round } from './money.js'

export const KINDS = {
  dryCleaning: { table: 'dry_cleaning_tickets', label: 'dry cleaning' },
  serviceWash: { table: 'service_wash_tickets', label: 'service wash' },
}

// Both rules, e.g. { dryCleaning: { kind, every: 10, percent: 20, active: 1 } | null, serviceWash: ... }
export function getRules() {
  const rows = db.prepare('SELECT * FROM loyalty_rules').all()
  return Object.fromEntries(Object.keys(KINDS).map((kind) => [kind, rows.find((r) => r.kind === kind) || null]))
}

// Saves the rule for one kind of ticket. Returns { error } or { rule }.
export function saveRule(kind, { every, percent, active }) {
  if (!KINDS[kind]) return { error: 'Unknown kind of ticket' }
  if (!Number.isInteger(every) || every < 2 || every > 1000) {
    return { error: 'The number of tickets must be a whole number from 2 to 1000' }
  }
  if (typeof percent !== 'number' || !(percent > 0) || percent > 100) {
    return { error: 'The discount must be more than 0% and at most 100%' }
  }
  db.prepare(
    `INSERT INTO loyalty_rules (kind, every, percent, active) VALUES (?, ?, ?, ?)
     ON CONFLICT (kind) DO UPDATE SET every = excluded.every, percent = excluded.percent,
       active = excluded.active, updated_at = datetime('now', 'localtime')`,
  ).run(kind, every, round(percent), active ? 1 : 0)
  return { rule: getRules()[kind] }
}

// Where a customer stands for one kind of ticket:
//   { active, every, percent, count, due, toGo }
//   count  tickets since the last reward (or since their first ticket)
//   due    true when the next ticket should get the reward
//   toGo   tickets still to come before the reward ticket (0 when due)
// active is false (and nothing else is sent) when there is no reward switched on.
export function loyaltyStatus(kind, name, phone) {
  const rule = getRules()[kind]
  if (!rule || !rule.active) return { active: false }
  const key = customerKey(name, phone)
  const tickets = db
    .prepare(
      `SELECT customer_name, phone_number, loyalty_percent FROM ${KINDS[kind].table}
        WHERE cancelled = 0 AND imported = 0 ORDER BY created_at, id`,
    )
    .all()
    .filter((t) => customerKey(t.customer_name, t.phone_number) === key)
  const lastReward = tickets.findLastIndex((t) => t.loyalty_percent != null)
  const count = tickets.length - lastReward - 1
  const toGo = Math.max(0, rule.every - 1 - count)
  return { active: true, every: rule.every, percent: rule.percent, count, due: toGo === 0, toGo }
}

// For a new ticket: when the worker ticked the reward (body.loyalty), checks it is due and
// works out the money off fullPrice. Returns { error } or { percent, amount } (null, 0 when not given).
export function loyaltyForNewTicket(kind, body, fullPrice) {
  if (!body.loyalty) return { percent: null, amount: 0 }
  const status = loyaltyStatus(kind, body.customer_name, body.phone_number)
  if (!status.active || !status.due) {
    return { error: 'This customer has no loyalty reward due on this ticket' }
  }
  return { percent: status.percent, amount: round((fullPrice * status.percent) / 100) }
}
