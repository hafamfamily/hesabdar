// @ts-check
import express from 'express'
import { existsSync } from 'node:fs'
import { checkPassword, createDevice, deviceForToken, hasPassword, listDevices, LoginLimiter, revokeDevice, setPassword } from './auth.js'
import { applyOps, changesSince, stats } from './records.js'
import { isLoopback, isPrivateIp, normalizeIp } from './net.js'

export const VERSION = '0.3.0'

/**
 * @param {object} o
 * @param {import('node:sqlite').DatabaseSync} o.db
 * @param {import('./config.js').Config} o.config
 * @param {() => object} [o.status] اطلاعات وضعیت برای نمایش (mDNS، گواهی)
 * @param {(req: import('express').Request) => string | undefined} [o.remoteAddress] فقط برای تست؛ در اجرای واقعی نشانی سوکت
 */
export function createApp({ db, config, status = () => ({}), remoteAddress = (req) => req.socket.remoteAddress }) {
  const app = express()
  const limiter = new LoginLimiter()
  app.disable('x-powered-by')
  app.set('trust proxy', false)

  // ۱) فقط شبکهٔ خصوصی
  app.use((req, res, next) => {
    if (config.allowAnyNetwork || isPrivateIp(remoteAddress(req))) return next()
    res.status(403).type('text/plain').send('Forbidden')
  })

  // ۲) سرآیندهای امنیتی
  app.use((_req, res, next) => {
    res.set({
      'Content-Security-Policy':
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data: blob:; connect-src 'self'; manifest-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    })
    next()
  })

  const api = express.Router()
  api.use(express.json({ limit: '4mb' }))
  api.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  api.get('/health', (_req, res) => {
    res.json({ ok: true, app: 'dakhl-o-kharj', version: VERSION, needsSetup: !hasPassword(db), time: new Date().toISOString() })
  })

  // راه‌اندازی اولیهٔ گذرواژه: فقط یک بار و فقط از خود لپ‌تاپ
  api.post('/auth/setup', (req, res) => {
    if (!isLoopback(remoteAddress(req))) return res.status(403).json({ error: 'تعیین گذرواژه فقط از روی خود لپ‌تاپ ممکن است' })
    if (hasPassword(db)) return res.status(409).json({ error: 'گذرواژه قبلاً تعیین شده است' })
    try {
      setPassword(db, req.body?.password)
      res.json({ ok: true })
    } catch (e) {
      res.status(400).json({ error: /** @type {Error} */ (e).message })
    }
  })

  // جفت کردن دستگاه: گذرواژه ← توکن دستگاه
  api.post('/auth/pair', (req, res) => {
    const key = normalizeIp(remoteAddress(req))
    if (limiter.blocked(key)) return res.status(429).json({ error: 'تلاش‌های ناموفق زیاد بود؛ ۱۵ دقیقهٔ دیگر دوباره امتحان کنید' })
    if (!hasPassword(db)) return res.status(409).json({ error: 'ابتدا روی لپ‌تاپ گذرواژهٔ سرور را تعیین کنید' })
    const { password, deviceName } = req.body ?? {}
    if (!checkPassword(db, password)) {
      limiter.fail(key)
      return res.status(401).json({ error: 'گذرواژه نادرست است' })
    }
    limiter.reset(key)
    const name = typeof deviceName === 'string' && deviceName.trim() ? deviceName.trim().slice(0, 40) : 'دستگاه'
    const dev = createDevice(db, name)
    res.json({ deviceId: dev.id, token: dev.token, name })
  })

  // از اینجا به بعد: فقط دستگاه‌های جفت‌شده
  api.use((req, res, next) => {
    const h = req.get('authorization') ?? ''
    const token = h.startsWith('Bearer ') ? h.slice(7) : ''
    const dev = deviceForToken(db, token)
    if (!dev) return res.status(401).json({ error: 'دستگاه شناخته نشد؛ دوباره جفت کنید' })
    res.locals.device = dev
    next()
  })

  api.get('/status', (_req, res) => res.json({ ...stats(db), device: res.locals.device, ...status() }))

  api.get('/devices', (_req, res) => res.json({ devices: listDevices(db), current: res.locals.device.id }))
  api.delete('/devices/:id', (req, res) => {
    res.json({ ok: revokeDevice(db, String(req.params.id)) })
  })

  api.get('/changes', (req, res) => {
    const since = Number(req.query.since ?? 0)
    const limit = Number(req.query.limit ?? 500)
    if (!Number.isInteger(since) || since < 0 || !Number.isInteger(limit)) return res.status(400).json({ error: 'پارامتر نامعتبر' })
    res.json(changesSince(db, since, limit))
  })

  api.post('/changes', (req, res) => {
    try {
      res.json({ results: applyOps(db, req.body?.ops, res.locals.device.id) })
    } catch (e) {
      res.status(400).json({ error: /** @type {Error} */ (e).message })
    }
  })

  api.use((_req, res) => res.status(404).json({ error: 'یافت نشد' }))
  app.use('/api', api)

  // فایل‌های برنامه (همان مبدأ؛ نیازی به CORS نیست)
  if (existsSync(config.clientDir)) {
    app.use(
      express.static(config.clientDir, {
        dotfiles: 'deny',
        index: 'index.html',
        setHeaders: (res, path) => {
          // index و service worker همیشه تازه؛ فایل‌های دارای هش، قابل کش طولانی
          if (/index\.html$|sw\.js$|manifest/.test(path)) res.set('Cache-Control', 'no-cache')
          else if (/[\\/]assets[\\/]/.test(path)) res.set('Cache-Control', 'public, max-age=31536000, immutable')
        },
      }),
    )
  } else {
    app.get('/', (_req, res) => res.type('text/plain; charset=utf-8').send('برنامه هنوز ساخته نشده است. در پوشهٔ پروژه دستور npm run build را اجرا کنید.'))
  }

  // خطاها بدون جزئیات داخلی
  app.use((/** @type {any} */ err, /** @type {any} */ _req, /** @type {import('express').Response} */ res, /** @type {any} */ _next) => {
    const status = err?.type === 'entity.too.large' ? 413 : err?.type === 'entity.parse.failed' ? 400 : 500
    if (status === 500) console.error('[خطا]', err)
    res.status(status).json({ error: status === 500 ? 'خطای داخلی سرور' : 'درخواست نامعتبر' })
  })
  return app
}


