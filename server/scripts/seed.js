// Adds made-up test entries to the database for each of the past few days.
// Run it with: npm run seed          (the past 7 days)
//          or: npm run seed -- 14    (the past 14 days)
//          or: npm run seed -- today (today only, up to the current time)
// Before adding anything it saves a copy of the database in data/, named with the date and time,
// so the test entries can be removed later by putting that copy back.
import path from 'node:path'
import db from '../db/index.js'

const onlyToday = process.argv[2] === 'today'
const numberOfDays = Number(process.argv[2]) || 7
// How many days back each day is: 0 is today, 1 is yesterday...
const daysToFill = onlyToday ? [0] : Array.from({ length: numberOfDays }, (_, i) => i + 1)

const stamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')
const backupFile = path.join(path.dirname(db.name), `before-seed-${stamp}.db`)
await db.backup(backupFile)
console.log(`Saved a copy of the database before seeding: ${backupFile}`)

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const names = ['Sarah Khan', 'John Smith', 'Aisha Ali', 'Tom Brown', 'Priya Patel', 'Mohammed Iqbal', 'Emma Wilson', 'David Jones', 'Fatima Noor', 'Liam Taylor']
const clothes = ['2 shirts, 1 trousers', '1 suit jacket', 'Wedding dress', '3 blouses', '1 winter coat', '2 ties, 1 waistcoat', 'Curtains (pair)', '1 duvet cover']
const loads = ['1 bag whites', '2 bags mixed colours', 'Bedding, 1 bag', 'Towels, 1 large bag', 'Darks, 1 bag', 'Baby clothes, small bag']
const spending = [['Milk and tea bags', 3.5], ['Bin bags', 4.99], ['Washer repair callout', 45], ['Cleaning spray', 2.75], ['Window cleaner', 10], ['Light bulbs', 6.2]]

const pick = (list) => list[Math.floor(Math.random() * list.length)]
const phone = () => '07' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
const money = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100

// A random time between 8am and 8pm, daysAgo days back (never later than now)
function randomTime(daysAgo) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(8 + Math.floor(Math.random() * 12), Math.floor(Math.random() * 60), Math.floor(Math.random() * 60))
  let time = date
  if (time > new Date()) {
    // For today, pick a time between 8am and now instead
    const eightAm = new Date()
    eightAm.setHours(8, 0, 0)
    time = new Date(eightAm.getTime() + Math.random() * Math.max(0, Date.now() - eightAm.getTime()))
  }
  // Same "YYYY-MM-DD HH:MM:SS" local format the database uses
  const pad = (n) => String(n).padStart(2, '0')
  return `${time.getFullYear()}-${pad(time.getMonth() + 1)}-${pad(time.getDate())} ${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
}

// Pickup day three days after the ticket was made, like the till form suggests
const pickupFor = (createdAt) => DAYS[(new Date(createdAt.replace(' ', 'T')).getDay() + 3) % 7]

const addDryCleaning = db.prepare(`
  INSERT INTO dry_cleaning_tickets
    (customer_name, phone_number, clothes_description, number_of_pieces, pickup_time, price, paid, created_at, paid_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`)
const addServiceWash = db.prepare(`
  INSERT INTO service_wash_tickets
    (customer_name, phone_number, load_description, pickup_time, price, paid, created_at, paid_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`)
const addSale = db.prepare(`
  INSERT INTO sales (product_id, item_name, quantity, unit_price, created_at)
  VALUES (?, ?, ?, ?, ?)
`)
const addSpending = db.prepare(`
  INSERT INTO till_spending (description, amount, created_at)
  VALUES (?, ?, ?)
`)
const products = db.prepare('SELECT * FROM products').all()

// Everything is added in one go: either all entries are saved or none are
let added = 0
db.transaction(() => {
  for (const daysAgo of daysToFill) {
    // A normal day: 2-3 dry cleaning, 2-3 service washes, 3-5 sales and 1 till spending
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const createdAt = randomTime(daysAgo)
      const paid = Math.random() < 0.7 ? 1 : 0
      addDryCleaning.run(pick(names), phone(), pick(clothes), 1 + Math.floor(Math.random() * 5), pickupFor(createdAt), money(8, 60), paid, createdAt, paid ? createdAt : null)
      added++
    }
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const createdAt = randomTime(daysAgo)
      const paid = Math.random() < 0.7 ? 1 : 0
      addServiceWash.run(pick(names), phone(), pick(loads), pickupFor(createdAt), money(10, 30), paid, createdAt, paid ? createdAt : null)
      added++
    }
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
      const product = pick(products)
      addSale.run(product.id, product.name, 1 + Math.floor(Math.random() * 3), product.price, randomTime(daysAgo))
      added++
    }
    // Now and then an "Other" item that isn't in the products list
    if (daysAgo % 3 === 0) {
      addSale.run(null, pick(['Laundry net bag', 'Stain remover', 'Hangers (pack)']), 1, 2.5, randomTime(daysAgo))
      added++
    }
    const [description, amount] = pick(spending)
    addSpending.run(description, amount, randomTime(daysAgo))
    added++
  }
})()

console.log(`Added ${added} test entries ${onlyToday ? 'for today' : `over the past ${numberOfDays} days`}`)
