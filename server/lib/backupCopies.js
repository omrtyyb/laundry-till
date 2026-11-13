// A second copy of every backup on a USB stick or external drive.
//
// The admin picks the drive in Admin → Backups. From then on, whenever that drive is plugged in,
// every backup in data/backups that isn't on it yet (or has changed) is copied into a
// "Laundry till backups" folder on it. The server checks once a minute, and the background job
// (scripts/nightly-backup.js) checks each night too. When the drive isn't plugged in nothing
// happens, and the copies are made the next time it is.
//
// On the drive the automatic backups are thinned out like the ones on this computer (30 days plus
// one a month for a year); backups made by the admin are kept until deleted by hand.
//
// Drives found: Mac /Volumes/<name>; Linux /media/<user>/<name>, /run/media/<user>/<name>, /mnt/<name>;
// Windows every drive letter except C:.
// Older setting: BACKUP_COPY_DIR=<folder> copies to that folder when no drive has been picked.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import db from '../db/index.js'
import { BACKUP_DIR, listBackups, removeOldBackups } from './backups.js'

export const COPY_FOLDER_NAME = 'Laundry till backups'

const settings = () =>
  db.prepare('SELECT copy_drive, last_copy_at, last_copy_error FROM backup_settings WHERE id = 1').get() || {
    copy_drive: null,
    last_copy_at: null,
    last_copy_error: null,
  }

function saveSettings(changes) {
  const now = { ...settings(), ...changes }
  db.prepare(
    `INSERT INTO backup_settings (id, copy_drive, last_copy_at, last_copy_error) VALUES (1, ?, ?, ?)
     ON CONFLICT (id) DO UPDATE SET copy_drive = excluded.copy_drive, last_copy_at = excluded.last_copy_at,
       last_copy_error = excluded.last_copy_error`,
  ).run(now.copy_drive, now.last_copy_at, now.last_copy_error)
}

const freeSpace = (dir) => {
  try {
    const stats = fs.statfsSync(dir)
    return stats.bavail * stats.bsize
  } catch {
    return null
  }
}

const isWritableFolder = (dir) => {
  try {
    if (!fs.statSync(dir).isDirectory()) return false
    fs.accessSync(dir, fs.constants.W_OK)
    return true
  } catch {
    return false
  }
}

const isReadableFolder = (dir) => {
  try {
    return fs.statSync(dir).isDirectory() && (fs.accessSync(dir, fs.constants.R_OK), true)
  } catch {
    return false
  }
}

// The USB sticks and external drives plugged in now: [{ path, name, free, readOnly }]
// readOnly: the drive can be read but not written to. On a Mac that's usually a drive formatted
// for Windows (NTFS), which macOS can only read.
export function listDrives({ includeReadOnly = false } = {}) {
  const found = []
  const add = (dir, name) => {
    if (isWritableFolder(dir)) found.push({ path: dir, name, free: freeSpace(dir), readOnly: false })
    else if (includeReadOnly && isReadableFolder(dir)) found.push({ path: dir, name, free: null, readOnly: true })
  }
  if (process.platform === 'win32') {
    for (const letter of 'ABDEFGHIJKLMNOPQRSTUVWXYZ') add(`${letter}:\\`, `${letter}: drive`)
  } else {
    const user = os.userInfo().username
    const places =
      process.platform === 'darwin' ? ['/Volumes'] : [`/media/${user}`, `/run/media/${user}`, '/mnt', '/media']
    for (const place of places) {
      let names = []
      try {
        names = fs.readdirSync(place)
      } catch {
        continue
      }
      for (const name of names) {
        if (name.startsWith('.') || name.startsWith('com.apple.') || name === user) continue
        // The Mac's own hidden parts of its disk
        if (process.platform === 'darwin' && ['Recovery', 'Preboot', 'VM', 'Update', 'Data'].includes(name)) continue
        const dir = path.join(place, name)
        // On a Mac the computer's own disk is in /Volumes too, as a link to /
        try {
          if (fs.lstatSync(dir).isSymbolicLink()) continue
        } catch {
          continue
        }
        if (!found.some((drive) => drive.path === dir)) add(dir, name)
      }
    }
  }
  return found
}

