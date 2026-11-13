// Printing a ticket from the till: POST /api/dry-cleaning-tickets/12/print (or service-wash-tickets).
import express from 'express'
import db from '../../db/index.js'
import { getSettings } from '../../printing/printerSettings.js'
import { printAndAnswer } from '../../printing/printAndAnswer.js'
import { TICKET_KINDS, ticketLines } from '../../printing/ticketReceipt.js'
import { garmentTagReceipts } from '../../printing/garmentTags.js'
import { whatsappNumber, whatsappText, whatsappReadyText } from '../../printing/whatsappReceipt.js'

const router = express.Router()

// Prints a ticket. The till sends { auto: true } right after saving a new ticket; that is
// skipped (answering { skipped: true }) until a printer is set up, or if new tickets
// shouldn't print by themselves. A new dry cleaning ticket also prints small tags for its pieces, in the style chosen
// (unless that is turned off in Admin → Printer); { tagsOnly: true } prints just the tags again.
for (const [urlName, kind] of Object.entries(TICKET_KINDS)) {
  router.post(`/api/${urlName}/:id/print`, async (req, res) => {
    const settings = getSettings()
    if (req.body?.auto && !(settings.configured && settings.print_new_tickets)) return res.json({ skipped: true })
    const ticket = db.prepare(`SELECT * FROM ${kind.table} WHERE id = ?`).get(req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    const items =
      kind.table === 'dry_cleaning_tickets' ? db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ? ORDER BY id').all(ticket.id) : []
    const isDryCleaning = kind.table === 'dry_cleaning_tickets'
    const copies = []
    if (!(req.body?.tagsOnly && isDryCleaning)) {
      copies.push(ticketLines(kind, ticket, items, settings, false))
      if (settings.ticket_copies === 2) copies.push(ticketLines(kind, ticket, items, settings, true))
    }
    if (isDryCleaning && (req.body?.tagsOnly || (req.body?.auto && settings.print_garment_tags))) {
      copies.push(...garmentTagReceipts(ticket, items, settings))
    }
    await printAndAnswer(res, copies, settings)
  })
}

// The receipt for WhatsApp: GET /api/dry-cleaning-tickets/12/whatsapp (or service-wash-tickets)
// answers { link } for WhatsApp's click-to-chat, or an error if the phone number can't be used.
// ?message=ready gives the "your order is ready" message instead of the receipt.
for (const [urlName, kind] of Object.entries(TICKET_KINDS)) {
  router.get(`/api/${urlName}/:id/whatsapp`, (req, res) => {
    const ticket = db.prepare(`SELECT * FROM ${kind.table} WHERE id = ?`).get(req.params.id)
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' })
    const number = whatsappNumber(ticket.phone_number)
    if (!number) return res.status(400).json({ error: `"${ticket.phone_number}" is not a phone number WhatsApp can use` })
    const items =
      kind.table === 'dry_cleaning_tickets' ? db.prepare('SELECT * FROM ticket_items WHERE ticket_id = ? ORDER BY id').all(ticket.id) : []
    const text =
      req.query.message === 'ready' ? whatsappReadyText(kind, ticket, getSettings()) : whatsappText(kind, ticket, items, getSettings())
    res.json({ link: `https://wa.me/${number}?text=${encodeURIComponent(text)}` })
  })
}

export default router
