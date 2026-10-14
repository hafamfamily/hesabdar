// @ts-check
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export const COLLECTIONS = /** @type {const} */ (['transactions', 'categories', 'debts', 'settings'])

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
-- هر رکورد برنامه (تراکنش، دسته، بدهی، تنظیمات) یک ردیف با نسخه و شمارهٔ تغییر
CREATE TABLE IF NOT EXISTS records (
  collection TEXT    NOT NULL CHECK (collection IN ('transactions','categories','debts','settings')),
  id         TEXT    NOT NULL,
  version    INTEGER NOT NULL CHECK (version > 0),
  rev        INTEGER NOT NULL,
  deleted    INTEGER NOT NULL DEFAULT 0 CHECK (deleted IN (0,1)),
  data       TEXT,
  updated_at TEXT    NOT NULL,
  updated_by TEXT,
  PRIMARY KEY (collection, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS records_rev ON records(rev);
-- عملیات اعمال‌شده؛ برای جلوگیری از ثبت تکراری هنگام ارسال دوباره
CREATE TABLE IF NOT EXISTS applied_ops (
  op_id      TEXT PRIMARY KEY,
  result     TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS devices (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  last_seen_at TEXT
);
`

/** @param {string} dataDir */
export function openDatabase(dataDir) {
  mkdirSync(dataDir, { recursive: true })
  const db = new DatabaseSync(join(dataDir, 'dakhl-o-kharj.sqlite'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;')
  db.exec(SCHEMA)
  db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('schema_version', '1')").run()
  db.prepare("INSERT OR IGNORE INTO meta(key, value) VALUES ('rev', '0')").run()
  return db
}

/**
 * اجرای تابع در یک تراکنش SQLite (کامل یا هیچ)
 * @template T
 * @param {DatabaseSync} db
 * @param {() => T} fn
 * @returns {T}
 */
export function inTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE')
  try {
    const out = fn()
    db.exec('COMMIT')
    return out
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}

/** @param {DatabaseSync} db @param {string} key */
export function getMeta(db, key) {
  const row = /** @type {{value: string} | undefined} */ (db.prepare('SELECT value FROM meta WHERE key = ?').get(key))
  return row?.value
}

/** @param {DatabaseSync} db @param {string} key @param {string} value */
export function setMeta(db, key, value) {
  db.prepare('INSERT INTO meta(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value)
}
