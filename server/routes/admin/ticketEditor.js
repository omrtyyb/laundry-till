// Admin → Tickets: change anything on an existing ticket (PUT /api/admin/tickets/:kind/:id).
import express from 'express'
import db from '../../db/index.js'
import { round } from '../../lib/money.js'
import { today } from '../../lib/dates.js'
import { logEdit } from '../../lib/editHistory.js'
import { refreshTakings } from '../../lib/takings.js'
import { ADMIN_TICKET_KINDS, PICKUP_DAYS } from '../../tickets/ticketKinds.js'
import { ticketWithNames } from '../../tickets/ticketDetails.js'

const router = express.Router()

// Admin → Tickets: change anything on a ticket. e.g. PUT /api/admin/tickets/dryCleaning/12 with
// { customer_name, phone_number, description, number_of_pieces, pickup_time, price, discount, deposit,
//   paid, collected, cancelled, items: [{ item_name, service, quantity, unit_price, price_list_id }] }
// (number_of_pieces and items are dry cleaning only). price is before the discount. Unlike the till, prices aren't held to the
// price list. Ticking Paid, Collected or Cancelled sets its date to now; unticking clears it.
// Cancelling with { refund: true } gives back what was paid (the full price if paid, otherwise
// any deposit), taken off that day's dry cleaning or service wash money like a cancel at the
// till. Unticking Cancelled clears the refund, so the ticket's money counts again. Every change is written to
// the edit history.

