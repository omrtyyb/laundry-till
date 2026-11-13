// The printed ticket: the lines on the customer's ticket and on the shop copy.
// (Receipt lines are explained in receiptLayout.js.)
import { headerLines, footerLines } from './receiptLayout.js'
import { pounds as money } from '../lib/money.js'

// "2026-10-26 14:05:09" becomes "26/10/2026 14:05"
const shortDate = (text) => `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)} ${text.slice(11, 16)}`

// What to print for each kind of ticket: its table, the title on the ticket, its description
// column and the letter before the number in its barcode. Dry cleaning and service wash
// tickets have their own numbers (both have a ticket 123), so the barcode says which:
// D123 or S123. Scanning it into the till's search box opens that ticket.
export const TICKET_KINDS = {
  'dry-cleaning-tickets': { table: 'dry_cleaning_tickets', title: 'DRY CLEANING', description: 'clothes_description', barcode: 'D' },
  'service-wash-tickets': { table: 'service_wash_tickets', title: 'SERVICE WASH', description: 'load_description', barcode: 'S' },
}

// The lines of one ticket. shopCopy marks the second copy, kept with the clothes.
export function ticketLines(kind, ticket, items, settings, shopCopy) {
  const lines = [
    ...headerLines(settings),
    { text: kind.title + (shopCopy ? ' - SHOP COPY' : ''), align: 'center', bold: true },
    { text: `Ticket No. ${ticket.id}`, align: 'center', bold: true, big: true },
    { text: shortDate(ticket.created_at), align: 'center' },
    { divider: true },
    { left: 'Name', right: ticket.customer_name },
    { left: 'Phone', right: ticket.phone_number },
    { divider: true },
  ]
  if (items.length > 0) {
    for (const item of items) {
      const name = `${item.item_name}${item.service === 'press' ? ' (press only)' : ''} x${item.quantity}`
      lines.push({ left: name, right: money(item.unit_price * item.quantity) })
    }
  }
  if (ticket.load_size) lines.push({ left: 'Load', right: ticket.load_size })
  const description = ticket[kind.description]
  if (description) lines.push({ text: description })
  if (ticket.number_of_pieces) lines.push({ left: 'Pieces', right: String(ticket.number_of_pieces) })
  lines.push({ divider: true })
  // The discount is only printed when one was given
  if (ticket.discount > 0) {
    lines.push(
      { left: 'Price', right: money(ticket.price + ticket.discount) },
      { left: ticket.loyalty_percent ? `Discount (${ticket.loyalty_percent}% loyalty)` : 'Discount', right: '-' + money(ticket.discount) },
    )
  }
  lines.push({ left: 'TOTAL', right: money(ticket.price), bold: true })
  if (ticket.paid) lines.push({ text: 'PAID', align: 'center', bold: true, big: true })
  else {
    if (ticket.deposit > 0) lines.push({ left: 'Deposit paid', right: money(ticket.deposit) })
    lines.push({ left: 'To pay on collection', right: money(ticket.price - (ticket.deposit || 0)), bold: true })
  }
  if (ticket.cancelled) lines.push({ text: 'CANCELLED', align: 'center', bold: true, big: true })
  lines.push({ divider: true }, { text: `Ready: ${ticket.pickup_time}`, align: 'center', bold: true, big: true })
  lines.push({ blank: true }, { barcode: kind.barcode + ticket.id })
  if (!shopCopy) lines.push({ text: 'Please bring this ticket when you collect.', align: 'center' }, ...footerLines(settings))
  return lines
}
