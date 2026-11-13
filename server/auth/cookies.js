// Reading the session cookies sent by the browser.

// Reads a session token from the request's cookies, or null.
// cookieName is 'admin_session' or 'staff_session'.
export function tokenFromRequest(req, cookieName) {
  const cookies = req.headers.cookie || ''
  for (const part of cookies.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === cookieName) return value.join('=')
  }
  return null
}
