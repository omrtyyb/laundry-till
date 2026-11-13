// Edit history rows for tickets.
import { logEdit } from '../lib/editHistory.js'

// Edit history row for a ticket made in Admin, e.g. "Dry cleaning ticket 12 for Sarah, £8.00 paid"
export function logNewTicket(label, ticket) {
  logEdit({
    action: 'Ticket added in Admin',
    details:
      `${label} ticket ${ticket.id} for ${ticket.customer_name}, £${ticket.price.toFixed(2)} ` +
      (ticket.paid ? 'paid' : ticket.deposit > 0 ? `with a £${ticket.deposit.toFixed(2)} deposit` : 'not paid'),
    amount: ticket.price,
    byAdmin: true,
  })
}
