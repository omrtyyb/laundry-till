// The cash drawer: the opening float put in each morning and the cash counted at closing.
// One row per day. What the drawer should hold is worked out from the day's money (see
// lib/cashDrawer.js), so it is never saved here and can't go out of date.
//   opening_float  cash in the drawer at the start of the day (change), e.g. 50
//   counted        cash counted in the drawer at closing (empty until counted)
//   breakdown      the notes and coins counted, as JSON {"20": 3, "0.5": 4} (empty if one total was typed)
//   left_in        cash left in the drawer for tomorrow; the rest (counted - left_in) is taken out to bank
//   note           anything staff want to say, e.g. "gave £5 refund without a ticket"
import db from '../connection.js'

db.exec(`
  CREATE TABLE IF NOT EXISTS cash_counts (
    date                TEXT PRIMARY KEY,
    opening_float       REAL CHECK (opening_float >= 0 AND opening_float = round(opening_float, 2)),
    float_by            INTEGER REFERENCES staff (id),
    float_at            TEXT,
    counted             REAL CHECK (counted >= 0 AND counted = round(counted, 2)),
    breakdown           TEXT,
    left_in             REAL CHECK (left_in >= 0 AND left_in = round(left_in, 2)),
    note                TEXT,
    counted_by          INTEGER REFERENCES staff (id),
    counted_at          TEXT
  )
`)
