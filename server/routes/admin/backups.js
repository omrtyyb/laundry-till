// Admin → Backups: the list of database backups, "Back up now", downloading, deleting and
// restoring a backup, the USB stick / external drive that gets a second copy, and the background
// job that backs up when the till isn't open. The work itself is done in lib/backups.js,
// lib/restore.js, lib/backupCopies.js and lib/backgroundJob.js.
import express from 'express'
import fs from 'node:fs'
import { listBackups, manualBackup, backupPath, deleteBackup } from '../../lib/backups.js'
import { restoreBackup } from '../../lib/restore.js'
import {
  listDrives,
  copyStatus,
  setCopyDrive,
  copyBackupsNow,
  backupsOnDrives,
  driveBackupPath,
} from '../../lib/backupCopies.js'
import { jobStatus, setJob } from '../../lib/backgroundJob.js'
import { logEdit } from '../../lib/editHistory.js'

const router = express.Router()

const everything = () => ({
  backups: listBackups(),
  copy: copyStatus(),
  drives: listDrives({ includeReadOnly: true }),
  onDrives: backupsOnDrives(),
  backgroundJob: jobStatus(),
})

// GET /api/admin/backups →
//   { backups: [{ name, kind, size, savedAt }] newest first,
//     copy: { drive, folder, pluggedIn, lastCopyAt, lastError, onDrive },
//     drives: [{ path, name, free, readOnly }]  (USB sticks and drives plugged in now),
//     onDrives: [{ drive, driveName, name, kind, size, savedAt }]  (backups on those drives),
//     backgroundJob: { supported, on, time, lastRun } }
router.get('/api/admin/backups', (req, res) => {
  res.json(everything())
})

// POST /api/admin/backups → makes a manual backup now. The answer is sent a line at a time
// (one JSON object per line) so the page can show a progress bar:
//   {"progress":0.45,"stage":"Copying"} ... then {"done":true,"name":"laundry-till-manual-...db"}
//   or {"error":"..."} if it failed.
router.post('/api/admin/backups', async (req, res) => {
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache')
  const send = (message) => res.write(JSON.stringify(message) + '\n')
  try {
    const file = await manualBackup((progress, stage) => send({ progress, stage }))
    const name = file.split(/[\\/]/).pop()
    logEdit({ action: 'Backup made', details: name, byAdmin: true })
    copyBackupsNow()
    send({ done: true, name })
  } catch (err) {
    console.error(`Manual backup failed: ${err.message}`)
    send({ error: `The backup could not be made: ${err.message}` })
  }
  res.end()
})

// PUT /api/admin/backups/copy-drive { drive: "/Volumes/SHOP USB" } → copies go to that drive
// from now on (it must be plugged in); { drive: null } stops the copies
router.put('/api/admin/backups/copy-drive', async (req, res) => {
  const drive = req.body?.drive ?? null
  if (drive !== null && !listDrives().some((found) => found.path === drive)) {
    return res.status(400).json({ error: "That drive isn't plugged in" })
  }
  setCopyDrive(drive)
  logEdit({ action: drive ? 'Backup copies to drive' : 'Backup copies stopped', details: drive || '', byAdmin: true })
  if (drive) await copyBackupsNow()
  res.json(everything())
})

// POST /api/admin/backups/copy-now → copies any missing backups to the drive now
router.post('/api/admin/backups/copy-now', async (req, res) => {
  await copyBackupsNow()
  res.json(everything())
})

// PUT /api/admin/backups/background-job { on: true | false }
router.put('/api/admin/backups/background-job', (req, res) => {
  const on = req.body?.on === true
  try {
    setJob(on)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  logEdit({ action: on ? 'Background backups on' : 'Background backups off', details: '', byAdmin: true })
  res.json(everything())
})

// GET /api/admin/backups/laundry-till-2026-11-06.db/download → the backup file
router.get('/api/admin/backups/:name/download', (req, res) => {
  const file = backupPath(req.params.name)
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'Backup not found' })
  res.download(file, req.params.name)
})

// POST /api/admin/backups/laundry-till-2026-11-06.db/restore → the till's data is replaced with
// that backup's, after saving the data as it is now as a "before restore" backup.
//   → { restored: name, beforeRestore: "laundry-till-before-restore-...db" }
router.post('/api/admin/backups/:name/restore', async (req, res) => {
  const { name } = req.params
  const file = backupPath(name)
  if (!file || !fs.existsSync(file)) return res.status(404).json({ error: 'Backup not found' })
  try {
    const beforeRestore = await restoreBackup(name)
    logEdit({ action: 'Restored from backup', details: `${name} (the data before was saved as ${beforeRestore})`, byAdmin: true })
    console.log(`Restored from backup ${name}; the data before was saved as ${beforeRestore}`)
    copyBackupsNow()
    res.json({ restored: name, beforeRestore })
  } catch (err) {
    console.error(`Restore from ${name} failed: ${err.message}`)
    res.status(500).json({ error: `The backup could not be restored: ${err.message}. Nothing was changed.` })
  }
})

// POST /api/admin/backups/restore-from-drive { drive: "/Volumes/SHOP USB", name: "laundry-till-2026-11-06.db" }
// → restores a backup straight from the USB drive (e.g. on a new computer), the same way as above
router.post('/api/admin/backups/restore-from-drive', async (req, res) => {
  const { drive, name } = req.body || {}
  const file = typeof drive === 'string' && typeof name === 'string' ? driveBackupPath(drive, name) : null
  if (!file) return res.status(404).json({ error: "That backup isn't on a plugged-in drive" })
  try {
    const beforeRestore = await restoreBackup(name, file)
    logEdit({
      action: 'Restored from backup',
      details: `${name} on drive ${drive} (the data before was saved as ${beforeRestore})`,
      byAdmin: true,
    })
    console.log(`Restored from backup ${file}; the data before was saved as ${beforeRestore}`)
    copyBackupsNow()
    res.json({ restored: name, beforeRestore })
  } catch (err) {
    console.error(`Restore from ${file} failed: ${err.message}`)
    res.status(500).json({ error: `The backup could not be restored: ${err.message}. Nothing was changed.` })
  }
})

// DELETE /api/admin/backups/laundry-till-manual-2026-11-13-114010.db
router.delete('/api/admin/backups/:name', (req, res) => {
  if (!deleteBackup(req.params.name)) return res.status(404).json({ error: 'Backup not found' })
  logEdit({ action: 'Backup deleted', details: req.params.name, byAdmin: true })
  res.json(everything())
})

export default router
