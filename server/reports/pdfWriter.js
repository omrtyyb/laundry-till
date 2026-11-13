// A very small PDF maker for the reports, so no extra package is needed.
// It can write text (Helvetica or Helvetica-Bold), draw lines and fill boxes.
// Positions are in points (1/72 inch) measured from the TOP-LEFT of the page.
//
//   const pdf = new Pdf()            // A4 landscape
//   pdf.addPage()
//   pdf.text('Hello', 40, 60, { size: 20, bold: true })
//   res.send(pdf.toBuffer())

// Character widths in Helvetica (per 1000 of the font size), for lining up numbers on the right
const WIDTHS = { ' ': 278, '.': 278, ',': 278, ':': 278, '-': 333, '(': 333, ')': 333, '/': 278, '£': 556, '–': 556, '−': 584, '×': 584 }
const widthOf = (char, bold) => WIDTHS[char] ?? (/[0-9]/.test(char) ? 556 : /[il]/.test(char) ? 222 : /[A-Z]/.test(char) ? 667 : bold ? 611 : 556)

// The PDF fonts use the Windows Latin-1 character set; these are the extra characters we need
const SPECIAL = { '£': 0xa3, '–': 0x96, '—': 0x97, '×': 0xd7, '’': 0x92, '−': 0x2d }

function encode(text) {
  const bytes = []
  for (const char of String(text)) {
    let code = SPECIAL[char] ?? char.charCodeAt(0)
    if (code > 255) code = 0x3f // "?" for anything the font can't show
    // ( ) and \ must be escaped inside PDF text
    if (code === 0x28 || code === 0x29 || code === 0x5c) bytes.push(0x5c)
    bytes.push(code)
  }
  return Buffer.from(bytes).toString('latin1')
}

export class Pdf {
  constructor(width = 842, height = 595) {
    this.width = width
    this.height = height
    this.pages = []
  }

  addPage() {
    this.pages.push([])
  }

  get page() {
    return this.pages[this.pages.length - 1]
  }

  // How wide a piece of text is, in points
  measure(text, size = 10, bold = false) {
    return [...String(text)].reduce((sum, char) => sum + widthOf(char, bold), 0) * (size / 1000)
  }

  // Writes text. align 'right' puts the END of the text at x.
  // color is [red, green, blue] from 0 to 1.
  text(value, x, y, { size = 10, bold = false, align = 'left', color = [0, 0, 0] } = {}) {
    const left = align === 'right' ? x - this.measure(value, size, bold) : x
    this.page.push(
      `${color.join(' ')} rg BT /${bold ? 'F2' : 'F1'} ${size} Tf ${left.toFixed(2)} ${(this.height - y).toFixed(2)} Td (${encode(value)}) Tj ET`,
    )
  }

  line(x1, y1, x2, y2, { width = 0.5, gray = 0.75 } = {}) {
    this.page.push(
      `${gray} G ${width} w ${x1} ${this.height - y1} m ${x2} ${this.height - y2} l S`,
    )
  }

  // A filled box; y is its top edge
  box(x, y, w, h, color = [0.95, 0.95, 0.95]) {
    this.page.push(`${color.join(' ')} rg ${x} ${this.height - y - h} ${w} ${h} re f`)
  }

  // Puts everything together into the bytes of a PDF file
  toBuffer() {
    const objects = []
    const add = (body) => objects.push(body) // object number = its position + 1

    add('<< /Type /Catalog /Pages 2 0 R >>')
    add('') // the page list, filled in below
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>')
    add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>')

    const pageNumbers = []
    for (const commands of this.pages) {
      const stream = commands.join('\n')
      add(`<< /Length ${Buffer.byteLength(stream, 'latin1')} >>\nstream\n${stream}\nendstream`)
      const contentNumber = objects.length
      add(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${this.width} ${this.height}] ` +
          `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentNumber} 0 R >>`,
      )
      pageNumbers.push(objects.length)
    }
    objects[1] = `<< /Type /Pages /Kids [${pageNumbers.map((n) => `${n} 0 R`).join(' ')}] /Count ${pageNumbers.length} >>`

    // Write the objects, remembering where each starts for the cross-reference table
    let output = '%PDF-1.4\n'
    const offsets = []
    objects.forEach((body, index) => {
      offsets.push(Buffer.byteLength(output, 'latin1'))
      output += `${index + 1} 0 obj\n${body}\nendobj\n`
    })
    const xref = Buffer.byteLength(output, 'latin1')
    output += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
    output += offsets.map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('')
    output += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    return Buffer.from(output, 'latin1')
  }
}
