// Admin → Export to Excel: e.g. /api/reports/excel?from=2026-11-01&to=2026-11-30 downloads
// laundry-till-2026-11-01-to-2026-11-30.xlsx (see reports/excelExport.js for what's in it).
import express from 'express'
import { checkDate } from '../../lib/dates.js'
import { excelExport } from '../../reports/excelExport.js'

const router = express.Router()

router.get('/api/reports/excel', async (req, res) => {
  const from = String(req.query.from || '')
  const to = String(req.query.to || '')
  const error = checkDate(from) || checkDate(to)
  if (error) return res.status(400).json({ error })
  if (from > to) return res.status(400).json({ error: 'The first date must be before the last date' })
  try {
    const file = await excelExport(from, to)
    const name = from === to ? `laundry-till-${from}.xlsx` : `laundry-till-${from}-to-${to}.xlsx`
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    res.setHeader('Content-Disposition', `attachment; filename="${name}"`)
    res.send(file)
  } catch (err) {
    console.error(`Excel export failed: ${err.message}`)
    res.status(500).json({ error: `The Excel file could not be made: ${err.message}` })
  }
})

export default router
