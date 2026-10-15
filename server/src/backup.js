// @ts-check
import { existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { getMeta, setMeta } from './db.js'

/** @typedef {import('node:sqlite').DatabaseSync} DB */

const PREFIX = 'dakhl-o-kharj-'
const KEEP = 30
const DAY = 24 * 60 * 60_000

/**
 * پشتیبان کامل و سازگار از پایگاه داده با VACUUM INTO (حتی هنگام کار سرور، بدون قفل طولانی).
 * فقط ۳۰ پشتیبان آخر نگه داشته می‌شود.
 * @param {DB} db
 * @param {string} dir
 */
export function backupNow(db, dir) {
  mkdirSync(dir, { recursive: true })
  const d = new Date()
  const p = (/** @type {number} */ n) => String(n).padStart(2, '0')
  const base = `${PREFIX}${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  let file = join(dir, `${base}.sqlite`)
  for (let i = 2; existsSync(file); i++) file = join(dir, `${base}-${i}.sqlite`)
  db.prepare('VACUUM INTO ?').run(file)
  const at = d.toISOString()
  setMeta(db, 'last_backup', JSON.stringify({ at, file }))
  prune(dir)
  return { at, file }
}

/** @param {string} dir */
function prune(dir) {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(PREFIX) && f.endsWith('.sqlite'))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.t - a.t)
  for (const { f } of files.slice(KEEP)) unlinkSync(join(dir, f))
}

/** @param {DB} db @returns {{at: string, file: string} | null} */
export function lastBackup(db) {
  const v = getMeta(db, 'last_backup')
  return v ? JSON.parse(v) : null
}

/**
 * پشتیبان روزانه هنگام روشن بودن سرور: هنگام شروع (اگر بیش از ۲۴ ساعت گذشته) و سپس هر ساعت بررسی
 * @param {DB} db
 * @param {string} dir
 * @param {(m: string) => void} log
 */
export function scheduleBackups(db, dir, log = () => {}) {
  const tick = () => {
    const last = lastBackup(db)
    if (last && Date.now() - Date.parse(last.at) < DAY) return
    try {
      const r = backupNow(db, dir)
      log(`Backup saved: ${r.file}`)
    } catch (e) {
      log(`Backup FAILED: ${/** @type {Error} */ (e).message}`)
    }
  }
  tick()
  const timer = setInterval(tick, 60 * 60_000)
  timer.unref()
  return () => clearInterval(timer)
}
