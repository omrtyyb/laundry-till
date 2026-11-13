// The background backup job: run by the computer each night (and on Mac when you log in), even
// when the till isn't open. Set up from Admin → Backups, see lib/backgroundJob.js.
//   node scripts/nightly-backup.js --db <laundry-till.db> --backups <backups folder>
// It makes today's backup (replacing an earlier one from today, so it has the whole day's work),
// copies the backups to the USB stick if one is set up and plugged in, and writes what it did to
// background-backup.log in the backups folder. Safe to run while the till server is running.
import fs from 'node:fs'
import path from 'node:path'

const option = (name) => {
  const at = process.argv.indexOf(name)
  return at > 0 ? process.argv[at + 1] : undefined
}
if (option('--db')) process.env.DB_PATH = option('--db')
if (option('--backups')) process.env.BACKUP_DIR = option('--backups')

// Imported after the options above are read, so they open the right database
const { default: db } = await import('../db/index.js')
const { dailyBackup, BACKUP_DIR } = await import('../lib/backups.js')
const { copyBackupsNow, copyStatus } = await import('../lib/backupCopies.js')

const log = (line) => {
  const text = `${new Date().toLocaleString('en-GB')}  ${line}\n`
  process.stdout.write(text)
  try {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const logFile = path.join(BACKUP_DIR, 'background-backup.log')
    // Keep the log small: start again once it passes 1 MB
    if (fs.existsSync(logFile) && fs.statSync(logFile).size > 1024 * 1024) fs.rmSync(logFile)
    fs.appendFileSync(logFile, text)
  } catch {
    // nothing more can be done
  }
}

let failed = false
try {
  const file = await dailyBackup({ refresh: true })
  log(`Backup saved: ${file}`)
} catch (err) {
  failed = true
  log(`Backup failed: ${err.message}`)
}
try {
  const copied = await copyBackupsNow()
  const status = copyStatus()
  if (status.folder) {
    if (status.lastError) log(`Copy to ${status.folder} failed: ${status.lastError}`)
    else if (!status.pluggedIn) log(`Drive ${status.drive} isn't plugged in, copies will be made next time`)
    else log(`Copied ${copied} backup(s) to ${status.folder}`)
  }
} catch (err) {
  log(`Copy failed: ${err.message}`)
}
db.close()
process.exit(failed ? 1 : 0)
