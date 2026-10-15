// @ts-check
// پیام‌های کنسول عمداً انگلیسی هستند: کنسول ویندوز متن فارسی را درست (راست‌به‌چپ) نشان نمی‌دهد.
// راهنمای فارسی: docs/SETUP-WINDOWS.md
import { existsSync, readFileSync } from 'node:fs'
import { createServer as createHttps } from 'node:https'
import { createServer as createHttp } from 'node:http'
import { join } from 'node:path'
import { createApp, VERSION } from './app.js'
import { hasPassword } from './auth.js'
import { loadConfig } from './config.js'
import { openDatabase } from './db.js'
import { startMdns } from './mdns.js'
import { lanAddresses } from './net.js'
import { startSetupServer } from './setup-page.js'
import { scheduleBackups } from './backup.js'

const config = loadConfig()
const db = openDatabase(config.dataDir)
const certDir = join(config.dataDir, 'certs')
const certFile = join(certDir, 'cert.pem')
const keyFile = join(certDir, 'key.pem')
const caFile = join(certDir, 'rootCA.pem')
const tls = existsSync(certFile) && existsSync(keyFile)

const appUrls = () => [
  `https://${config.hostname}:${config.port}`,
  ...lanAddresses().map((a) => `https://${a.address}:${config.port}`),
]

let mdnsState = { ok: false, error: 'disabled' }
const app = createApp({ db, config, status: () => ({ tls, mdns: mdnsState, hostname: config.hostname, urls: appUrls() }) })

const line = '-'.repeat(60)
console.log(line)
console.log(`Dakhl-o-Kharj server v${VERSION}`)
console.log(`Data folder : ${config.dataDir}`)
console.log(`Backups     : ${config.backupDir}  (daily while running, last 30 kept)`)

if (tls) {
  const server = createHttps({ cert: readFileSync(certFile), key: readFileSync(keyFile), minVersion: 'TLSv1.2' }, app)
  server.listen(config.port, '0.0.0.0', () => {
    console.log(`App (HTTPS) : https://localhost:${config.port}   (on this laptop)`)
    for (const u of appUrls()) console.log(`              ${u}`)
  })
  startSetupServer({ port: config.setupPort, caPath: caFile, appUrls })
  console.log(`iPhone setup: http://<laptop-ip>:${config.setupPort}  (certificate download page)`)
  for (const a of lanAddresses()) console.log(`              http://${a.address}:${config.setupPort}`)
  if (config.mdns) mdnsState = startMdns(config.hostname, (m) => console.log(m)).state
} else {
  // بدون گواهی: فقط روی خود لپ‌تاپ (localhost یک «زمینهٔ امن» است و برنامه کامل کار می‌کند)
  createHttp(app).listen(config.port, '127.0.0.1', () => {
    console.log(`App         : http://localhost:${config.port}   (this laptop only)`)
    console.log('HTTPS is not set up yet, so the iPhone cannot connect.')
    console.log('Run scripts\\windows\\setup-https.ps1 and restart the server.')
  })
}
if (!hasPassword(db)) console.log('No server password yet: open the app on this laptop > Settings > Server, or run: npm run set-password')
console.log(line)
scheduleBackups(db, config.backupDir, (m) => console.log(m))

const shutdown = () => {
  try {
    db.close()
  } catch {
    /* نادیده */
  }
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
