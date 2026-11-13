// The Excel file from Admin → Export to Excel: everything between two dates, one sheet each.
//   Daily money       one row per day: money from each source, till spending, day total,
//                     card and cash (once the day is closed), tickets made; totals at the bottom
//   Dry cleaning      every dry cleaning ticket made in the dates
//   Service wash      every service wash ticket made in the dates
//   Sales             products sold and machine money, one row per sale
//   Till spending     money taken out of the till
//   Customers         every customer with tickets in the dates, with their totals in those dates
// Money cells are real numbers formatted as £, so Excel can add them up.
import ExcelJS from 'exceljs'
import db from '../db/index.js'
import { savedTakings } from '../lib/takings.js'
import { customerKey, phoneDigits } from '../lib/customers.js'
import { moneyByDay, dayTotal, datesBetween } from './moneyByDay.js'

const MONEY = '£#,##0.00;-£#,##0.00'
const yesNo = (value) => (value ? 'Yes' : 'No')

// Adds a sheet from a list of columns { header, key, width, money } and rows, with a bold
// header row that stays in place when scrolling, and filter buttons on every column.
function addSheet(book, name, columns, rows, totals = null) {
  const sheet = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] })
  sheet.columns = columns.map(({ header, key, width = 14, money }) => ({
    header,
    key,
    width,
    style: money ? { numFmt: MONEY } : {},
  }))
  sheet.getRow(1).font = { bold: true }
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }
  sheet.addRows(rows)
  if (rows.length) sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } }
  if (totals && rows.length) {
    // A totals row with Excel SUM formulas, so it stays right if rows are changed in Excel
    const last = rows.length + 1
    const row = sheet.addRow({})
    row.getCell(1).value = 'Total'
    columns.forEach((column, index) => {
      if (totals.includes(column.key)) {
        const letter = sheet.getColumn(index + 1).letter
        row.getCell(index + 1).value = { formula: `SUM(${letter}2:${letter}${last})` }
      }
    })
    row.font = { bold: true }
  }
  return sheet
}

const staffNames = () => new Map(db.prepare('SELECT id, name FROM staff').all().map((s) => [s.id, s.name]))

