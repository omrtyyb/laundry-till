// Backup settings: which USB stick or external drive gets a second copy of every backup
// (see lib/backupCopies.js). One row (id = 1), made the first time the admin picks a drive.
//   copy_drive       where the drive is, e.g. /Volumes/SHOP USB (Mac), E:\ (Windows),
//                    /media/shop/USB (Linux); NULL = no second copy
//   last_copy_at     when every backup was last confirmed to be on the drive
//   last_copy_error  why the last copy failed, NULL when it worked
// A restore from a backup keeps this table as it is (see lib/restore.js).
import db from '../connection.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS backup_settings (
    id                  INTEGER PRIMARY KEY CHECK (id = 1),
    copy_drive          TEXT,
    last_copy_at        TEXT,
    last_copy_error     TEXT
  )
`)
