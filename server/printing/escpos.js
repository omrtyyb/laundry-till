// ESC/POS: the commands almost every receipt printer understands (bold, big text, cut, cash drawer).
import { layOut } from './receiptLayout.js'

const ESC = 0x1b
const GS = 0x1d

// Letters outside plain English, as bytes in the PC437 / PC850 / PC858 character sets.
// Others are swapped for the nearest plain letter, or "?".
const SPECIAL = { '£': 0x9c, 'é': 0x82, 'è': 0x8a, 'ê': 0x88, 'à': 0x85, 'â': 0x83, 'ç': 0x87, 'ü': 0x81, 'ö': 0x94, 'ä': 0x84, 'ñ': 0xa4, 'Ç': 0x80, 'Ü': 0x9a, 'Ö': 0x99, 'É': 0x90 }
const PLAIN = { 'ı': 'i', 'İ': 'I', 'ş': 's', 'Ş': 'S', 'ğ': 'g', 'Ğ': 'G', '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '—': '-', '×': 'x', '…': '...' }

// The bytes for some text in the printer's character set
function encode(text, codePage) {
  const bytes = []
  for (const char of text) {
    const code = char.codePointAt(0)
    if (code >= 0x20 && code < 0x7f) bytes.push(code)
    else if (char === '€' && codePage === 19) bytes.push(0xd5)
    else if (SPECIAL[char] !== undefined) bytes.push(SPECIAL[char])
    else {
      const plain = PLAIN[char] ?? char.normalize('NFD').replace(/[̀-ͯ]/g, '')
      for (const c of plain) bytes.push(c.charCodeAt(0) >= 0x20 && c.charCodeAt(0) < 0x7f ? c.charCodeAt(0) : 0x3f)
    }
  }
  return bytes
}

// A Code 128 barcode in the middle of the line, drawn by the printer itself (GS k, which
// Epson, Xprinter, Rongta, HOIN, Munbyn and other ESC/POS printers all have). Bars are 2 dots
// wide on 58mm paper and 3 on 80mm; about 8mm tall; no number printed under it.
function barcode(value, settings) {
  const data = [...'{B', ...value].map((c) => c.charCodeAt(0) & 0x7f) // {B: Code 128 set B (letters and numbers)
  return [
    ESC, 0x61, 1, // centre
    GS, 0x48, 0, // no text under the bars
    GS, 0x68, 64, // height in dots
    GS, 0x77, settings.chars >= 48 ? 3 : 2, // bar width
    GS, 0x6b, 73, data.length, ...data, // print Code 128
    ESC, 0x61, 0, // back to the left
  ]
}

// The bytes to send to the printer for these receipt lines
export function escpos(lines, settings) {
  const bytes = [ESC, 0x40, ESC, 0x74, settings.code_page] // reset, character set
  for (const row of layOut(lines, settings.chars)) {
    if (row.barcode) {
      bytes.push(...barcode(row.barcode, settings))
      continue
    }
    bytes.push(ESC, 0x45, row.bold ? 1 : 0) // bold on/off
    bytes.push(GS, 0x21, row.big ? 0x11 : 0x00) // double width and height on/off
    bytes.push(...encode(row.text.trimEnd(), settings.code_page), 0x0a)
  }
  bytes.push(ESC, 0x45, 0, GS, 0x21, 0)
  bytes.push(ESC, 0x64, settings.feed_lines) // feed blank lines
  if (settings.cut === 'partial') bytes.push(GS, 0x56, 1)
  if (settings.cut === 'full') bytes.push(GS, 0x56, 0)
  if (settings.open_drawer) bytes.push(ESC, 0x70, 0, 25, 250)
  return Buffer.from(bytes)
}
