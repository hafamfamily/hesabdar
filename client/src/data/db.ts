import Dexie, { type Table } from 'dexie'
import { uuid } from '../lib/id'
import type { Category, Debt, Transaction } from './types'

export interface KV {
  key: string
  value: unknown
}

export interface StoredFile {
  key: string
  name: string
  /** ArrayBuffer به‌جای Blob، چون نگهداری Blob در IndexedDB نسخه‌های قدیمی Safari مشکل داشت */
  data: ArrayBuffer
}

export type SyncCollection = 'transactions' | 'categories' | 'debts' | 'settings'

/** رکوردی که سرور برمی‌گرداند */
export interface ServerRecord {
  collection: SyncCollection
  id: string
  version: number
  rev: number
  deleted: boolean
  data: unknown
  updatedAt: string
}

/** علامت «همگام‌نشده» برای هر رکورد (یک علامت برای هر رکورد، نه برای هر تغییر) */
export interface OutboxEntry {
  key: string // collection:id
  collection: SyncCollection
  id: string
  /** شناسهٔ عملیات؛ با هر تغییر محلی تازه می‌شود. تکرار ارسال همین شناسه روی سرور اثری ندارد */
  opId: string
  /** شمارندهٔ تغییرات محلی این رکورد (برای تشخیص تغییر هم‌زمان با ارسال) */
  seq: number
  /** 1 = در تعارض و منتظر تصمیم کاربر (عدد برای ایندکس IndexedDB) */
  conflict: 0 | 1
  error?: string
  changedAt: string
}

/** آخرین نسخهٔ سروری که این دستگاه از هر رکورد می‌شناسد */
export interface VersionEntry {
  key: string
  version: number
}

export interface ConflictEntry {
  key: string
  collection: SyncCollection
  id: string
  /** نسخهٔ سرور (null یعنی روی سرور وجود ندارد) */
  server: ServerRecord | null
  createdAt: string
}

/**
 * پایگاه دادهٔ محلی روی دستگاه (IndexedDB).
 * تغییر ساختار فقط با افزودن نسخهٔ جدید (this.version(n)) انجام شود تا دادهٔ موجود از بین نرود.
 */
export class AppDB extends Dexie {
  transactions!: Table<Transaction, string>
  categories!: Table<Category, string>
  debts!: Table<Debt, string>
  kv!: Table<KV, string>
  files!: Table<StoredFile, string>
  outbox!: Table<OutboxEntry, string>
  versions!: Table<VersionEntry, string>
  conflicts!: Table<ConflictEntry, string>

  constructor(name = 'dakhl-o-kharj') {
    super(name)
    this.version(1).stores({
      transactions: 'id, date, type, categoryId, updatedAt',
      categories: 'id, type',
      debts: 'id, direction, updatedAt',
      kv: 'key',
      files: 'key',
    })
    // نسخهٔ ۲: همگام‌سازی. همهٔ داده‌های موجود «همگام‌نشده» علامت می‌خورند تا در اولین همگام‌سازی به سرور برسند.
    this.version(2)
      .stores({ outbox: 'key, conflict', versions: 'key', conflicts: 'key' })
      .upgrade(async (tx) => {
        const now = new Date().toISOString()
        const mark = (collection: SyncCollection, id: string) =>
          tx.table('outbox').put({ key: `${collection}:${id}`, collection, id, opId: uuid(), seq: 1, conflict: 0, changedAt: now })
        for (const c of ['transactions', 'categories', 'debts'] as const) {
          const ids = (await tx.table(c).toCollection().primaryKeys()) as string[]
          for (const id of ids) await mark(c, id)
        }
        if (await tx.table('kv').get('settings')) await mark('settings', 'settings')
      })
  }
}
