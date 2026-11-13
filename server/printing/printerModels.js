// The receipt printers the app knows about, and the choices for each printer setting.
// Common printers. chars is how many letters fit on one line in the normal font.
export const PRINTER_MODELS = [
  { id: 'generic-58', label: 'Generic 58mm receipt printer', paper: 58, chars: 32, cut: 'none' },
  { id: 'generic-80', label: 'Generic 80mm receipt printer', paper: 80, chars: 48, cut: 'partial' },
  { id: 'epson-tm-t20', label: 'Epson TM-T20 / T20II / T20III', paper: 80, chars: 48, cut: 'partial' },
  { id: 'epson-tm-t82', label: 'Epson TM-T82 / T82II / T82III', paper: 80, chars: 48, cut: 'partial' },
  { id: 'epson-tm-t88', label: 'Epson TM-T88 (IV, V, VI, VII)', paper: 80, chars: 42, cut: 'partial' },
  { id: 'epson-tm-m30', label: 'Epson TM-m30 / m30II', paper: 80, chars: 48, cut: 'partial' },
  { id: 'xprinter-58', label: 'Xprinter XP-58 / XP-58IIH', paper: 58, chars: 32, cut: 'none' },
  { id: 'xprinter-80', label: 'Xprinter XP-80 / XP-Q200 / XP-N160', paper: 80, chars: 48, cut: 'partial' },
  { id: 'rongta-58', label: 'Rongta RP58', paper: 58, chars: 32, cut: 'none' },
  { id: 'rongta-80', label: 'Rongta RP80 / RP326 / RP332', paper: 80, chars: 48, cut: 'partial' },
  { id: 'hoin-58', label: 'HOIN HOP-H58', paper: 58, chars: 32, cut: 'none' },
  { id: 'hoin-80', label: 'HOIN HOP-E801 / H806', paper: 80, chars: 48, cut: 'partial' },
  { id: 'munbyn-80', label: 'Munbyn ITPP047 / P047', paper: 80, chars: 48, cut: 'partial' },
  { id: 'browser', label: 'Any other printer (normal print window)', paper: 80, chars: 48, cut: 'none' },
]

export const CONNECTIONS = ['usb', 'network', 'browser']
export const CUTS = ['partial', 'full', 'none']

// Character sets ("code pages"). All three put £ in the same place.
export const CODE_PAGES = [
  { id: 0, label: 'PC437 (USA, the usual default)' },
  { id: 2, label: 'PC850 (Western Europe)' },
  { id: 19, label: 'PC858 (Western Europe with €)' },
]
