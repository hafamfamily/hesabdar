// @ts-check
import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { getMeta, setMeta } from './db.js'

/** @typedef {import('node:sqlite').DatabaseSync} DB */

const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
export const MIN_PASSWORD = 8

/** هش گذرواژه با scrypt و نمک تصادفی؛ گذرواژه هرگز به‌صورت متن ساده ذخیره نمی‌شود */
export function hashPassword(/** @type {string} */ password) {
  const salt = randomBytes(16)
  const hash = scryptSync(password.normalize('NFC'), salt, 32, SCRYPT)
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`
}

export function verifyPassword(/** @type {string} */ password, /** @type {string} */ stored) {
  const [alg, N, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt') return false
  const expected = Buffer.from(hash, 'base64')
  const actual = scryptSync(password.normalize('NFC'), Buffer.from(salt, 'base64'), expected.length, {
    N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
  })
  return timingSafeEqual(actual, expected)
}

export const sha256 = (/** @type {string} */ s) => createHash('sha256').update(s).digest('hex')

export function hasPassword(/** @type {DB} */ db) {
  return !!getMeta(db, 'password_hash')
}

export function setPassword(/** @type {DB} */ db, /** @type {string} */ password) {
  if (typeof password !== 'string' || [...password].length < MIN_PASSWORD) throw new Error(`گذرواژه باید حداقل ${MIN_PASSWORD} نویسه باشد`)
  if (password.length > 200) throw new Error('گذرواژه بیش از حد طولانی است')
  setMeta(db, 'password_hash', hashPassword(password))
}

export function checkPassword(/** @type {DB} */ db, /** @type {string} */ password) {
  const stored = getMeta(db, 'password_hash')
  if (!stored || typeof password !== 'string' || password.length > 200) return false
  return verifyPassword(password, stored)
}

/** ساخت دستگاه جدید با توکن تصادفی؛ فقط هش توکن ذخیره می‌شود */
export function createDevice(/** @type {DB} */ db, /** @type {string} */ name) {
  const token = randomBytes(32).toString('base64url')
  const id = randomUUID()
  db.prepare('INSERT INTO devices(id, name, token_hash, created_at) VALUES (?, ?, ?, ?)').run(id, name, sha256(token), new Date().toISOString())
  return { id, token }
}

/** @returns {{id: string, name: string} | undefined} */
export function deviceForToken(/** @type {DB} */ db, /** @type {string} */ token) {
  if (!token || token.length > 100) return undefined
  const row = /** @type {any} */ (db.prepare('SELECT id, name FROM devices WHERE token_hash = ?').get(sha256(token)))
  if (!row) return undefined
  db.prepare('UPDATE devices SET last_seen_at = ? WHERE id = ?').run(new Date().toISOString(), row.id)
  return { id: row.id, name: row.name }
}

export function listDevices(/** @type {DB} */ db) {
  return /** @type {any[]} */ (db.prepare('SELECT id, name, created_at AS createdAt, last_seen_at AS lastSeenAt FROM devices ORDER BY created_at').all())
}

export function revokeDevice(/** @type {DB} */ db, /** @type {string} */ id) {
  return Number(db.prepare('DELETE FROM devices WHERE id = ?').run(id).changes) > 0
}

/**
 * محدودیت تلاش برای ورود: حداکثر ۵ تلاش ناموفق در ۱۵ دقیقه برای هر نشانی
 */
export class LoginLimiter {
  constructor(max = 5, windowMs = 15 * 60_000) {
    this.max = max
    this.windowMs = windowMs
    /** @type {Map<string, number[]>} */
    this.fails = new Map()
  }
  /** @param {string} key */
  blocked(key, now = Date.now()) {
    const list = (this.fails.get(key) ?? []).filter((t) => now - t < this.windowMs)
    this.fails.set(key, list)
    return list.length >= this.max
  }
  /** @param {string} key */
  fail(key, now = Date.now()) {
    this.fails.set(key, [...(this.fails.get(key) ?? []), now])
  }
  /** @param {string} key */
  reset(key) {
    this.fails.delete(key)
  }
}
