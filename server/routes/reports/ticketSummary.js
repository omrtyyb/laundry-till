// Admin → Tickets → Ticket summary, on screen and as a PDF.
import express from 'express'
import { ticketSummary } from '../../reports/ticketSummary.js'
import { ticketSummaryPdf } from '../../reports/ticketSummaryPdf.js'

const router = express.Router()

// e.g. /api/reports/ticket-summary?kind=dryCleaning&from=2026-10-26T09:00&to=2026-10-26T18:30
router.get('/api/reports/ticket-summary', (req, res) => {
  const summary = ticketSummary(req.query)
  if (summary.error) return res.status(400).json({ error: summary.error })
  res.json(summary)
})

// The same summary as a PDF, e.g. /api/reports/ticket-summary-pdf?kind=dryCleaning&from=...&to=...
// One row per ticket: id, date, customer, clothes (or load) details, pieces, price;
// then the totals. Long details wrap onto more lines.
router.get('/api/reports/ticket-summary-pdf', (req, res) => {
  const summary = ticketSummary(req.query)
  if (summary.error) return res.status(400).json({ error: summary.error })
  const isDryCleaning = summary.kind === 'dryCleaning'
  const pdf = ticketSummaryPdf(summary)
  const fileDate = summary.from.slice(0, 10) + (summary.to.slice(0, 10) === summary.from.slice(0, 10) ? '' : '-to-' + summary.to.slice(0, 10))
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${isDryCleaning ? 'dry-cleaning' : 'service-wash'}-tickets-${fileDate}.pdf"`,
  )
  res.send(pdf)
})

export default router
