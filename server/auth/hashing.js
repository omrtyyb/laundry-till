// Hashing for passwords, PINs and session tokens, so none of them are stored as typed.
import crypto from 'node:crypto'

// Turns a password (or a staff PIN) into a hash. The same password and salt always give the same hash.
export function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 64).toString('hex')
}
// A session token's SHA-256 hash, which is what the database keeps
export const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex')
