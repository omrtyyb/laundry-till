// Sets or resets the admin password. Run it on the shop PC, in the server folder:
//   npm run set-password
// It asks for the new password twice (what you type isn't shown) and logs out every browser.
// Use it the first time, or if the password is forgotten.
import readline from 'node:readline'
import { setPassword, MIN_PASSWORD_LENGTH } from '../auth/adminAuth.js'

// One reader for both questions, set up so what is typed isn't shown
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: Boolean(process.stdin.isTTY),
})
rl._writeToOutput = () => {}

// Typed lines wait here until a question asks for them
const typedLines = []
const waiting = []
rl.on('line', (line) => (waiting.length ? waiting.shift()(line) : typedLines.push(line)))
rl.on('close', () => waiting.forEach((answer) => answer('')))

// Asks a question and waits for the answer
function askHidden(question) {
  process.stdout.write(question)
  return new Promise((resolve) => {
    const answer = (line) => {
      process.stdout.write('\n')
      resolve(line)
    }
    if (typedLines.length) answer(typedLines.shift())
    else waiting.push(answer)
  })
}

const password = await askHidden(`New admin password (at least ${MIN_PASSWORD_LENGTH} characters): `)
const again = await askHidden('Type it again: ')
rl.close()

if (password !== again) {
  console.log('The two passwords are different. Nothing was changed.')
  process.exit(1)
}

try {
  setPassword(password)
  console.log('Admin password saved. Any browser that was logged in has been logged out.')
} catch (err) {
  console.log(err.message + '. Nothing was changed.')
  process.exit(1)
}
