// Opens the database file and sets it up. Every other file gets the database with:
//   import db from '../db/index.js'   (db/index.js also makes sure every table exists)
//
// The database is a single SQLite file, server/data/laundry-till.db.
// Set DB_PATH to keep it somewhere else.
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'

export const DB_PATH = process.env.DB_PATH || path.join(import.meta.dirname, '..', 'data', 'laundry-till.db')

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

const db = new Database(DB_PATH)
// Safer and faster for an app that reads and writes at the same time
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')
// Move everything waiting in the -wal side file into the main file, so laundry-till.db on its own is complete
db.pragma('wal_checkpoint(TRUNCATE)')
export default db