// from and to are dates like 2026-11-01 (both included). Returns the .xlsx file as a Buffer.
export async function excelExport(from, to) {
  const book = new ExcelJS.Workbook()
  book.creator = 'Laundry till'
  book.created = new Date()
  const staff = staffNames()
  const who = (id) => (id ? staff.get(id) || '' : '')

  // ---- Daily money ----
  const byDay = moneyByDay(from, to)
  const takings = Object.fromEntries(savedTakings(from, to).map((row) => [row.date, row]))
  const ticketsMade = Object.fromEntries(
    db
      .prepare(
        `SELECT date(created_at) AS day, COUNT(*) AS count FROM (
           SELECT created_at FROM dry_cleaning_tickets WHERE cancelled = 0 AND imported = 0
           UNION ALL
           SELECT created_at FROM service_wash_tickets WHERE cancelled = 0 AND imported = 0
         ) WHERE date(created_at) BETWEEN ? AND ? GROUP BY day`,
      )
      .all(from, to)
      .map((row) => [row.day, row.count]),
  )
  const empty = { dryCleaning: 0, serviceWash: 0, products: 0, machineCoins: 0, spending: 0 }
  addSheet(
    book,
    'Daily money',
    [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Dry cleaning', key: 'dryCleaning', money: true },
      { header: 'Service wash', key: 'serviceWash', money: true },
      { header: 'Products', key: 'products', money: true },
      { header: 'Machine money', key: 'machineCoins', money: true },
      { header: 'Till spending', key: 'spending', money: true },
      { header: 'Day total', key: 'total', money: true },
      { header: 'Card', key: 'card', money: true },
      { header: 'Cash', key: 'cash', money: true },
      { header: 'Tickets made', key: 'tickets', width: 13 },
    ],
    datesBetween(from, to).map((date) => {
      const money = byDay[date] || empty
      return {
        date,
        ...money,
        total: dayTotal(money),
        card: takings[date]?.card_total ?? null,
        cash: takings[date]?.cash_total ?? null,
        tickets: ticketsMade[date] || 0,
      }
    }),
    ['dryCleaning', 'serviceWash', 'products', 'machineCoins', 'spending', 'total', 'card', 'cash', 'tickets'],
  )

  // ---- Tickets ----
  const ticketColumns = (isDryCleaning) => [
    { header: 'Ticket', key: 'id', width: 8 },
    { header: 'Made', key: 'created_at', width: 18 },
    { header: 'Customer', key: 'customer_name', width: 18 },
    { header: 'Phone', key: 'phone_number', width: 14 },
    ...(isDryCleaning
      ? [
          { header: 'Clothes', key: 'description', width: 40 },
          { header: 'Pieces', key: 'number_of_pieces', width: 8 },
        ]
      : [
          { header: 'Load size', key: 'load_size', width: 16 },
          { header: 'Load', key: 'description', width: 30 },
        ]),
    { header: 'Price before discount', key: 'full_price', money: true, width: 12 },
    { header: 'Discount', key: 'discount', money: true, width: 11 },
    { header: 'Loyalty %', key: 'loyalty_percent', width: 9 },
    { header: 'Price', key: 'price', money: true, width: 11 },
    { header: 'Deposit', key: 'deposit', money: true, width: 10 },
    { header: 'Paid', key: 'paid', width: 6 },
    { header: 'Paid at', key: 'paid_at', width: 18 },
    { header: 'Collected', key: 'collected', width: 9 },
    { header: 'Collected at', key: 'collected_at', width: 18 },
    { header: 'Cancelled', key: 'cancelled', width: 9 },
    { header: 'Refunded', key: 'refunded', money: true, width: 10 },
    { header: 'Made by', key: 'made_by', width: 12 },
  ]
  const ticketRows = (table, descriptionColumn) =>
    db
      .prepare(
        `SELECT *, ${descriptionColumn} AS description FROM ${table}
          WHERE imported = 0 AND date(created_at) BETWEEN ? AND ? ORDER BY created_at, id`,
      )
      .all(from, to)
      .map((t) => ({
        ...t,
        full_price: Math.round((t.price + t.discount) * 100) / 100,
        paid: yesNo(t.paid),
        collected: yesNo(t.collected),
        cancelled: yesNo(t.cancelled),
        made_by: t.staff_id ? who(t.staff_id) : 'Admin',
      }))
  const ticketTotals = ['full_price', 'discount', 'price', 'deposit', 'refunded']
  addSheet(book, 'Dry cleaning', ticketColumns(true), ticketRows('dry_cleaning_tickets', 'clothes_description'), [...ticketTotals, 'number_of_pieces'])
  addSheet(book, 'Service wash', ticketColumns(false), ticketRows('service_wash_tickets', 'load_description'), ticketTotals)

  // ---- Sales ----
  addSheet(
    book,
    'Sales',
    [
      { header: 'When', key: 'created_at', width: 18 },
      { header: 'Item', key: 'item_name', width: 24 },
      { header: 'Quantity', key: 'quantity', width: 9 },
      { header: 'Each', key: 'unit_price', money: true, width: 10 },
      { header: 'Total', key: 'total', money: true, width: 10 },
      { header: 'Sold by', key: 'sold_by', width: 12 },
    ],
    db
      .prepare('SELECT * FROM sales WHERE date(created_at) BETWEEN ? AND ? ORDER BY created_at, id')
      .all(from, to)
      .map((s) => ({ ...s, total: Math.round(s.quantity * s.unit_price * 100) / 100, sold_by: who(s.staff_id) })),
    ['quantity', 'total'],
  )

  // ---- Till spending ----
  addSheet(
    book,
    'Till spending',
    [
      { header: 'When', key: 'created_at', width: 18 },
      { header: 'What for', key: 'description', width: 36 },
      { header: 'Amount', key: 'amount', money: true, width: 11 },
      { header: 'Taken by', key: 'taken_by', width: 12 },
    ],
    db
      .prepare('SELECT * FROM till_spending WHERE date(created_at) BETWEEN ? AND ? ORDER BY created_at, id')
      .all(from, to)
      .map((s) => ({ ...s, taken_by: who(s.staff_id) })),
    ['amount'],
  )

  // ---- Customers (only their tickets made in the dates; cancelled tickets left out) ----
  const customers = new Map()
  for (const [kind, table] of [
    ['dryCleaning', 'dry_cleaning_tickets'],
    ['serviceWash', 'service_wash_tickets'],
  ]) {
    const rows = db
      .prepare(
        `SELECT customer_name, phone_number, price, paid, deposit, created_at FROM ${table}
          WHERE imported = 0 AND cancelled = 0 AND date(created_at) BETWEEN ? AND ? ORDER BY created_at`,
      )
      .all(from, to)
    for (const t of rows) {
      const key = customerKey(t.customer_name, t.phone_number)
      const c = customers.get(key) || { name: '', phone: '', dryCleaning: 0, serviceWash: 0, spent: 0, owed: 0, last: '' }
      // the name and phone on their newest ticket
      if (t.created_at >= c.last) {
        c.name = t.customer_name.trim()
        c.phone = phoneDigits(t.phone_number).length >= 6 ? t.phone_number.trim() : ''
        c.last = t.created_at
      }
      c[kind] += 1
      c.spent += t.paid ? t.price : t.deposit
      c.owed += t.paid ? 0 : t.price - t.deposit
      customers.set(key, c)
    }
  }
  addSheet(
    book,
    'Customers',
    [
      { header: 'Customer', key: 'name', width: 18 },
      { header: 'Phone', key: 'phone', width: 14 },
      { header: 'Dry cleaning tickets', key: 'dryCleaning', width: 12 },
      { header: 'Service wash tickets', key: 'serviceWash', width: 12 },
      { header: 'Spent', key: 'spent', money: true, width: 11 },
      { header: 'Still to pay', key: 'owed', money: true, width: 11 },
      { header: 'Last ticket', key: 'last', width: 18 },
    ],
    [...customers.values()]
      .map((c) => ({ ...c, spent: Math.round(c.spent * 100) / 100, owed: Math.round(c.owed * 100) / 100 }))
      .sort((a, b) => b.spent - a.spent),
    ['dryCleaning', 'serviceWash', 'spent', 'owed'],
  )

  return Buffer.from(await book.xlsx.writeBuffer())
}
