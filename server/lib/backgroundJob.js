// The background backup job: the computer itself runs scripts/nightly-backup.js every night at
// 22:30, whether or not the till is open. Turned on and off in Admin → Backups.
//
//   Mac      a launch agent, ~/Library/LaunchAgents/com.laundrytill.backup.plist. It also runs
//            when you log in, so a night the Mac was switched off is caught up the next morning
//            (a Mac that was asleep runs it when it wakes).
//   Windows  a scheduled task called "Laundry till backup" (Task Scheduler). Runs as soon as it
//            can if the computer was off at 22:30.
//   Linux    two lines in your crontab (crontab -l), marked "# laundry-till-backup": 22:30 and
//            when the computer starts.
//
// The job remembers where the database and backups folder are, so it backs up the same data as
// this server. What it did is written to background-backup.log in the backups folder.
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { DB_PATH } from '../db/index.js'
import { BACKUP_DIR } from './backups.js'

const HOUR = 22
const MINUTE = 30
export const JOB_TIME = `${HOUR}:${String(MINUTE).padStart(2, '0')}`

const SCRIPT = path.resolve(import.meta.dirname, '..', 'scripts', 'nightly-backup.js')
const NODE = process.execPath
const args = () => [SCRIPT, '--db', path.resolve(DB_PATH), '--backups', path.resolve(BACKUP_DIR)]

const MAC_LABEL = 'com.laundrytill.backup'
const MAC_PLIST = path.join(os.homedir(), 'Library', 'LaunchAgents', `${MAC_LABEL}.plist`)
const WINDOWS_TASK = 'Laundry till backup'
const CRON_MARK = '# laundry-till-backup'

const run = (command, commandArgs, input) => {
  const result = spawnSync(command, commandArgs, { input, encoding: 'utf8' })
  if (result.error) throw result.error
  return result
}

const xml = (text) =>
  String(text).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')

// --- Mac ---------------------------------------------------------------------------------------
const macDomain = () => `gui/${process.getuid()}`

function macPlist() {
  const items = [NODE, ...args()].map((item) => `    <string>${xml(item)}</string>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${MAC_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
${items}
  </array>
  <key>WorkingDirectory</key>
  <string>${xml(path.dirname(path.dirname(SCRIPT)))}</string>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key>
    <integer>${HOUR}</integer>
    <key>Minute</key>
    <integer>${MINUTE}</integer>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>StandardErrorPath</key>
  <string>${xml(path.join(path.resolve(BACKUP_DIR), 'background-backup-errors.log'))}</string>
</dict>
</plist>
`
}

const mac = {
  isOn: () => fs.existsSync(MAC_PLIST),
  turnOn() {
    fs.mkdirSync(path.dirname(MAC_PLIST), { recursive: true })
    fs.mkdirSync(path.resolve(BACKUP_DIR), { recursive: true })
    run('launchctl', ['bootout', `${macDomain()}/${MAC_LABEL}`]) // an older copy, if any
    fs.writeFileSync(MAC_PLIST, macPlist())
    const result = run('launchctl', ['bootstrap', macDomain(), MAC_PLIST])
    if (result.status !== 0) {
      fs.rmSync(MAC_PLIST, { force: true })
      throw new Error(`The Mac didn't accept the background job: ${result.stderr.trim()}`)
    }
  },
  turnOff() {
    run('launchctl', ['bootout', `${macDomain()}/${MAC_LABEL}`])
    fs.rmSync(MAC_PLIST, { force: true })
  },
}

// --- Windows -----------------------------------------------------------------------------------
const quoteWindows = (arg) => `"${arg}"`

function windowsTaskXml() {
  const start = new Date()
  start.setHours(HOUR, MINUTE, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  const startText = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(HOUR)}:${pad(MINUTE)}:00`
  return `<?xml version="1.0" encoding="UTF-16"?>
<Task version="1.2" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo><Description>Backs up the laundry till's data every night</Description></RegistrationInfo>
  <Triggers>
    <CalendarTrigger>
      <StartBoundary>${startText}</StartBoundary>
      <Enabled>true</Enabled>
      <ScheduleByDay><DaysInterval>1</DaysInterval></ScheduleByDay>
    </CalendarTrigger>
  </Triggers>
  <Principals><Principal id="Author"><LogonType>InteractiveToken</LogonType><RunLevel>LeastPrivilege</RunLevel></Principal></Principals>
  <Settings>
    <StartWhenAvailable>true</StartWhenAvailable>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <ExecutionTimeLimit>PT1H</ExecutionTimeLimit>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <Enabled>true</Enabled>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>${xml(NODE)}</Command>
      <Arguments>${xml(args().map(quoteWindows).join(' '))}</Arguments>
      <WorkingDirectory>${xml(path.dirname(path.dirname(SCRIPT)))}</WorkingDirectory>
    </Exec>
  </Actions>
</Task>
`
}

const windows = {
  isOn: () => run('schtasks', ['/Query', '/TN', WINDOWS_TASK]).status === 0,
  turnOn() {
    const file = path.join(os.tmpdir(), 'laundry-till-backup-task.xml')
    // Task Scheduler wants the file in UTF-16 with a byte order mark
    fs.writeFileSync(file, Buffer.from('﻿' + windowsTaskXml(), 'utf16le'))
    try {
      const result = run('schtasks', ['/Create', '/TN', WINDOWS_TASK, '/XML', file, '/F'])
      if (result.status !== 0) throw new Error(`Windows didn't accept the background job: ${(result.stderr || result.stdout).trim()}`)
    } finally {
      fs.rmSync(file, { force: true })
    }
  },
  turnOff() {
    run('schtasks', ['/Delete', '/TN', WINDOWS_TASK, '/F'])
  },
}