// Where the copies go: { drive, folder } or null when no second copy is set up
function copyTarget() {
  const { copy_drive } = settings()
  if (copy_drive) return { drive: copy_drive, folder: path.join(copy_drive, COPY_FOLDER_NAME) }
  if (process.env.BACKUP_COPY_DIR) return { drive: null, folder: process.env.BACKUP_COPY_DIR }
  return null
}

const isPluggedIn = (target) => (target.drive ? isWritableFolder(target.drive) : true)

// For Admin → Backups:
//   { drive, folder, pluggedIn, readOnly, lastCopyAt, lastError, onDrive: number of backups on the drive }
export function copyStatus() {
  const target = copyTarget()
  const { last_copy_at, last_copy_error } = settings()
  if (!target) return { drive: null, folder: null, pluggedIn: false, lastCopyAt: last_copy_at, lastError: null, onDrive: null }
  const pluggedIn = isPluggedIn(target)
  // There, but can't be written to (e.g. a Windows NTFS drive on a Mac)
  const readOnly = !pluggedIn && Boolean(target.drive) && isReadableFolder(target.drive)
  let onDrive = null
  if (pluggedIn) {
    try {
      onDrive = fs.readdirSync(target.folder).filter((name) => name.endsWith('.db')).length
    } catch {
      onDrive = 0
    }
  }
  return { drive: target.drive, folder: target.folder, pluggedIn, readOnly, lastCopyAt: last_copy_at, lastError: last_copy_error, onDrive }
}

// Backups on every plugged-in drive (in its "Laundry till backups" folder), newest first:
//   [{ drive, driveName, name, kind, size, savedAt }]. Read-only drives count too, since
// restoring only reads the file.
export function backupsOnDrives() {
  return listDrives({ includeReadOnly: true })
    .flatMap((drive) =>
      listBackups(path.join(drive.path, COPY_FOLDER_NAME)).map((backup) => ({
        drive: drive.path,
        driveName: drive.name,
        ...backup,
      })),
    )
    .sort((a, b) => b.savedAt.localeCompare(a.savedAt))
}

// The full path of a backup on a drive, or null when that drive or backup isn't there
export function driveBackupPath(drive, name) {
  const found = backupsOnDrives().find((backup) => backup.drive === drive && backup.name === name)
  return found ? path.join(drive, COPY_FOLDER_NAME, name) : null
}

// Picks the drive for the second copy (one of listDrives()), or null to stop copying
export function setCopyDrive(drive) {
  saveSettings({ copy_drive: drive, last_copy_at: null, last_copy_error: null })
}

let copying = null

// Copies every backup the drive doesn't have yet (or that changed since). Does nothing when no
// drive is set up or it isn't plugged in. Returns how many backups were copied.
export function copyBackupsNow() {
  // Two copies at once would write the same files
  if (!copying) copying = copyAll().finally(() => (copying = null))
  return copying
}

async function copyAll() {
  const target = copyTarget()
  if (!target || !isPluggedIn(target)) return 0
  let copied = 0
  try {
    await fs.promises.mkdir(target.folder, { recursive: true })
    for (const backup of listBackups()) {
      const from = path.join(BACKUP_DIR, backup.name)
      const to = path.join(target.folder, backup.name)
      const source = await fs.promises.stat(from)
      const there = await fs.promises.stat(to).catch(() => null)
      // USB sticks often keep times only to the nearest 2 seconds
      if (there && there.size === source.size && Math.abs(there.mtimeMs - source.mtimeMs) <= 2000) continue
      await fs.promises.copyFile(from, to + '.part')
      await fs.promises.utimes(to + '.part', source.atime, source.mtime)
      await fs.promises.rename(to + '.part', to)
      copied++
    }
    removeOldBackups(target.folder)
    // Saved only when something changed, not every minute
    const before = settings()
    if (copied || before.last_copy_error || !before.last_copy_at) {
      saveSettings({ last_copy_at: new Date().toISOString(), last_copy_error: null })
    }
    if (copied) console.log(`Copied ${copied} backup(s) to ${target.folder}`)
  } catch (err) {
    const message = err.code === 'ENOSPC' ? 'The drive is full' : err.message
    if (settings().last_copy_error !== message) console.error(`Could not copy backups to ${target.folder}: ${message}`)
    saveSettings({ last_copy_error: message })
  }
  return copied
}

// Checks for the drive once a minute while the server runs
export function startCopying() {
  copyBackupsNow()
  setInterval(copyBackupsNow, 60 * 1000).unref()
}
