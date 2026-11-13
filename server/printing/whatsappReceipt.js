// Sending a ticket's receipt on WhatsApp, for free, with WhatsApp's own "click to chat" link
// (https://wa.me/<number>?text=<message>). The till opens the link; WhatsApp (the app, or
// WhatsApp Web) opens the chat with the customer with the receipt already typed, and staff
// press send. Nothing is sent by the till itself, and no account or sign-up is needed.
import { pounds as money } from '../lib/money.js'

// "2026-10-26 14:05:09" becomes "26/10/2026 14:05"
const shortDate = (text) => `${text.slice(8, 10)}/${text.slice(5, 7)}/${text.slice(0, 4)} ${text.slice(11, 16)}`

// A UK phone number in the form WhatsApp wants: country code and digits only.
// "07700 905678" and "+44 7700 905678" both become "447700905678". Numbers from other
// countries work when typed with + or 00 in front. Returns null if it can't be a number.
export function whatsappNumber(phone) {
  const text = String(phone || '').trim()
  let digits = text.replace(/\D/g, '')
  if (text.startsWith('+')) {
    // already has the country code
  } else if (digits.startsWith('00')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = '44' + digits.slice(1)
  return digits.length >= 10 && digits.length <= 15 ? digits : null
}

// "Your order is ready" as a WhatsApp message, sent when the clothes come back
export function whatsappReadyText(kind, ticket, settings) {
  const firstName = String(ticket.customer_name || '').trim().split(/\s+/)[0]
  const what = kind.title === 'DRY CLEANING' ? 'dry cleaning' : 'service wash'
  const shop = settings.shop_name ? ` at *${settings.shop_name}*` : ''
  const lines = [`Hello ${firstName}, your ${what} (ticket *No. ${ticket.id}*) is ready to collect${shop}.`, '']
  const owed = ticket.price - (ticket.deposit || 0)
  if (ticket.paid) lines.push('It is already paid.')
  else lines.push(`To pay on collection: *${money(owed)}*`)
  lines.push(`Please show ticket No. ${ticket.id} when you collect.`)
  if (settings.footer) lines.push('', settings.footer)
  return lines.join('\n')
}

// How many days after a ticket is ready (or its pickup day) uncollected items may be given
// to charity, and how many days the final notice gives the customer to collect
export const CHARITY_DAYS = 90
export const FINAL_NOTICE_DAYS = 7

// "2026-11-10" becomes "Tue 10 Nov"
const niceDate = (date) =>
  new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

// A reminder for a ticket still in the shop. final: the last notice before the items are
// given to charity, with the date to collect by. daysWaiting: days since ready / pickup day.
export function whatsappReminderText(kind, ticket, settings, { final, daysWaiting, collectBy }) {
  const firstName = String(ticket.customer_name || '').trim().split(/\s+/)[0]
  const what = kind.title === 'DRY CLEANING' ? 'dry cleaning' : 'service wash'
  const shop = settings.shop_name ? ` at *${settings.shop_name}*` : ''
  const owed = ticket.paid ? 0 : ticket.price - (ticket.deposit || 0)
  const lines = []
  if (final) {
    lines.push(
      `Hello ${firstName}, this is a *final notice* about your ${what} (ticket *No. ${ticket.id}*)${shop}.`,
      '',
      `It has been waiting for ${daysWaiting} days. If it is not collected by *${niceDate(collectBy)}*, it will be given to charity.`,
    )
  } else {
    lines.push(
      `Hello ${firstName}, a friendly reminder that your ${what} (ticket *No. ${ticket.id}*) is ready to collect${shop}.`,
      '',
      `It has been waiting for ${daysWaiting} days. Items not collected within ${CHARITY_DAYS} days may be given to charity.`,
    )
  }
  lines.push(owed > 0 ? `To pay on collection: *${money(owed)}*` : 'It is already paid.')
  if (settings.footer) lines.push('', settings.footer)
  return lines.join('\n')
}

// The receipt as a WhatsApp message. *text* is bold in WhatsApp.
export function whatsappText(kind, ticket, items, settings) {
  const lines = []
  if (settings.shop_name) lines.push(`*${settings.shop_name}*`)
  lines.push(`${kind.title === 'DRY CLEANING' ? 'Dry cleaning' : 'Service wash'} ticket *No. ${ticket.id}*`)
  lines.push(shortDate(ticket.created_at), '')
  for (const item of items) {
    const name = `${item.item_name}${item.service === 'press' ? ' (press only)' : ''} x${item.quantity}`
    lines.push(`${name}: ${money(item.unit_price * item.quantity)}`)
  }
  if (ticket.load_size) lines.push(`Load: ${ticket.load_size}`)
  const description = ticket[kind.description]
  if (description) lines.push(description)
  if (ticket.number_of_pieces) lines.push(`Pieces: ${ticket.number_of_pieces}`)
  lines.push('')
  if (ticket.discount > 0) lines.push(`Price: ${money(ticket.price + ticket.discount)}`, `${ticket.loyalty_percent ? `Discount (incl. ${ticket.loyalty_percent}% loyalty reward)` : 'Discount'}: -${money(ticket.discount)}`)
  lines.push(`*Total: ${money(ticket.price)}*`)
  if (ticket.cancelled) lines.push('*CANCELLED*')
  else if (ticket.paid) lines.push('*PAID*')
  else {
    if (ticket.deposit > 0) lines.push(`Deposit paid: ${money(ticket.deposit)}`)
    lines.push(`*To pay on collection: ${money(ticket.price - (ticket.deposit || 0))}*`)
  }
  if (!ticket.cancelled) lines.push('', `Ready: *${ticket.pickup_time}*`, `Please show ticket No. ${ticket.id} when you collect.`)
  if (settings.footer) lines.push('', settings.footer)
  return lines.join('\n')
}
