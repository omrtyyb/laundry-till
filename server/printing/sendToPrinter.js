// Sending a receipt to the printer: over USB (the "lp" command) or the network (port 9100),
// or back to the till for the normal print window.
import { execFile } from 'node:child_process'
import net from 'node:net'
import { getSettings } from './printerSettings.js'
import { layOut } from './receiptLayout.js'
import { escpos } from './escpos.js'

// The printers added on the shop PC, for the USB list, e.g. ["XP-58", "EPSON_TM_T20III"]
export function listQueues() {
  return new Promise((resolve) => {
    execFile('lpstat', ['-e'], { timeout: 5000 }, (error, stdout) => {
      resolve(error ? [] : stdout.split('\n').map((line) => line.trim()).filter(Boolean))
    })
  })
}

// Sends bytes to a printer added on the shop PC
function sendUsb(data, queue) {
  return new Promise((resolve, reject) => {
    const job = execFile('lp', ['-d', queue, '-o', 'raw'], { timeout: 15000 }, (error, stdout, stderr) => {
      if (error) reject(new Error(`The printer "${queue}" did not take the job: ${(stderr || error.message).trim()}`))
      else resolve()
    })
    job.stdin.end(data)
  })
}

// Sends bytes to a printer on the network
function sendNetwork(data, host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port })
    socket.setTimeout(5000)
    // Done once the job is sent. Some printers never close the connection themselves; the
    // timeout below closes it then (rejecting after resolving does nothing).
    socket.on('connect', () => socket.end(data, resolve))
    socket.on('timeout', () => {
      socket.destroy()
      reject(new Error(`No answer from the printer at ${host}:${port}. Is it switched on and on the same network?`))
    })
    socket.on('error', (error) => reject(new Error(`Could not reach the printer at ${host}:${port} (${error.code || error.message})`)))
  })
}

// Prints receipt lines with the saved settings. lines can also be a list of receipts
// (e.g. the customer's and the shop's copy of a ticket); each is cut off separately.
// Returns { printed: true }, or for browser printing { browser: true, rows, paper } so the till
// can open the print window.
export async function printLines(lines, settings = getSettings()) {
  const receipts = Array.isArray(lines[0]) ? lines : [lines]
  if ((settings.connection === 'usb' && !settings.queue) || (settings.connection === 'network' && !settings.ip)) {
    throw new Error('No printer is set up yet. Choose one in Admin → Printer.')
  }
  if (settings.connection === 'browser') {
    // One page, with a "cut here" line between the copies
    const rows = receipts.flatMap((receipt, i) => [
      ...(i > 0 ? layOut([{ blank: true }, { text: '- - - cut here - - -', align: 'center' }, { blank: true }], settings.chars) : []),
      ...layOut(receipt, settings.chars),
    ])
    return { browser: true, paper: settings.paper, chars: settings.chars, rows }
  }
  // The cash drawer opens once, with the first copy
  const data = Buffer.concat(
    receipts.map((receipt, i) => escpos(receipt, i === 0 ? settings : { ...settings, open_drawer: false })),
  )
  if (settings.connection === 'usb') await sendUsb(data, settings.queue)
  else await sendNetwork(data, settings.ip, settings.port)
  return { printed: true }
}
