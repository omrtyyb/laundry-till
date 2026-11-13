// The monthly summary as a PDF.
// Page 1: the month's totals. Then a table with one row per day:
// date, products, machine coins, spent from the till, service wash, dry cleaning, cash, card, day total.
import db from '../db/index.js'
import { today } from '../lib/dates.js'
import { savedTakings } from '../lib/takings.js'
import { Pdf } from './pdfWriter.js'
import { moneyByDay, dayTotal } from './moneyByDay.js'
import { monthSummary } from './monthSummary.js'

// The PDF for one month (from and to are its first and last day so far), as a Buffer
export function monthPdf(month, from, to) {
  const summary = monthSummary(month, from, to)
  const byDay = moneyByDay(from, to)
  const takingsByDay = Object.fromEntries(
    savedTakings(from, to).map((row) => [row.date, row]),
  )

  const money = (amount) => (amount < 0 ? '−£' : '£') + Math.abs(amount).toFixed(2)
  const longDate = (date) =>
    new Date(date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
  const monthTitle = new Date(from + 'T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
  const GREY = [0.35, 0.35, 0.35]

  const pdf = new Pdf()

  // ----- Page 1: the month at a glance -----
  pdf.addPage()
  pdf.text('Rainbow Dry Cleaners & Laundrette', 40, 50, { size: 12, color: GREY })
  pdf.text(`Monthly summary: ${monthTitle}`, 40, 80, { size: 24, bold: true })
  pdf.text(`${longDate(from)} to ${longDate(to)} · made ${longDate(today())}`, 40, 102, { size: 10, color: GREY })

  // Left column: money
  const rows = [
    ['Dry cleaning', summary.totals.dryCleaning],
    ['Service wash', summary.totals.serviceWash],
    ['Product sales', summary.totals.products],
    ['Machine coins', summary.totals.machineCoins],
  ]
  let y = 140
  pdf.text('Money in', 40, y, { size: 14, bold: true })
  y += 24
  for (const [label, amount] of rows) {
    pdf.text(label, 40, y, { size: 12 })
    pdf.text(money(amount), 360, y, { size: 12, align: 'right' })
    pdf.line(40, y + 6, 360, y + 6)
    y += 24
  }
  pdf.text('Total money in', 40, y, { size: 12, bold: true })
  pdf.text(money(summary.totals.income), 360, y, { size: 12, bold: true, align: 'right' })
  y += 30
  pdf.text('Spent from the till', 40, y, { size: 12, color: [0.6, 0.1, 0.1] })
  pdf.text(money(-summary.totals.spending), 360, y, { size: 12, align: 'right', color: [0.6, 0.1, 0.1] })
  y += 20
  pdf.box(32, y, 336, 34, [0.12, 0.16, 0.22])
  pdf.text('Total for the month', 44, y + 22, { size: 14, bold: true, color: [1, 1, 1] })
  pdf.text(money(summary.totals.total), 356, y + 22, { size: 14, bold: true, align: 'right', color: [1, 1, 1] })

  // Right column: card and cash, tickets, best and worst day
  const facts = [
    ['Card', money(summary.takings.card)],
    ['Cash', money(summary.takings.cash)],
    ['Days closed (card entered)', `${summary.takings.closedDays} of ${summary.activeDays} days with takings`],
    ['Tickets made', `${summary.tickets.count} (${summary.tickets.dryCleaning} dry cleaning, ${summary.tickets.serviceWash} service wash)`],
    ['Average ticket price', money(summary.tickets.averagePrice)],
    ['Best day', summary.bestDay ? `${money(summary.bestDay.total)} on ${longDate(summary.bestDay.date)}` : '–'],
    ['Worst day', summary.worstDay ? `${money(summary.worstDay.total)} on ${longDate(summary.worstDay.date)}` : '–'],
  ]
  y = 140
  pdf.text('Card, cash and tickets', 430, y, { size: 14, bold: true })
  y += 24
  for (const [label, value] of facts) {
    pdf.text(label, 430, y, { size: 12, color: GREY })
    pdf.text(value, 600, y, { size: 12 })
    pdf.line(430, y + 6, 800, y + 6)
    y += 24
  }
  pdf.text('Card and cash come from the days the admin closed with the card machine total.', 430, y + 6, {
    size: 9,
    color: GREY,
  })

  // ----- Then: one row per day -----
  const columns = [
    { title: 'Date', x: 40, align: 'left' },
    { title: 'Products', x: 230, align: 'right' },
    { title: 'Machine coins', x: 320, align: 'right' },
    { title: 'Spent from till', x: 410, align: 'right' },
    { title: 'Service wash', x: 495, align: 'right' },
    { title: 'Dry cleaning', x: 580, align: 'right' },
    { title: 'Cash', x: 655, align: 'right' },
    { title: 'Card', x: 725, align: 'right' },
    { title: 'Day total', x: 802, align: 'right' },
  ]
  const ROW = 15
  const startTable = () => {
    pdf.addPage()
    pdf.text(`${monthTitle}: day by day`, 40, 40, { size: 16, bold: true })
    pdf.box(34, 52, 774, 20, [0.12, 0.16, 0.22])
    for (const column of columns) {
      pdf.text(column.title, column.x, 66, { size: 9, bold: true, align: column.align, color: [1, 1, 1] })
    }
    return 72 + ROW
  }

  const sums = { products: 0, machineCoins: 0, spending: 0, serviceWash: 0, dryCleaning: 0, cash: 0, card: 0, total: 0 }
  y = startTable()
  const dates = []
  for (let day = from; day <= to; day = db.prepare("SELECT date(?, '+1 day') AS day").get(day).day) dates.push(day)
  dates.forEach((date, index) => {
    if (y > 560) y = startTable() // a new page if this one is full
    const m = byDay[date] || { dryCleaning: 0, serviceWash: 0, products: 0, machineCoins: 0, spending: 0 }
    const take = takingsByDay[date]
    const total = dayTotal(m)
    if (index % 2 === 1) pdf.box(34, y - 11, 774, ROW, [0.96, 0.97, 0.98])
    const cells = [
      longDate(date),
      money(m.products),
      money(m.machineCoins),
      m.spending ? money(-m.spending) : money(0),
      money(m.serviceWash),
      money(m.dryCleaning),
      take ? money(take.cash_total) : '–',
      take ? money(take.card_total) : '–',
      money(total),
    ]
    cells.forEach((cell, i) =>
      pdf.text(cell, columns[i].x, y, { size: 9, align: columns[i].align, bold: i === cells.length - 1 }),
    )
    sums.products += m.products
    sums.machineCoins += m.machineCoins
    sums.spending += m.spending
    sums.serviceWash += m.serviceWash
    sums.dryCleaning += m.dryCleaning
    sums.cash += take ? take.cash_total : 0
    sums.card += take ? take.card_total : 0
    sums.total += total
    y += ROW
  })

  // Totals row
  if (y > 560) y = startTable()
  pdf.line(34, y - 10, 808, y - 10, { width: 1, gray: 0.2 })
  const totalCells = [
    'Month total',
    money(sums.products),
    money(sums.machineCoins),
    money(-sums.spending),
    money(sums.serviceWash),
    money(sums.dryCleaning),
    money(sums.cash),
    money(sums.card),
    money(sums.total),
  ]
  totalCells.forEach((cell, i) => pdf.text(cell, columns[i].x, y + 4, { size: 9, bold: true, align: columns[i].align }))
  pdf.text('– means the day was not closed, so there is no card and cash split for it.', 40, y + 26, {
    size: 8,
    color: GREY,
  })
  return pdf.toBuffer()
}
