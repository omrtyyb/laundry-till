// Admin → Printer: read and save the receipt printer settings, and print a test page.
// (Printing a ticket from the till is in routes/tickets/ticketPrinting.js.)
import express from 'express'
import { PRINTER_MODELS, CODE_PAGES } from '../../printing/printerModels.js'
import { getSettings, checkSettings, saveSettings } from '../../printing/printerSettings.js'
import { listQueues } from '../../printing/sendToPrinter.js'
import { printAndAnswer } from '../../printing/printAndAnswer.js'
import { testLines } from '../../printing/testPage.js'
import { layOut } from '../../printing/receiptLayout.js'
import { garmentTagReceipts, SAMPLE_TICKET, SAMPLE_ITEMS } from '../../printing/garmentTags.js'

const router = express.Router()

// The saved settings, the choices for each setting, and the printers added on this PC
router.get('/api/admin/printer', async (req, res) => {
  res.json({ settings: getSettings(), models: PRINTER_MODELS, codePages: CODE_PAGES, queues: await listQueues() })
})

router.put('/api/admin/printer', (req, res) => {
  const { settings, error } = checkSettings(req.body)
  if (error) return res.status(400).json({ error })
  saveSettings(settings)
  res.json({ settings })
})

// Prints a test page with the settings sent (so they can be tried before saving)
router.post('/api/admin/printer/test', async (req, res) => {
  const { settings, error } = checkSettings(req.body)
  if (error) return res.status(400).json({ error })
  await printAndAnswer(res, testLines(settings), settings)
})

// Garment tags for a made-up ticket with 5 pieces, with the settings sent (not yet saved)
const sampleTags = (settings) => garmentTagReceipts(SAMPLE_TICKET, SAMPLE_ITEMS, settings)

// The preview in Admin → Printer: the tags as rows of text, each strip in its own list
router.post('/api/admin/printer/tag-preview', (req, res) => {
  const { settings, error } = checkSettings(req.body)
  if (error) return res.status(400).json({ error })
  res.json({ strips: sampleTags(settings).map((lines) => layOut(lines, settings.chars)) })
})

// Prints the made-up ticket's tags
router.post('/api/admin/printer/test-tags', async (req, res) => {
  const { settings, error } = checkSettings(req.body)
  if (error) return res.status(400).json({ error })
  await printAndAnswer(res, sampleTags(settings), settings)
})

export default router
