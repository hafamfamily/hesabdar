import { uuid } from '../lib/id'
import type { AppDB, ConflictEntry, OutboxEntry, ServerRecord, SyncCollection } from './db'

/**
 * همگام‌سازی با سرور لپ‌تاپ.
 *
 * اصول:
 *  - هر تغییر محلی فقط یک «علامت» در outbox می‌گذارد؛ هنگام ارسال، آخرین نسخهٔ محلی رکورد فرستاده می‌شود.
 *  - ترتیب هر دور: اول دریافت (pull)، بعد ارسال (push).
 *  - هر عملیات شناسهٔ یکتا (opId) دارد؛ اگر پاسخ سرور گم شود و دوباره ارسال شود، سرور آن را تکراری تشخیص می‌دهد.
 *  - اگر رکوردی هم‌زمان در دو دستگاه تغییر کرده باشد، «تعارض» ثبت می‌شود و هر دو نسخه نگه داشته می‌شوند
 *    تا کاربر تصمیم بگیرد. هیچ داده‌ای بی‌صدا بازنویسی یا حذف نمی‌شود.
 *  - اگر دو نسخه عملاً یکسان باشند (مثل دسته‌های پیش‌فرض که روی هر دستگاه ساخته می‌شوند)، تعارض ثبت نمی‌شود.
 */

export const SYNC_TABLES = (db: AppDB) => [db.transactions, db.categories, db.debts, db.kv, db.outbox, db.versions, db.conflicts]

const keyOf = (c: SyncCollection, id: string) => `${c}:${id}`

/** علامت‌گذاری رکورد به‌عنوان «همگام‌نشده». باید داخل همان تراکنش نوشتن صدا زده شود (جدول outbox در دامنهٔ تراکنش). */
export async function markDirty(db: AppDB, collection: SyncCollection, id: string): Promise<void> {
  const key = keyOf(collection, id)
  const prev = await db.outbox.get(key)
  await db.outbox.put({
    key,
    collection,
    id,
    opId: uuid(),
    seq: (prev?.seq ?? 0) + 1,
    conflict: prev?.conflict ?? 0,
    changedAt: new Date().toISOString(),
  })
}

// ───────── خواندن/نوشتن رکورد محلی ─────────

/** تنظیمات فونت مخصوص هر دستگاه است و همگام نمی‌شود */
function stripLocalOnly(collection: SyncCollection, data: unknown): unknown {
  if (collection !== 'settings' || !data || typeof data !== 'object') return data
  const { fonts: _f, ...rest } = data as Record<string, unknown>
  return rest
}

export async function readLocal(db: AppDB, collection: SyncCollection, id: string): Promise<unknown | undefined> {
  if (collection === 'settings') return (await db.kv.get('settings'))?.value
  return db.table(collection).get(id)
}

async function writeLocal(db: AppDB, collection: SyncCollection, id: string, data: unknown | null): Promise<void> {
  if (collection === 'settings') {
    if (data === null) return // تنظیمات حذف نمی‌شوند
    const cur = ((await db.kv.get('settings'))?.value ?? {}) as Record<string, unknown>
    await db.kv.put({ key: 'settings', value: { ...(data as object), fonts: cur.fonts ?? (data as Record<string, unknown>).fonts } })
    return
  }
  if (data === null) await db.table(collection).delete(id)
  else await db.table(collection).put(data)
}

/** مقایسهٔ محتوایی دو داده (مستقل از ترتیب کلیدها) */
export function sameData(collection: SyncCollection, a: unknown, b: unknown): boolean {
  const norm = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(norm)
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.keys(v as object)
          .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
          .sort()
          .map((k) => [k, norm((v as Record<string, unknown>)[k])]),
      )
    return v
  }
  return JSON.stringify(norm(stripLocalOnly(collection, a ?? null))) === JSON.stringify(norm(stripLocalOnly(collection, b ?? null)))
}

// ───────── ارتباط با سرور ─────────

export class SyncHttpError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export interface SyncOptions {
  token: string
  baseUrl?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
}

