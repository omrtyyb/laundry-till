// Prints from a route and answers the browser.
import { printLines } from './sendToPrinter.js'

// Sends lines to the printer and answers the till; a printer problem becomes a clear message
export async function printAndAnswer(res, lines, settings) {
  try {
    res.json(await printLines(lines, settings))
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
}
