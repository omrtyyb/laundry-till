// Backups of the database.
//
// - SQLite writes new data to a side file (laundry-till.db-wal) first and only moves it into
//   the main file now and then. Copying laundry-till.db on its own can miss everything since,
//   so backups are always made with SQLite's own backup command, which includes the side file
//   and gives one complete file.
// - The server makes a backup when it starts and every night, into data/backups, e.g.
//   data/backups/laundry-till-2026-10-28.db. The last 30 days and the first backup of each of
//   the last 12 months are kept; older ones are deleted.
// - The background job (lib/backgroundJob.js, scripts/nightly-backup.js) also makes the day's
//   backup at night when the till isn't open, replacing that day's earlier one so it has the
//   whole day's work.
// - A second copy of every backup goes onto a USB stick or external drive whenever it's
//   plugged in (lib/backupCopies.js).
// - Admin → Backups lists every backup, makes one on demand ("manual" backups, e.g.
//   data/backups/laundry-till-manual-2026-11-13-114210.db, never deleted automatically),
//   lets the admin download, delete or restore any of them. A restore first saves the data as it
//   was in a "before restore" backup (laundry-till-before-restore-...db), see lib/restore.js.
// - npm run backup -- before-discount makes data/before-discount-20261028.db, for hand-made
//   copies before changing the data (see scripts/backup.js).
import fs from 'node:fs'
import path from 'node:path'
import db, { DB_PATH } from '../db/index.js'

export const BACKUP_DIR = process.env.BACKUP_DIR || path.join(path.dirname(DB_PATH), 'backups')
const KEEP_DAYS = 30
const KEEP_MONTHS = 12

export const localDate = () => db.prepare("SELECT date('now', 'localtime') AS today").get().today

// Saves a complete copy of the database to filePath and checks it opens and is not damaged.
// onProgress (optional) is called with a number from 0 to 1 and what is happening, e.g.
// onProgress(0.4, 'Copying'), for the progress bar in Admin → Backups.
// The copy is made as filePath + '.part' and only renamed to filePath once it has been checked,
// so a half-made backup is never listed, copied to the USB stick or restored.
export async function backupTo(filePath, onProgress = () => {}) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const partPath = filePath + '.part'
  fs.rmSync(partPath, { force: true })
  onProgress(0, 'Copying')
  // Copying is 90% of the bar, checking the copy the last 10%
  await db.backup(partPath, {
    progress: ({ totalPages, remainingPages }) => {
      if (totalPages) onProgress((0.9 * (totalPages - remainingPages)) / totalPages, 'Copying')
      return 16 // pages copied in each step
    },
  })
  onProgress(0.9, 'Checking the copy')
  const { default: Database } = await import('better-sqlite3')
  // A single file without -wal/-shm side files, so it can be copied anywhere on its own
  const copy = new Database(partPath)
  try {
    copy.pragma('journal_mode = DELETE')
    const result = copy.pragma('integrity_check', { simple: true })
    if (result !== 'ok') throw new Error(`The backup ${filePath} is damaged: ${result}`)
  } catch (err) {
    copy.close()
    fs.rmSync(partPath, { force: true })
    throw err
  }
  copy.close()
  fs.renameSync(partPath, filePath)
  onProgress(1, 'Done')
  return filePath
}

// Today's backup in data/backups. Made once a day: later calls the same day do nothing, unless
// refresh is true (the night-time background job), which replaces it with the data as it is now.
export async function dailyBackup({ refresh = false } = {}) {
  const file = path.join(BACKUP_DIR, `laundry-till-${localDate()}.db`)
  if (fs.existsSync(file) && !refresh) return null
  await backupTo(file)
  removeOldBackups(BACKUP_DIR)
  return file
}

// The admin's "Back up now": a copy named with the date and time, kept until deleted by hand
// kind 'manual' for "Back up now", 'before-restore' for the copy made just before a restore
export async function manualBackup(onProgress, kind = 'manual') {
  const fileNow = () => {
    const { stamp } = db.prepare("SELECT strftime('%Y-%m-%d-%H%M%S', 'now', 'localtime') AS stamp").get()
    return path.join(BACKUP_DIR, `laundry-till-${kind}-${stamp}.db`)
  }
  // Two in the same second would have the same name: wait for the next second
  let file = fileNow()
  while (fs.existsSync(file)) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    file = fileNow()
  }
  await backupTo(file, onProgress)
  return file
}

// Every backup in data/backups, newest first:
//   { name, kind: 'automatic' | 'manual' | 'before-restore', size, savedAt }
// dir: another folder of backups, e.g. "Laundry till backups" on the USB drive
export function listBackups(dir = BACKUP_DIR) {
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter(isBackupName)
    .map((name) => {
      const stat = fs.statSync(path.join(dir, name))
      return { name, kind: backupKind(name), size: stat.size, savedAt: stat.mtime.toISOString() }
    })
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

// Only names the server makes itself, so a download can never reach another file
export const isBackupName = (name) =>
  /^laundry-till-((manual|before-restore)-)?\d{4}-\d{2}-\d{2}(-\d{4,6})?\.db$/.test(name)

const backupKind = (name) =>
  name.includes('-manual-') ? 'manual' : name.includes('-before-restore-') ? 'before-restore' : 'automatic'

// Deletes one backup (Admin → Backups → Delete). Returns false if there is no such backup.
export function deleteBackup(name) {
  const file = backupPath(name)
  if (!file || !fs.existsSync(file)) return false
  fs.rmSync(file)
  return true
}

export const backupPath = (name) => (isBackupName(name) ? path.join(BACKUP_DIR, name) : null)

// Keeps the last KEEP_DAYS daily backups and the first backup of each of the last KEEP_MONTHS
// months in dir (data/backups, or the backups folder on the USB stick). Other backups are left alone.
export function removeOldBackups(dir) {
  const backups = fs
    .readdirSync(dir)
    .filter((name) => /^laundry-till-\d{4}-\d{2}-\d{2}\.db$/.test(name))
    .sort()
    .reverse() // newest first
  const keep = new Set(backups.slice(0, KEEP_DAYS))
  const months = new Map() // month -> its first backup
  for (const name of backups) months.set(name.slice(13, 20), name)
  for (const name of [...months.values()].slice(0, KEEP_MONTHS)) keep.add(name)
  for (const name of backups) {
    if (!keep.has(name)) fs.rmSync(path.join(dir, name))
  }
}

// Makes today's backup now and then checks every hour, so a server left running makes one each night
export function startBackups() {
  const run = () =>
    dailyBackup()
      .then((file) => file && console.log(`Backup saved: ${file}`))
      .catch((err) => console.error(`Backup failed: ${err.message}`))
  run()
  setInterval(run, 60 * 60 * 1000).unref()
}
