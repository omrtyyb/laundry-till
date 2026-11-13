// The test page printed from Admin → Printer.
import { PRINTER_MODELS } from './printerModels.js'
import { headerLines, footerLines } from './receiptLayout.js'

// A test page showing the header, a ticket-like layout, the £ sign and the cutter
export function testLines(settings) {
  const model = PRINTER_MODELS.find((m) => m.id === settings.model)
  return [
    ...headerLines(settings),
    { text: 'TEST PRINT', align: 'center', bold: true, big: true },
    { text: model ? model.label : settings.model, align: 'center' },
    { text: `${settings.paper}mm paper, ${settings.chars} letters per line`, align: 'center' },
    { divider: true },
    { text: '1234567890'.repeat(Math.ceil(settings.chars / 10)).slice(0, settings.chars) },
    { left: 'Shirt (dry clean) x2', right: '£7.00' },
    { left: 'A very long item name that should wrap onto the next line', right: '£12.50' },
    { left: 'TOTAL', right: '£19.50', bold: true },
    { divider: true },
    { text: 'If the line of numbers fits on one line and £ shows correctly, the settings are right.' },
    { blank: true },
    { barcode: 'D123' },
    { text: 'Tickets have a barcode like this one. Scan it into the till search box to test a scanner (it looks for dry cleaning ticket 123).', align: 'center' },
    ...footerLines(settings),
  ]
}
