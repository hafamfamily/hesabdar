// @ts-check
import { createInterface } from 'node:readline'
import { listDevices, revokeDevice, setPassword } from './auth.js'
import { loadConfig } from './config.js'
import { openDatabase } from './db.js'

const [cmd, arg] = process.argv.slice(2)
const config = loadConfig()
const db = openDatabase(config.dataDir)

/** خواندن گذرواژه بدون نمایش روی صفحه */
function askHidden(/** @type {string} */ question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true })
    // @ts-ignore بازنویسی خروجی برای پنهان کردن نویسه‌ها
    rl._writeToOutput = (s) => process.stdout.write(s.includes(question) ? s : '*')
    rl.question(question, (a) => {
      rl.close()
      process.stdout.write('\n')
      resolve(a)
    })
  })
}

if (cmd === 'set-password') {
  const p1 = /** @type {string} */ (await askHidden('New server password (min 8 chars): '))
  const p2 = await askHidden('Repeat password: ')
  if (p1 !== p2) {
    console.error('Passwords do not match.')
    process.exit(1)
  }
  try {
    setPassword(db, p1)
    console.log('Password saved. Already paired devices stay paired; revoke them with: npm run devices -- revoke <id>')
  } catch (e) {
    console.error(/** @type {Error} */ (e).message)
    process.exit(1)
  }
} else if (cmd === 'devices') {
  if (arg === 'revoke') {
    const id = process.argv[4]
    console.log(id && revokeDevice(db, id) ? 'Device revoked.' : 'Device not found.')
  } else {
    for (const d of listDevices(db)) console.log(`${d.id}  ${d.name}  paired ${d.createdAt}  last seen ${d.lastSeenAt ?? '-'}`)
  }
} else {
  console.log('Usage: npm run set-password | npm run devices [-- revoke <id>]')
}
db.close()