async function api<T>(o: SyncOptions, path: string, init: RequestInit = {}): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 15000)
  let res: Response
  try {
    res = await (o.fetchImpl ?? fetch)(`${o.baseUrl ?? ''}/api${path}`, {
      ...init,
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${o.token}` },
    })
  } catch {
    throw new SyncHttpError('سرور در دسترس نیست', 0)
  } finally {
    clearTimeout(timer)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new SyncHttpError(body?.error ?? 'خطای سرور', res.status)
  return body as T
}

// ───────── دریافت ─────────

async function applyRemote(db: AppDB, rec: ServerRecord): Promise<'applied' | 'skipped' | 'conflict'> {
  const key = keyOf(rec.collection, rec.id)
  const known = (await db.versions.get(key))?.version ?? 0
  if (rec.version <= known) return 'skipped' // این نسخه را قبلاً داریم (مثلاً تغییر خود این دستگاه)
  const marker = await db.outbox.get(key)
  const remoteData = rec.deleted ? null : rec.data
  if (!marker) {
    await writeLocal(db, rec.collection, rec.id, remoteData)
    await db.versions.put({ key, version: rec.version })
    return 'applied'
  }
  const local = (await readLocal(db, rec.collection, rec.id)) ?? null
  if (sameData(rec.collection, local, remoteData)) {
    await db.versions.put({ key, version: rec.version })
    await db.outbox.delete(key)
    await db.conflicts.delete(key)
    return 'applied'
  }
  await db.conflicts.put({ key, collection: rec.collection, id: rec.id, server: rec, createdAt: new Date().toISOString() })
  await db.outbox.update(key, { conflict: 1 })
  return 'conflict'
}

export async function pull(db: AppDB, o: SyncOptions): Promise<{ applied: number; conflicts: number }> {
  let applied = 0
  let conflicts = 0
  for (let guard = 0; guard < 1000; guard++) {
    const since = Number((await db.kv.get('sync-cursor'))?.value ?? 0)
    const page = await api<{ changes: ServerRecord[]; cursor: number; hasMore: boolean }>(o, `/changes?since=${since}&limit=500`)
    await db.transaction('rw', SYNC_TABLES(db), async () => {
      for (const rec of page.changes) {
        const r = await applyRemote(db, rec)
        if (r === 'applied') applied++
        if (r === 'conflict') conflicts++
      }
      await db.kv.put({ key: 'sync-cursor', value: page.cursor })
    })
    if (!page.hasMore) break
  }
  return { applied, conflicts }
}

// ───────── ارسال ─────────

interface OpResult {
  opId: string
  status: 'ok' | 'duplicate' | 'conflict' | 'invalid'
  version?: number
  server?: ServerRecord | null
  error?: string
}

export async function push(db: AppDB, o: SyncOptions): Promise<{ sent: number; conflicts: number; invalid: number }> {
  let sent = 0
  let conflicts = 0
  let invalid = 0
  for (let guard = 0; guard < 100; guard++) {
    const batch: { m: OutboxEntry; op: Record<string, unknown> }[] = []
    await db.transaction('rw', SYNC_TABLES(db), async () => {
      const markers = await db.outbox.where('conflict').equals(0).filter((m) => !m.error).limit(200).toArray()
      for (const m of markers) {
        const local = await readLocal(db, m.collection, m.id)
        const baseVersion = (await db.versions.get(m.key))?.version ?? 0
        if (local === undefined && baseVersion === 0) {
          await db.outbox.delete(m.key) // ساخته و حذف شده، پیش از رسیدن به سرور
          continue
        }
        batch.push({
          m,
          op: local === undefined
            ? { opId: m.opId, collection: m.collection, id: m.id, baseVersion, deleted: true }
            : { opId: m.opId, collection: m.collection, id: m.id, baseVersion, data: local },
        })
      }
    })
    if (batch.length === 0) break

    const { results } = await api<{ results: OpResult[] }>(o, '/changes', { method: 'POST', body: JSON.stringify({ ops: batch.map((b) => b.op) }) })
    const byOp = new Map(results.map((r) => [r.opId, r]))

    await db.transaction('rw', SYNC_TABLES(db), async () => {
      for (const { m } of batch) {
        const r = byOp.get(m.opId)
        if (!r) continue
        const current = await db.outbox.get(m.key)
        const unchanged = current?.seq === m.seq
        if (r.status === 'ok' || r.status === 'duplicate') {
          sent++
          await db.versions.put({ key: m.key, version: r.version! })
          if (unchanged) await db.outbox.delete(m.key)
        } else if (r.status === 'conflict') {
          const server = r.server ?? null
          const local = (await readLocal(db, m.collection, m.id)) ?? null
          const serverData = server && !server.deleted ? server.data : null
          if (sameData(m.collection, local, serverData)) {
            await db.versions.put({ key: m.key, version: server?.version ?? 0 })
            if (unchanged) await db.outbox.delete(m.key)
          } else {
            conflicts++
            await db.conflicts.put({ key: m.key, collection: m.collection, id: m.id, server, createdAt: new Date().toISOString() })
            await db.outbox.update(m.key, { conflict: 1 })
          }
        } else {
          invalid++
          await db.outbox.update(m.key, { error: r.error ?? 'دادهٔ نامعتبر' })
        }
      }
    })
    if (batch.length < 200) break
  }
  return { sent, conflicts, invalid }
}

export interface SyncSummary {
  pulled: number
  pushed: number
  conflicts: number
  invalid: number
  at: string
}

/** یک دور کامل همگام‌سازی */
export async function syncOnce(db: AppDB, o: SyncOptions): Promise<SyncSummary> {
  const a = await pull(db, o)
  const b = await push(db, o)
  const at = new Date().toISOString()
  await db.kv.put({ key: 'last-sync', value: at })
  return { pulled: a.applied, pushed: b.sent, conflicts: a.conflicts + b.conflicts, invalid: b.invalid, at }
}

// ───────── حل تعارض ─────────

/** نسخهٔ این دستگاه نگه داشته و روی سرور نوشته شود */
export async function resolveKeepLocal(db: AppDB, key: string): Promise<void> {
  await db.transaction('rw', SYNC_TABLES(db), async () => {
    const c = await db.conflicts.get(key)
    if (!c) return
    await db.versions.put({ key, version: c.server?.version ?? 0 })
    await db.outbox.update(key, { conflict: 0, opId: uuid(), error: undefined })
    await db.conflicts.delete(key)
  })
}

/** نسخهٔ سرور (دستگاه دیگر) جایگزین نسخهٔ این دستگاه شود */
export async function resolveKeepServer(db: AppDB, key: string): Promise<void> {
  await db.transaction('rw', SYNC_TABLES(db), async () => {
    const c = await db.conflicts.get(key)
    if (!c) return
    await writeLocal(db, c.collection, c.id, c.server && !c.server.deleted ? c.server.data : null)
    if (c.server) await db.versions.put({ key, version: c.server.version })
    await db.outbox.delete(key)
    await db.conflicts.delete(key)
  })
}

/** فقط برای تراکنش‌ها: نسخهٔ این دستگاه به‌عنوان تراکنش جدید حفظ و نسخهٔ سرور هم پذیرفته شود */
export async function resolveKeepBoth(db: AppDB, key: string): Promise<void> {
  await db.transaction('rw', SYNC_TABLES(db), async () => {
    const c = await db.conflicts.get(key)
    if (!c || c.collection !== 'transactions') return
    const local = (await db.transactions.get(c.id)) as Record<string, unknown> | undefined
    if (local) {
      const copy = { ...local, id: uuid(), updatedAt: new Date().toISOString() }
      await db.transactions.add(copy as never)
      await markDirty(db, 'transactions', copy.id as string)
    }
    await writeLocal(db, c.collection, c.id, c.server && !c.server.deleted ? c.server.data : null)
    if (c.server) await db.versions.put({ key, version: c.server.version })
    await db.outbox.delete(key)
    await db.conflicts.delete(key)
  })
}

export type { ConflictEntry }

/**
 * آماده‌سازی برای اتصال به یک سرور (تازه یا همان قبلی):
 * دانسته‌های قبلی از سرور پاک و همهٔ رکوردها «همگام‌نشده» علامت می‌خورند.
 * رکوردهایی که روی سرور عیناً وجود دارند بی‌صدا یکی می‌شوند و فقط تفاوت‌های واقعی تعارض می‌شوند.
 */
export async function resetSyncState(db: AppDB): Promise<void> {
  await db.transaction('rw', SYNC_TABLES(db), async () => {
    await db.versions.clear()
    await db.conflicts.clear()
    await db.kv.delete('sync-cursor')
    await db.kv.delete('last-sync')
    for (const c of ['transactions', 'categories', 'debts'] as const) {
      const ids = (await db.table(c).toCollection().primaryKeys()) as string[]
      for (const id of ids) await markDirty(db, c, id)
    }
    if (await db.kv.get('settings')) await markDirty(db, 'settings', 'settings')
    await db.outbox.toCollection().modify({ conflict: 0, error: undefined })
  })
}
