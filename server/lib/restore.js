// Restoring the till's data from a backup (Admin → Backups → Restore), either one on this
// computer or one on the USB stick / external drive (e.g. to set the till up on a new computer).
//
// 1. The backup is checked: it must open, not be damaged and be a laundry till database.
// 2. The data as it is now is saved first as a "before restore" backup
//    (data/backups/laundry-till-before-restore-2026-11-13-140501.db), so a restore can always be
//    undone by restoring that one.
// 3. Every table is emptied and filled from the backup, all in one go: if anything fails nothing
//    changes. The server keeps running, so nobody has to restart the till.
//
// The tables are filled column by column, so a backup made before columns were added to the app
// still restores: the newer columns get their usual starting value.
//
// Kept as they are now, not taken from the backup:
//   admin_password, admin_sessions  so the admin isn't locked out or logged out by an old password
//   printer_settings, backup_settings  set up for this computer and its printer and USB stick
// Emptied: staff_sessions, so the staff sign in again on the till.
import db from '../db/index.js'
import { backupPath, manualBackup } from './backups.js'

const KEEP_AS_NOW = new Set(['admin_password', 'admin_sessions', 'printer_settings', 'backup_settings'])
const EMPTY_ONLY = new Set(['staff_sessions'])
// A backup without these isn't from the laundry till
const MUST_HAVE = ['dry_cleaning_tickets', 'service_wash_tickets', 'daily_takings']

const quote = (name) => `"${name.replaceAll('"', '""')}"`

// Checks a backup can be restored; throws an Error saying why not
async function checkBackup(file) {
  const { default: Database } = await import('better-sqlite3')
  let backup
  try {
    backup = new Database(file, { readonly: true, fileMustExist: true })
  } catch {
    throw new Error('The backup could not be opened')
  }
  try {
    let result
    try {
      result = backup.pragma('integrity_check', { simple: true })
    } catch {
      result = 'it is not a database file'
    }
    if (result !== 'ok') throw new Error(`The backup is damaged (${result})`)
    const tables = new Set(backup.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").pluck().all())
    if (!MUST_HAVE.every((table) => tables.has(table))) throw new Error("This file isn't a laundry till backup")
  } finally {
    backup.close()
  }
}

// Restores the backup called name, from data/backups or from file (a backup on the USB drive).
// Returns the name of the "before restore" backup made first.
export async function restoreBackup(name, file = backupPath(name)) {
  if (!file) throw new Error('Backup not found')
  await checkBackup(file)

  const safetyFile = await manualBackup(undefined, 'before-restore')

  const tables = db
    .prepare("SELECT name FROM main.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
    .pluck()
    .all()

  // Foreign keys can only be switched off outside a transaction. While the tables are emptied
  // and refilled one by one, a ticket's items may briefly be there before the ticket.
  db.pragma('foreign_keys = OFF')
  db.prepare('ATTACH DATABASE ? AS restore_from').run(file)
  try {
    const backupTables = new Set(
      db.prepare("SELECT name FROM restore_from.sqlite_master WHERE type = 'table'").pluck().all(),
    )
    const columnsOf = (schema, table) =>
      db.prepare(`SELECT name FROM pragma_table_info(?, ?)`).pluck().all(table, schema)

    db.transaction(() => {
      const restored = []
      for (const table of tables) {
        if (KEEP_AS_NOW.has(table)) continue
        db.exec(`DELETE FROM main.${quote(table)}`)
        if (EMPTY_ONLY.has(table) || !backupTables.has(table)) continue
        const inBackup = new Set(columnsOf('restore_from', table))
        const columns = columnsOf('main', table).filter((column) => inBackup.has(column)).map(quote).join(', ')
        if (!columns) continue
        db.exec(
          `INSERT INTO main.${quote(table)} (${columns}) SELECT ${columns} FROM restore_from.${quote(table)}`,
        )
        restored.push(table)
      }
      // The next id numbers for each table, as they were in the backup
      if (tables.length && backupTables.has('sqlite_sequence')) {
        const hasSequence = db
          .prepare("SELECT 1 FROM main.sqlite_master WHERE name = 'sqlite_sequence'")
          .get()
        if (hasSequence) {
          for (const table of restored) {
            db.prepare('DELETE FROM main.sqlite_sequence WHERE name = ?').run(table)
            db.prepare(
              'INSERT INTO main.sqlite_sequence (name, seq) SELECT name, seq FROM restore_from.sqlite_sequence WHERE name = ?',
            ).run(table)
          }
        }
      }
    })()

    const problems = db.pragma('foreign_key_check')
    if (problems.length) console.warn(`Restore from ${name}: ${problems.length} rows point at rows that aren't there`)
  } finally {
    db.exec('DETACH DATABASE restore_from')
    db.pragma('foreign_keys = ON')
  }
  // Move everything into laundry-till.db itself straight away
  db.pragma('wal_checkpoint(TRUNCATE)')
  return safetyFile.split(/[\\/]/).pop()
}
