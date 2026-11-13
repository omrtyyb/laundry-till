// Receipt printing.
//
// - Almost every receipt printer (Epson, Xprinter, Rongta, HOIN, Munbyn...) understands the
//   same commands, called ESC/POS, so one driver covers them. PRINTER_MODELS fills in the
//   paper width, letters per line and cutter for common models; the admin can change them.
// - Connections:
//     usb:     a printer added on the shop PC (System Settings → Printers). The job is sent
//              with the "lp" command as raw data, so any driver chosen when adding it is fine.
//     network: a printer on the shop network or Wi-Fi, by its IP address (port 9100).
//     browser: no ESC/POS; the till opens the normal print window instead. Works with any
//              printer, even an A4 one.
// - A receipt is a list of simple lines (see the "Receipt lines" comment below). The same
//   list is turned into ESC/POS bytes here, or into a page by the till for browser printing.
import db from '../db/index.js'
import { PRINTER_MODELS, CONNECTIONS, CUTS, CODE_PAGES } from './printerModels.js'
import { DEFAULT_TAG_SETTINGS, checkTagSettings } from './garmentTags.js'

// What every setting is when the admin hasn't changed it
const DEFAULT_SETTINGS = {
  model: 'generic-58',
  connection: 'usb',
  queue: '', // USB: the printer's name on the shop PC
  ip: '', // network
  port: 9100,
  paper: 58,
  chars: 32,
  cut: 'none',
  code_page: 0,
  feed_lines: 4, // blank lines before cutting, so the last line clears the tear bar
  open_drawer: false, // open a cash drawer plugged into the printer
  print_new_tickets: true, // print a ticket as soon as it's saved at the till
  ticket_copies: 1, // 2 prints a second "shop copy" to keep with the clothes
  print_garment_tags: true, // with a new dry cleaning ticket, also print small tags to pin to each piece
  ...DEFAULT_TAG_SETTINGS, // how the tags look and what is on them (see garmentTags.js)
  shop_name: '', // printed big at the very top
  header_text: '', // any lines under the shop name, e.g. the address, phone, opening hours
  footer: 'Thank you!', // any lines at the bottom, e.g. a thank you, the address, phone, website
}

// The longest top or bottom text the admin can save, in letters
const MAX_RECEIPT_TEXT = 600

// The saved settings. configured is false until a printer has been chosen and saved in
// Admin → Printer (a USB printer, a network address, or the print window), so the till
// doesn't try to print new tickets before then. The receipt text can be saved without one.
export function getSettings() {
  const row = db.prepare('SELECT settings FROM printer_settings WHERE id = 1').get()
  const saved = row ? JSON.parse(row.settings) : {}
  // Settings saved before the free text at the top had an address and a phone box instead
  if (saved.header_text === undefined && (saved.shop_address || saved.shop_phone)) {
    saved.header_text = [saved.shop_address, saved.shop_phone && `Tel: ${saved.shop_phone}`].filter(Boolean).join('\n')
  }
  const settings = { ...DEFAULT_SETTINGS, ...saved }
  const printerChosen =
    settings.connection === 'browser' ||
    (settings.connection === 'usb' && Boolean(settings.queue)) ||
    (settings.connection === 'network' && Boolean(settings.ip))
  return { ...settings, configured: Boolean(row) && printerChosen }
}

// Checks and tidies settings sent by the admin. Returns { settings } or { error }.
export function checkSettings(input) {
  const s = { ...getSettings(), ...input }
  if (!PRINTER_MODELS.some((m) => m.id === s.model)) return { error: 'Please choose a printer model' }
  if (!CONNECTIONS.includes(s.connection)) return { error: 'Please choose how the printer is connected' }
  if (!CUTS.includes(s.cut)) return { error: 'Please choose a paper cut option' }
  if (!CODE_PAGES.some((c) => c.id === Number(s.code_page))) return { error: 'Please choose a character set' }
  s.queue = String(s.queue || '').trim()
  s.ip = String(s.ip || '').trim()
  s.port = Number(s.port)
  s.paper = Number(s.paper)
  s.chars = Number(s.chars)
  s.code_page = Number(s.code_page)
  s.feed_lines = Number(s.feed_lines)
  s.open_drawer = Boolean(s.open_drawer)
  s.print_new_tickets = Boolean(s.print_new_tickets)
  s.ticket_copies = Number(s.ticket_copies)
  s.print_garment_tags = Boolean(s.print_garment_tags)
  const tagError = checkTagSettings(s)
  if (tagError) return { error: tagError }
  s.shop_name = String(s.shop_name || '').trim()
  // Top and bottom text keep their line breaks; spaces at the ends of each line are dropped
  for (const key of ['header_text', 'footer']) {
    s[key] = String(s[key] || '')
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
      .trim()
    if (s[key].length > MAX_RECEIPT_TEXT) {
      return { error: `The text at the ${key === 'footer' ? 'bottom' : 'top'} can be at most ${MAX_RECEIPT_TEXT} letters` }
    }
  }
  // A name like "XP-58" is passed to lp on its own, never through a shell, but keep it plain anyway
  if (s.queue && !/^[\w.@-]+$/.test(s.queue)) return { error: 'That printer name is not valid' }
  // The USB printer or network address can be left empty for now (e.g. the printer isn't
  // plugged in yet), so the receipt text can still be saved; printing then says to choose one
  if (s.connection === 'network' && s.ip && !/^[\w.-]+$/.test(s.ip)) return { error: 'That IP address is not valid' }
  if (!Number.isInteger(s.port) || s.port < 1 || s.port > 65535) return { error: 'The port must be a number from 1 to 65535' }
  if (![58, 80].includes(s.paper)) return { error: 'The paper width must be 58mm or 80mm' }
  if (!Number.isInteger(s.chars) || s.chars < 24 || s.chars > 64) return { error: 'Letters per line must be from 24 to 64' }
  if (![1, 2].includes(s.ticket_copies)) return { error: 'Ticket copies must be 1 or 2' }
  if (!Number.isInteger(s.feed_lines) || s.feed_lines < 0 || s.feed_lines > 10) return { error: 'Blank lines before cutting must be from 0 to 10' }
  return { settings: Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map((key) => [key, s[key]])) }
}

// Saves the settings checked by checkSettings
export function saveSettings(settings) {
  db.prepare(
    `INSERT INTO printer_settings (id, settings) VALUES (1, ?)
     ON CONFLICT (id) DO UPDATE SET settings = excluded.settings, updated_at = datetime('now', 'localtime')`,
  ).run(JSON.stringify(settings))
}
