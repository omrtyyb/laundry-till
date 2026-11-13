// Helpers for adding columns to tables made by an older version of the app.
import db from './connection.js'

// true if the table already has this column
export const hasColumn = (table, column) =>
  db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column)

// Adds a column holding a worker's id (from the staff table), if it isn't there yet
export const addStaffColumn = (table, column) => {
  if (!hasColumn(table, column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} INTEGER REFERENCES staff (id)`)
  }
}