router.put('/api/admin/tickets/:kind/:id', (req, res) => {
  const kind = ADMIN_TICKET_KINDS[req.params.kind]
  if (!kind) return res.status(404).json({ error: 'Unknown kind of ticket' })
  const { table, label, descriptionColumn } = kind
  const isDryCleaning = table === 'dry_cleaning_tickets'

  const old = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id)
  if (!old) return res.status(404).json({ error: `There is no ticket number ${req.params.id}` })

  const body = req.body
  const customerName = String(body.customer_name ?? '').trim()
  const phoneNumber = String(body.phone_number ?? '').trim()
  const description = String(body.description ?? '').trim()
  if (!customerName || !phoneNumber || !description) {
    return res.status(400).json({ error: 'Name, phone number and description must be filled in' })
  }
  if (!PICKUP_DAYS.includes(body.pickup_time)) {
    return res.status(400).json({ error: 'Pick a pickup day from Monday to Sunday' })
  }
  if (typeof body.price !== 'number' || !(body.price >= 0)) {
    return res.status(400).json({ error: 'The price must be £0 or more' })
  }
  if (typeof body.deposit !== 'number' || !(body.deposit >= 0)) {
    return res.status(400).json({ error: 'The deposit must be £0 or more' })
  }
  const discount = round(body.discount ?? 0)
  if (!(discount >= 0)) return res.status(400).json({ error: 'The discount must be £0 or more' })
  if (discount > body.price) {
    return res.status(400).json({ error: 'The discount can’t be more than the price' })
  }
  // body.price is before the discount; the ticket saves the price after it
  const price = round(body.price - discount)
  const deposit = round(body.deposit)
  if (deposit > price) {
    return res.status(400).json({ error: 'The deposit can’t be more than the price' })
  }

  let pieces = null
  const items = []
  if (isDryCleaning) {
    pieces = body.number_of_pieces
    if (!Number.isInteger(pieces) || pieces < 1) {
      return res.status(400).json({ error: 'Number of pieces must be a whole number, 1 or more' })
    }
    if (!Array.isArray(body.items)) {
      return res.status(400).json({ error: 'The items are not in the right form' })
    }
    for (const item of body.items) {
      const itemName = String(item.item_name ?? '').trim()
      if (!itemName) return res.status(400).json({ error: 'Each item needs a name' })
      if (item.service !== 'clean' && item.service !== 'press') {
        return res.status(400).json({ error: 'Each item must be dry clean or press only' })
      }
      if (!Number.isInteger(item.quantity) || item.quantity < 1) {
        return res.status(400).json({ error: 'Each item needs a whole number of 1 or more' })
      }
      if (typeof item.unit_price !== 'number' || !(item.unit_price >= 0)) {
        return res.status(400).json({ error: `The price for ${itemName} must be £0 or more` })
      }
      // Keep the link to the price list only if that item is still on it
      const listed = item.price_list_id && db.prepare('SELECT id FROM price_list WHERE id = ?').get(item.price_list_id)
      items.push({
        price_list_id: listed ? listed.id : null,
        item_name: itemName,
        service: item.service,
        quantity: item.quantity,
        unit_price: round(item.unit_price),
      })
    }
  }

  // Service wash: the load size name, or empty for none
  const loadSize = isDryCleaning ? null : String(body.load_size ?? '').trim() || null
  const paid = body.paid ? 1 : 0
  const collected = body.collected ? 1 : 0
  const cancelled = body.cancelled ? 1 : 0
  // Money given back when the ticket is cancelled now: what the customer had paid before this edit
  const refundAmount = body.refund && cancelled && !old.cancelled ? (old.paid ? old.price : old.deposit || 0) : 0

  // What changed, in words, for the edit history
  const yesNo = (value) => (value ? 'yes' : 'no')
  const money = (value) => `£${value.toFixed(2)}`
  const changes = []
  const compare = (name, before, after, show = (v) => v) => {
    if (before !== after) changes.push(`${name} ${show(before)} → ${show(after)}`)
  }
  compare('name', old.customer_name, customerName)
  compare('phone', old.phone_number, phoneNumber)
  compare('description', old[descriptionColumn], description)
  if (isDryCleaning) compare('pieces', old.number_of_pieces, pieces)
  if (!isDryCleaning) compare('load size', old.load_size || 'none', loadSize || 'none')
  compare('pickup', old.pickup_time, body.pickup_time)
  compare('price', old.price, price, money)
  compare('discount', old.discount, discount, money)
  compare('deposit', old.deposit, deposit, money)
  compare('paid', old.paid, paid, yesNo)
  compare('collected', old.collected, collected, yesNo)
  compare('cancelled', old.cancelled, cancelled, yesNo)
  if (isDryCleaning) {
    const describe = (lines) =>
      lines
        .map((l) => `${l.quantity} × ${l.item_name}${l.service === 'press' ? ' (press)' : ''} ${money(l.unit_price)}`)
        .join(', ') || 'none'
    const oldItems = db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ? ORDER BY id').all(old.id)
    compare('items', describe(oldItems), describe(items))
  }
  if (changes.length === 0) return res.json(ticketWithNames(table, old.id))

  try {
    db.transaction(() => {
      db.prepare(
        `
        UPDATE ${table}
        SET customer_name = @customerName, phone_number = @phoneNumber, ${descriptionColumn} = @description,
            ${isDryCleaning ? 'number_of_pieces = @pieces,' : 'load_size = @loadSize,'}
            pickup_time = @pickupTime, price = @price, deposit = @deposit, discount = @discount,
            paid_at = CASE WHEN @paid = 0 THEN NULL WHEN paid = 1 THEN paid_at ELSE datetime('now', 'localtime') END,
            paid_by = CASE WHEN @paid = 1 AND paid = 1 THEN paid_by END,
            paid = @paid,
            collected_at = CASE WHEN @collected = 0 THEN NULL WHEN collected = 1 THEN collected_at ELSE datetime('now', 'localtime') END,
            collected_by = CASE WHEN @collected = 1 AND collected = 1 THEN collected_by END,
            collected = @collected,
            cancelled_at = CASE WHEN @cancelled = 0 THEN NULL WHEN cancelled = 1 THEN cancelled_at ELSE datetime('now', 'localtime') END,
            cancelled_by = CASE WHEN @cancelled = 1 AND cancelled = 1 THEN cancelled_by END,
            cancelled = @cancelled
        WHERE id = @id
      `,
      ).run({
        customerName,
        phoneNumber,
        description,
        ...(isDryCleaning ? { pieces } : { loadSize }),
        pickupTime: body.pickup_time,
        price,
        deposit,
        discount,
        paid,
        collected,
        cancelled,
        id: old.id,
      })
      // Money given back is kept on the ticket; it's cleared if the ticket is no longer cancelled
      if (refundAmount > 0 || !cancelled) {
        db.prepare(`UPDATE ${table} SET refunded = ? WHERE id = ?`).run(refundAmount, old.id)
      }
      if (isDryCleaning) {
        db.prepare('DELETE FROM ticket_items WHERE ticket_id = ?').run(old.id)
        const addItem = db.prepare(`
          INSERT INTO ticket_items (ticket_id, price_list_id, item_name, service, quantity, unit_price)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        for (const item of items) {
          addItem.run(old.id, item.price_list_id, item.item_name, item.service, item.quantity, item.unit_price)
        }
      }
    })()
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  // Same wording as a cancel at the till when this edit cancels the ticket
  const cancelledNow = cancelled && !old.cancelled
  logEdit({
    action: refundAmount > 0 ? 'Ticket cancelled and refunded' : cancelledNow ? 'Ticket cancelled' : 'Ticket edited',
    details:
      `${label} ticket ${old.id} for ${old.customer_name}: ${changes.join('; ')}` +
      (refundAmount > 0 ? `; £${refundAmount.toFixed(2)} given back, taken off ${label.toLowerCase()}` : ''),
    amount: refundAmount > 0 ? refundAmount : null,
    byAdmin: true,
  })

  // The ticket's money may have moved between days: bring every saved day it touches up to date
  const updated = ticketWithNames(table, old.id)
  for (const date of new Set([old.created_at, old.paid_at, updated.paid_at, old.cancelled_at, today()])) {
    if (date) refreshTakings(date.slice(0, 10))
  }
  res.json(updated)
})

export default router
