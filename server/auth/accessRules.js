// Who may use which routes.
// - The till routes are open to the shop staff (and need a signed-in worker to save anything,
//   see requireStaff in staffAuth.js).
// - The admin routes below need the admin to be logged in.
import { requireAdmin } from './adminAuth.js'
import { requireStaff } from './staffAuth.js'

// Every URL starting with one of these needs the admin password
const ADMIN_ONLY_ROUTES = [
  '/api/daily-summary',
  '/api/daily-takings',
  '/api/daily-chart',
  '/api/uncollected-tickets',
  '/api/reports',
  '/api/admin/change-password',
  '/api/admin/staff',
  '/api/admin/history',
  '/api/admin/price-list',
  '/api/admin/service-wash-prices',
  '/api/admin/products',
  '/api/admin/tickets',
  '/api/admin/printer',
  '/api/admin/backups',
  '/api/admin/customers',
  '/api/admin/loyalty',
]
// Express middleware for the whole app: turns away admin routes unless the admin is logged in
export function adminOnlyRoutes(req, res, next) {
  const adminOnly = ADMIN_ONLY_ROUTES.some((route) => req.path === route || req.path.startsWith(route + '/'))
  return adminOnly ? requireAdmin(req, res, next) : next()
}

// New tickets can be made at the till (by the signed-in worker) or in Admin → Tickets.
// The admin routes are already checked by the admin password above; their tickets have no
// worker's name and are written to the edit history.
export function staffOrAdmin(req, res, next) {
  if (req.path.startsWith('/api/admin/')) {
    req.staffId = null
    req.byAdmin = true
    return next()
  }
  return requireStaff(req, res, next)
}
