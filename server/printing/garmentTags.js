// Garment tags: small tags printed with a new dry cleaning ticket, to cut out and pin to each
// piece's care label. The admin chooses the style and what is on them in Admin → Printer.
//
// Styles:
//   grid      tags side by side in boxes, on one strip with one cut (saves the most paper
//             when tags show a few things)
//     +--------------+--------------+
//     | 123-1        | 123-2        |
//     | Ayse Yilmaz  | Ayse Yilmaz  |
//     +--------------+--------------+
//   list      one line for each piece, on one strip with one cut
//     123-1  Ayse Yilmaz  Shirt
//     123-2  Ayse Yilmaz  Suit
//   separate  each tag on its own piece of paper, cut off by the printer
//
// Each tag can show: the garment's own number (ticket number - piece number, always shown),
// "2/3", the customer's name (full, surname or first name), the item from the price list,
// the ready day and the last 4 digits of the phone number.

// The most tags printed for one ticket, so a mistyped number of pieces can't use up the roll
export const MAX_TAGS = 50

export const TAG_STYLES = ['grid', 'list', 'separate']
export const TAG_NAMES = ['full', 'surname', 'first', 'none']
export const TAG_ACROSS = [0, 1, 2, 3, 4] // 0: as many as fit nicely (2 on 58mm, 3 on 80mm)

// What every tag setting is when the admin hasn't changed it: a grid with the number and name
export const DEFAULT_TAG_SETTINGS = {
  tag_style: 'grid',
  tag_across: 0,
  tag_name: 'full',
  tag_count: false, // "2/3" after the number
  tag_item: false, // the item, when the price list items add up to the number of pieces
  tag_ready: false, // the ready day
  tag_phone: false, // the last 4 digits of the phone number
  tag_big_number: false, // the number in big letters (list and separate styles)
}

// A made-up ticket for the preview and the test print
export const SAMPLE_TICKET = { id: 123, customer_name: 'Ayse Yilmaz', phone_number: '07700 905678', number_of_pieces: 5, pickup_time: 'Friday' }
export const SAMPLE_ITEMS = [{ item_name: 'Shirt', quantity: 3 }, { item_name: 'Two-piece suit', quantity: 1 }, { item_name: 'Dress', quantity: 1 }]

function nameFor(ticket, how) {
  const words = String(ticket.customer_name || '').trim().split(/\s+/).filter(Boolean)
  if (how === 'none' || words.length === 0) return ''
  if (how === 'surname') return words[words.length - 1].toUpperCase()
  if (how === 'first') return words[0]
  return words.join(' ')
}

// The things on each tag: [{ number, name, item, ready, phone }], one for each piece
function tagFields(ticket, items, s) {
  const pieces = Math.min(ticket.number_of_pieces || 1, MAX_TAGS)
  const names = items.flatMap((item) => Array(item.quantity).fill(item.item_name))
  const itemNames = names.length === ticket.number_of_pieces ? names : []
  const digits = String(ticket.phone_number || '').replace(/\D/g, '')
  const tags = []
  for (let i = 1; i <= pieces; i++) {
    tags.push({
      number: `${ticket.id}-${i}` + (s.tag_count ? ` (${i}/${ticket.number_of_pieces})` : ''),
      name: nameFor(ticket, s.tag_name),
      item: s.tag_item ? itemNames[i - 1] || '' : '',
      ready: s.tag_ready ? `Ready ${ticket.pickup_time}` : '',
      phone: s.tag_phone && digits.length >= 4 ? `Tel ..${digits.slice(-4)}` : '',
    })
  }
  return tags
}

// Which lines each tag has below its number (the same for every tag, so boxes line up)
const extraKeys = (s) => [s.tag_name !== 'none' && 'name', s.tag_item && 'item', s.tag_ready && 'ready', s.tag_phone && 'phone'].filter(Boolean)

function gridLines(tags, s) {
  const chars = s.chars
  const auto = chars >= 48 ? 3 : 2
  let across = s.tag_across || auto
  // Each box needs room for at least 6 letters
  while (across > 1 && Math.floor((chars - 1) / across) - 1 < 7) across--
  const width = Math.floor((chars - 1) / across) - 1
  const cell = (text) => ' ' + String(text).slice(0, width - 1).padEnd(width - 1) + '|'
  const border = '+' + ('-'.repeat(width) + '+').repeat(across)
  const keys = extraKeys(s)
  const lines = [{ pre: border }]
  for (let first = 0; first < tags.length; first += across) {
    const row = Array.from({ length: across }, (_, k) => tags[first + k])
    lines.push({ pre: '|' + row.map((t) => cell(t ? t.number : '')).join(''), bold: true })
    for (const key of keys) lines.push({ pre: '|' + row.map((t) => cell(t ? t[key] : '')).join('') })
    lines.push({ pre: border })
  }
  return lines
}

function listLines(tags, s) {
  const keys = extraKeys(s)
  const lines = []
  tags.forEach((t, i) => {
    if (i > 0) lines.push({ divider: true }) // a line to cut along
    if (s.tag_big_number) {
      lines.push({ text: t.number, bold: true, big: true })
      const rest = keys.map((k) => t[k]).filter(Boolean).join('  ')
      if (rest) lines.push({ text: rest })
    } else {
      lines.push({ text: [t.number, ...keys.map((k) => t[k])].filter(Boolean).join('  ') })
    }
  })
  return lines
}

function separateTag(t, s) {
  const lines = [{ text: t.number, align: 'center', bold: true, big: s.tag_big_number }]
  for (const key of extraKeys(s)) if (t[key]) lines.push({ text: t[key], align: 'center', bold: key === 'name' })
  return lines
}

// The tags for a ticket as a list of receipts (each is cut off separately): one strip for
// the grid and list styles, one for each tag for the separate style.
export function garmentTagReceipts(ticket, items, settings) {
  const s = { ...DEFAULT_TAG_SETTINGS, ...settings }
  const tags = tagFields(ticket, items, s)
  if (s.tag_style === 'separate') return tags.map((t) => separateTag(t, s))
  if (s.tag_style === 'list') return [listLines(tags, s)]
  return [gridLines(tags, s)]
}

// Checks and tidies the tag settings sent by the admin. Returns an error message, or null.
export function checkTagSettings(s) {
  s.tag_across = Number(s.tag_across)
  for (const key of ['tag_count', 'tag_item', 'tag_ready', 'tag_phone', 'tag_big_number']) s[key] = Boolean(s[key])
  if (!TAG_STYLES.includes(s.tag_style)) return 'Please choose a tag style'
  if (!TAG_NAMES.includes(s.tag_name)) return 'Please choose which name goes on the tags'
  if (!TAG_ACROSS.includes(s.tag_across)) return 'Tags across must be from 1 to 4'
  return null
}
