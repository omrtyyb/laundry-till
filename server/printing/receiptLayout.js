// Receipt lines and how they are laid out in rows of letters.
// A receipt is a list of these:
//   { text, align: 'left' | 'center' | 'right', bold, big }   one line of text (long text wraps)
//   { left, right, bold, big }                                 text on the left, amount on the right
//   { divider: true }                                          a dashed line across
//   { blank: true }                                            an empty line
//   { pre, bold }                                              a row printed exactly as given (cut to fit), e.g. a grid
//   { barcode: 'D123' }                                        a Code 128 barcode, centred (no text under it)
// big text is double width and height, so half as many letters fit on its line.

// Each line the admin typed, centred; an empty line stays as a gap
const centredLines = (text) =>
  text.split('\n').map((line) => (line ? { text: line, align: 'center' } : { blank: true }))

// The top of every receipt: the shop name (big), then the admin's own lines
export function headerLines(settings) {
  const lines = []
  if (settings.shop_name) lines.push({ text: settings.shop_name, align: 'center', bold: true, big: true })
  if (settings.header_text) lines.push(...centredLines(settings.header_text))
  if (lines.length) lines.push({ divider: true })
  return lines
}

// The bottom of every receipt: the admin's own lines, e.g. thank you, address, phone
export function footerLines(settings) {
  return settings.footer ? [{ blank: true }, ...centredLines(settings.footer)] : []
}

// Breaks text into pieces no longer than width, at spaces where possible
function wrap(text, width) {
  const out = []
  for (const paragraph of String(text).split('\n')) {
    let line = ''
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      let rest = word
      while (rest.length > width) {
        if (line) out.push(line), (line = '')
        out.push(rest.slice(0, width))
        rest = rest.slice(width)
      }
      if (!line) line = rest
      else if (line.length + 1 + rest.length <= width) line += ' ' + rest
      else out.push(line), (line = rest)
    }
    out.push(line)
  }
  return out
}

// "Shirt x2" on the left and "£7.00" on the right, filling the line. A long left side
// wraps, and the amount goes on its last line.
function leftRight(left, right, width) {
  const room = Math.max(1, width - right.length - 1)
  const lines = wrap(left, room)
  const last = lines.pop()
  return [...lines, last + ' '.repeat(width - last.length - right.length) + right]
}

// Turns receipt lines into plain text rows: [{ text, bold, big }], every row already padded
// to its alignment. A barcode becomes a row { text: '', barcode }. Used for ESC/POS, and sent to the till for browser printing.
export function layOut(lines, chars) {
  const rows = []
  for (const line of lines) {
    const width = line.big ? Math.floor(chars / 2) : chars
    const style = { bold: Boolean(line.bold), big: Boolean(line.big) }
    if (line.barcode !== undefined) rows.push({ text: '', barcode: String(line.barcode), bold: false, big: false })
    else if (line.pre !== undefined) rows.push({ text: String(line.pre).slice(0, chars), bold: Boolean(line.bold), big: false })
    else if (line.divider) rows.push({ text: '-'.repeat(chars), bold: false, big: false })
    else if (line.blank) rows.push({ text: '', bold: false, big: false })
    else if (line.right !== undefined) {
      for (const text of leftRight(line.left || '', String(line.right), width)) rows.push({ text, ...style })
    } else {
      for (const piece of wrap(line.text || '', width)) {
        const space = width - piece.length
        const pad = line.align === 'center' ? Math.floor(space / 2) : line.align === 'right' ? space : 0
        rows.push({ text: ' '.repeat(pad) + piece, ...style })
      }
    }
  }
  return rows
}
