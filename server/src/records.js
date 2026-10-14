// @ts-check
import { COLLECTIONS, getMeta, inTransaction, setMeta } from './db.js'
import { isId, validateRecord } from './validate.js'

/** @typedef {import('node:sqlite').DatabaseSync} DB */

/**
 * @typedef {object} Op
 * @property {string} opId         شناسهٔ یکتای عملیات (تکرار آن اثری ندارد)
 * @property {string} collection
 * @property {string} id
 * @property {number} baseVersion  نسخه‌ای که دستگاه تغییر را روی آن انجام داده (۰ = رکورد جدید)
 * @property {boolean} [deleted]
 * @property {unknown} [data]
 */

/** @param {any} row */
function toRecord(row) {
  return {
    collection: row.collection,
    id: row.id,
    version: row.version,
    rev: row.rev,
    deleted: !!row.deleted,
    data: row.data ? JSON.parse(row.data) : null,
    updatedAt: row.updated_at,
  }
}

/**
 * اعمال یک دسته عملیات. هر عملیات جداگانه بررسی می‌شود:
 *  - ok: اعمال شد (نسخهٔ جدید برگردانده می‌شود)
 *  - duplicate: قبلاً با همین opId اعمال شده بود (همان نتیجهٔ قبلی)
 *  - conflict: نسخهٔ سرور با baseVersion فرق دارد؛ نسخهٔ سرور برگردانده می‌شود و چیزی بازنویسی نمی‌شود
 *  - invalid: داده نامعتبر است
 * @param {DB} db
 * @param {Op[]} ops
 * @param {string} deviceId
 */
export function applyOps(db, ops, deviceId) {
  if (!Array.isArray(ops) || ops.length > 500) throw new Error('تعداد عملیات نامعتبر است')
  const getOp = db.prepare('SELECT result FROM applied_ops WHERE op_id = ?')
  const getRec = db.prepare('SELECT * FROM records WHERE collection = ? AND id = ?')
  const upsert = db.prepare(`INSERT INTO records(collection, id, version, rev, deleted, data, updated_at, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET version = excluded.version, rev = excluded.rev, deleted = excluded.deleted,
      data = excluded.data, updated_at = excluded.updated_at, updated_by = excluded.updated_by`)
  const saveOp = db.prepare('INSERT INTO applied_ops(op_id, result, applied_at) VALUES (?, ?, ?)')

  return inTransaction(db, () =>
    ops.map((op) => {
      if (!op || typeof op !== 'object' || !isId(op.opId)) return { opId: op?.opId ?? null, status: 'invalid', error: 'شناسهٔ عملیات نامعتبر است' }
      const prev = /** @type {{result: string} | undefined} */ (getOp.get(op.opId))
      if (prev) return { ...JSON.parse(prev.result), status: 'duplicate' }
      if (!COLLECTIONS.includes(/** @type {any} */ (op.collection))) return { opId: op.opId, status: 'invalid', error: 'نوع داده نامعتبر است' }
      if (!Number.isInteger(op.baseVersion) || op.baseVersion < 0) return { opId: op.opId, status: 'invalid', error: 'نسخهٔ پایه نامعتبر است' }
      const deleted = op.deleted === true
      if (!deleted) {
        const err = validateRecord(op.collection, op.id, op.data)
        if (err) return { opId: op.opId, status: 'invalid', error: err }
      } else if (!isId(op.id)) return { opId: op.opId, status: 'invalid', error: 'شناسه نامعتبر است' }

      const cur = /** @type {any} */ (getRec.get(op.collection, op.id))
      const curVersion = cur?.version ?? 0
      if (curVersion !== op.baseVersion) return { opId: op.opId, status: 'conflict', server: cur ? toRecord(cur) : null }

      const rev = Number(getMeta(db, 'rev')) + 1
      setMeta(db, 'rev', String(rev))
      const version = curVersion + 1
      const now = new Date().toISOString()
      upsert.run(op.collection, op.id, version, rev, deleted ? 1 : 0, deleted ? null : JSON.stringify(op.data), now, deviceId)
      const result = { opId: op.opId, status: 'ok', collection: op.collection, id: op.id, version, rev }
      saveOp.run(op.opId, JSON.stringify(result), now)
      return result
    }),
  )
}

/**
 * تغییرات پس از یک شمارهٔ تغییر (برای دریافت توسط دستگاه‌ها)
 * @param {DB} db
 * @param {number} since
 * @param {number} limit
 */
export function changesSince(db, since, limit = 500) {
  const lim = Math.min(Math.max(1, limit), 1000)
  const rows = /** @type {any[]} */ (db.prepare('SELECT * FROM records WHERE rev > ? ORDER BY rev LIMIT ?').all(since, lim + 1))
  const hasMore = rows.length > lim
  const page = rows.slice(0, lim).map(toRecord)
  return { changes: page, cursor: page.length ? page[page.length - 1].rev : since, hasMore }
}

export function stats(/** @type {DB} */ db) {
  const counts = /** @type {any[]} */ (db.prepare('SELECT collection, COUNT(*) AS n FROM records WHERE deleted = 0 GROUP BY collection').all())
  return { rev: Number(getMeta(db, 'rev')), counts: Object.fromEntries(counts.map((r) => [r.collection, r.n])) }
}
