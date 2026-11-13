// Admin log-in: check the session, log in and out, and change the admin password.
import express from 'express'
import { checkPassword, setPassword, hasPassword, isLoggedIn, logIn, logOut, MIN_PASSWORD_LENGTH } from '../../auth/adminAuth.js'

const router = express.Router()

// Is this browser logged in as admin? Also says whether a password has been set yet.
router.get('/api/admin/session', (req, res) => {
  res.json({ loggedIn: isLoggedIn(req), passwordSet: hasPassword() })
})

// Log in with { password }
router.post('/api/admin/login', (req, res) => {
  if (!hasPassword()) {
    return res.status(400).json({
      error: 'No admin password has been set yet. On the shop PC, run "npm run set-password" in the server folder.',
    })
  }
  if (!checkPassword(req.body.password)) {
    return res.status(401).json({ error: 'Wrong password' })
  }
  logIn(res)
  res.json({ loggedIn: true })
})

router.post('/api/admin/logout', (req, res) => {
  logOut(req, res)
  res.json({ loggedIn: false })
})

// Change the password from the Security section: { current_password, new_password }.
// Every other logged-in browser is logged out; this one stays logged in.
router.post('/api/admin/change-password', (req, res) => {
  const { current_password, new_password } = req.body
  if (!checkPassword(current_password)) {
    return res.status(401).json({ error: 'The current password is wrong' })
  }
  if (typeof new_password !== 'string' || new_password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({
      error: `The new password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    })
  }
  setPassword(new_password)
  logIn(res)
  res.json({ changed: true })
})

export default router
