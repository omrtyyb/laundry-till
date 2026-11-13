// Makes a complete copy of the database before changing data by hand. Run it in the server folder:
//   npm run backup -- before-discount     makes data/before-discount-20261028.db
import path from 'node:path'
import db, { DB_PATH } from '../db/index.js'
import { backupTo, localDate } from '../lib/backups.js'

const name = (process.argv[2] || 'manual').replace(/[^\w-]/g, '-')
const stamp = localDate().replaceAll('-', '')
const file = await backupTo(path.join(path.dirname(DB_PATH), `before-${name}-${stamp}.db`))
console.log(`Backup saved: ${file}`)
db.close()
