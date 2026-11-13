// The ticket summary as a PDF. One row per ticket: id, date, customer, clothes (or load)
// details, pieces, price; then the totals. Long details wrap onto more lines.
import { Pdf } from './pdfWriter.js'

// The PDF for a summary made by ticketSummary(), as a Buffer
export function ticketSummaryPdf(summary) {
  const isDryCleaning = summary.kind === 'dryCleaning'
  const kindName = isDryCleaning ? 'Dry cleaning' : 'Service wash'
  const money = (amount) => '£' + amount.toFixed(2)
  // "2026-10-26 09:00:00" becomes "26 Oct 2026, 09:00"
  const when = (time) =>
    new Date(time.replace(' ', 'T')).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ', ' +
    time.slice(11, 16)
  const GREY = [0.35, 0.35, 0.35]

  const pdf = new Pdf()
  // Splits text into lines no wider than width points
  const wrap = (text, width, size) => {
    const lines = []
    for (const paragraph of String(text).split('\n')) {
      let line = ''
      for (const word of paragraph.split(' ')) {
        const next = line ? line + ' ' + word : word
        if (line && pdf.measure(next, size) > width) {
          lines.push(line)
          line = word
        } else line = next
      }
      lines.push(line)
    }
    return lines
  }

  const columns = [
    { title: 'Ticket id', x: 40, align: 'left' },
    { title: 'Made', x: 100, align: 'left' },
    { title: 'Customer', x: 215, align: 'left' },
    { title: isDryCleaning ? 'Clothes details' : 'Load details', x: 340, align: 'left', width: 330 },
    { title: 'Pieces', x: 720, align: 'right' },
    { title: 'Price', x: 802, align: 'right' },
  ]
  if (!isDryCleaning) columns.splice(4, 1)
  const SIZE = 9
  const LINE = 12

  const startPage = (first) => {
    pdf.addPage()
    let y = 40
    if (first) {
      pdf.text('Rainbow Dry Cleaners & Laundrette', 40, 40, { size: 12, color: GREY })
      pdf.text(`${kindName} ticket summary`, 40, 68, { size: 22, bold: true })
      pdf.text(`${when(summary.from)} to ${when(summary.to)} · paid and not paid · cancelled tickets left out`, 40, 88, {
        size: 10,
        color: GREY,
      })
      y = 104
    }
    pdf.box(34, y, 774, 20, [0.12, 0.16, 0.22])
    for (const column of columns) {
      pdf.text(column.title, column.x, y + 14, { size: SIZE, bold: true, align: column.align, color: [1, 1, 1] })
    }
    return y + 20 + LINE
  }

  let y = startPage(true)
  if (summary.tickets.length === 0) {
    pdf.text('No tickets in this time.', 40, y + 4, { size: 11, color: GREY })
    y += LINE * 2
  }
  summary.tickets.forEach((ticket, index) => {
    const details = wrap(ticket.description, columns[3].width, SIZE)
    const height = details.length * LINE
    if (y + height > 545) y = startPage(false) // a new page if this one is full
    if (index % 2 === 1) pdf.box(34, y - 9, 774, height + 2, [0.96, 0.97, 0.98])
    pdf.text(String(ticket.id), 40, y, { size: SIZE, bold: true })
    pdf.text(when(ticket.created_at), 100, y, { size: SIZE })
    pdf.text(ticket.customer_name.slice(0, 24), 215, y, { size: SIZE })
    details.forEach((line, i) => pdf.text(line, 340, y + i * LINE, { size: SIZE }))
    if (isDryCleaning) pdf.text(String(ticket.pieces), 720, y, { size: SIZE, align: 'right' })
    pdf.text(money(ticket.price), 802, y, { size: SIZE, align: 'right' })
    y += height + 2
  })

  // The totals at the end
  if (y > 520) y = startPage(false)
  y += 8
  pdf.box(34, y, 774, 26, [0.12, 0.16, 0.22])
  const totalsText = isDryCleaning
    ? `Total: ${summary.totals.tickets} tickets, ${summary.totals.pieces} pieces`
    : `Total: ${summary.totals.tickets} tickets`
  pdf.text(totalsText, 44, y + 17, { size: 12, bold: true, color: [1, 1, 1] })
  pdf.text(money(summary.totals.money), 802, y + 17, { size: 12, bold: true, align: 'right', color: [1, 1, 1] })
  return pdf.toBuffer()
}