// --- Linux -------------------------------------------------------------------------------------
const shellQuote = (arg) => `'${arg.replaceAll("'", "'\\''")}'`

const readCrontab = () => {
  const result = run('crontab', ['-l'])
  return result.status === 0 ? result.stdout : '' // no crontab yet
}
const writeCrontab = (text) => {
  const result = run('crontab', ['-'], text)
  if (result.status !== 0) throw new Error(`Could not save the crontab: ${result.stderr.trim()}`)
}
const withoutJob = (text) =>
  text
    .split('\n')
    .filter((line) => line && !line.includes(CRON_MARK))
    .join('\n')

const linux = {
  isOn: () => readCrontab().includes(CRON_MARK),
  turnOn() {
    const command = [NODE, ...args()].map(shellQuote).join(' ') + ' >/dev/null 2>&1'
    const lines = [`${MINUTE} ${HOUR} * * * ${command} ${CRON_MARK}`, `@reboot sleep 120 && ${command} ${CRON_MARK}`]
    const rest = withoutJob(readCrontab())
    writeCrontab([rest, ...lines].filter(Boolean).join('\n') + '\n')
  },
  turnOff() {
    const rest = withoutJob(readCrontab())
    writeCrontab(rest ? rest + '\n' : '')
  },
}

const system = { darwin: mac, win32: windows, linux }[process.platform]

// For Admin → Backups: { supported, on, time, lastRun: the log's last "Backup ..." line or null }
export function jobStatus() {
  if (!system) return { supported: false, on: false, time: JOB_TIME, lastRun: null }
  let lastRun = null
  try {
    const lines = fs.readFileSync(path.join(BACKUP_DIR, 'background-backup.log'), 'utf8').trim().split('\n')
    const line = lines.findLast((text) => text.includes('Backup'))
    // "13/11/2026, 22:30:01  Backup saved" without the long file name
    lastRun = line ? line.replace(/(Backup saved): .*/, '$1') : null
  } catch {
    // never run yet
  }
  let on = false
  try {
    on = system.isOn()
  } catch {
    // the scheduler couldn't be asked
  }
  return { supported: true, on, time: JOB_TIME, lastRun }
}

export function setJob(on) {
  if (!system) throw new Error("Background backups can't be set up on this kind of computer")
  if (on) system.turnOn()
  else system.turnOff()
}
