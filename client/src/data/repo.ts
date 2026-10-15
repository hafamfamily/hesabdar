import { installmentTransaction, rowsToInstallments, validateDebtInput, validateSchedule } from '../lib/debts'
import { uuid } from '../lib/id'
import { isValidIso, type IsoDate } from '../lib/jalali'
import { MAX_AMOUNT } from '../lib/money'
import type { AppDB } from './db'
import { markDirty } from './sync'
import type { BackupFile } from '../lib/backup'
import { DEFAULT_CATEGORIES } from './defaults'
import { buildMockDebts, buildMockTransactions } from './mock'
import type { Category, Debt, DebtInput, FontSettings, ReminderSettings, ScheduleRow, Transaction, TxInput } from './types'

/**
 * لایهٔ ذخیره‌سازی: همهٔ تغییرات داده از اینجا عبور می‌کنند.
 * هر عملیات چندمرحله‌ای داخل یک تراکنش IndexedDB انجام می‌شود (یا کامل، یا هیچ).
 * ورودی‌ها پیش از نوشتن اعتبارسنجی می‌شوند.
 */

export interface StoredSettings {
  openingBalance: number
  reminders: ReminderSettings
  fonts: FontSettings
}

export const DEFAULT_SETTINGS: StoredSettings = {
  openingBalance: 0,
  reminders: { enabled: true, systemNotifications: false },
  fonts: { body: 'estedad', title: 'lalezar' },
}

const now = () => new Date().toISOString()

export async function ensureSeeded(db: AppDB): Promise<void> {
  await db.transaction('rw', db.kv, db.categories, db.outbox, async () => {
    if (await db.kv.get('seeded')) return
    await db.categories.bulkPut(DEFAULT_CATEGORIES)
    await db.kv.put({ key: 'settings', value: DEFAULT_SETTINGS })
    await db.kv.put({ key: 'seeded', value: now() })
    for (const c of DEFAULT_CATEGORIES) await markDirty(db, 'categories', c.id)
    await markDirty(db, 'settings', 'settings')
  })
}

export async function getSettings(db: AppDB): Promise<StoredSettings> {
  const row = await db.kv.get('settings')
  const v = (row?.value ?? {}) as Partial<StoredSettings>
  return { ...DEFAULT_SETTINGS, ...v, reminders: { ...DEFAULT_SETTINGS.reminders, ...v.reminders }, fonts: { ...DEFAULT_SETTINGS.fonts, ...v.fonts } }
}

export async function patchSettings(db: AppDB, patch: Partial<StoredSettings>): Promise<void> {
  await db.transaction('rw', db.kv, db.outbox, async () => {
    const cur = await getSettings(db)
    const next = { ...cur, ...patch }
    await db.kv.put({ key: 'settings', value: next })
    // تغییر فونت مخصوص همین دستگاه است و نیازی به همگام‌سازی ندارد
    if (Object.keys(patch).some((k) => k !== 'fonts')) await markDirty(db, 'settings', 'settings')
  })
}

// ───────────── تراکنش‌ها ─────────────

export async function validateTxInput(db: AppDB, t: TxInput): Promise<void> {
  if (t.type !== 'income' && t.type !== 'expense') throw new Error('نوع تراکنش نامعتبر است')
  if (!Number.isSafeInteger(t.amount) || t.amount <= 0 || t.amount > MAX_AMOUNT) throw new Error('مبلغ باید عدد صحیح بیشتر از صفر باشد')
  if (!isValidIso(t.date)) throw new Error('تاریخ نامعتبر است')
  const cat = await db.categories.get(t.categoryId)
  if (!cat || cat.type !== t.type) throw new Error('دسته‌بندی نامعتبر است')
  if (t.note.length > 200) throw new Error('توضیحات بیش از حد طولانی است')
}

export async function addTransaction(db: AppDB, input: TxInput): Promise<Transaction> {
  const clean = { ...input, note: input.note.trim() }
  return db.transaction('rw', db.transactions, db.categories, db.outbox, async () => {
    await validateTxInput(db, clean)
    const ts = now()
    const tx: Transaction = { ...clean, id: uuid(), createdAt: ts, updatedAt: ts }
    await db.transactions.add(tx)
    await markDirty(db, 'transactions', tx.id)
    return tx
  })
}

export async function updateTransaction(db: AppDB, id: string, input: TxInput): Promise<void> {
  const clean = { ...input, note: input.note.trim() }
  await db.transaction('rw', db.transactions, db.categories, db.outbox, async () => {
    const prev = await db.transactions.get(id)
    if (!prev) throw new Error('تراکنش پیدا نشد')
    await validateTxInput(db, clean)
    await db.transactions.put({ ...prev, ...clean, updatedAt: now() })
    await markDirty(db, 'transactions', id)
  })
}

export async function deleteTransaction(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.transactions, db.debts, db.outbox, async () => {
    await db.transactions.delete(id)
    await markDirty(db, 'transactions', id)
    // اگر این تراکنش مربوط به پرداخت قسطی بوده، پیوند آن هم برداشته شود تا پرداخت از طریق جریان بدهی حساب شود
    const linked = await db.debts.filter((d) => d.installments.some((i) => i.transactionId === id)).toArray()
    for (const d of linked) {
      await db.debts.put({ ...d, installments: d.installments.map((i) => (i.transactionId === id ? { ...i, transactionId: undefined } : i)), updatedAt: now() })
      await markDirty(db, 'debts', d.id)
    }
  })
}

// ───────────── دسته‌بندی‌ها ─────────────

export async function saveCategory(db: AppDB, cat: Omit<Category, 'id' | 'order'> & { id?: string }): Promise<void> {
  const name = cat.name.trim()
  if (!name || name.length > 24) throw new Error('نام دسته نامعتبر است')
  await db.transaction('rw', db.categories, db.outbox, async () => {
    const all = await db.categories.toArray()
    if (all.some((c) => c.type === cat.type && c.name === name && c.id !== cat.id)) throw new Error('دسته‌ای با این نام وجود دارد')
    const prev = cat.id ? all.find((c) => c.id === cat.id) : undefined
    const order = prev?.order ?? Math.max(0, ...all.filter((c) => c.type === cat.type && c.order < 99).map((c) => c.order)) + 1
    const id = cat.id ?? uuid()
    await db.categories.put({ ...prev, ...cat, name, id, order })
    await markDirty(db, 'categories', id)
  })
}

export async function deleteCategory(db: AppDB, id: string, moveTo?: string): Promise<void> {
  await db.transaction('rw', db.categories, db.transactions, db.outbox, async () => {
    const cat = await db.categories.get(id)
    if (!cat) return
    const used = await db.transactions.where('categoryId').equals(id).toArray()
    if (used.length) {
      const target = moveTo ? await db.categories.get(moveTo) : undefined
      if (!target || target.id === id || target.type !== cat.type) throw new Error('دستهٔ جایگزین نامعتبر است')
      const ts = now()
      await db.transactions.bulkPut(used.map((t) => ({ ...t, categoryId: target.id, updatedAt: ts })))
      for (const t of used) await markDirty(db, 'transactions', t.id)
    }
    const left = await db.categories.where('type').equals(cat.type).count()
    if (left <= 1) throw new Error('حداقل یک دسته باید باقی بماند')
    await db.categories.delete(id)
    await markDirty(db, 'categories', id)
  })
}

// ───────────── بدهی‌ها و اقساط ─────────────

export async function addDebt(db: AppDB, input: DebtInput): Promise<Debt> {
  const err = validateDebtInput(input)
  if (err) throw new Error(err)
  const ts = now()
  const debt: Debt = {
    id: uuid(),
    direction: input.direction,
    kind: input.kind,
    counterparty: input.counterparty.trim(),
    principal: input.principal,
    startDate: input.startDate,
    note: input.note.trim(),
    disbursement: input.disbursement,
    installments: rowsToInstallments(input.schedule),
    reminder: input.reminder,
    createdAt: ts,
    updatedAt: ts,
  }
  await db.transaction('rw', db.debts, db.outbox, async () => {
    await db.debts.add(debt)
    await markDirty(db, 'debts', debt.id)
  })
  return debt
}

export type DebtPatch = Partial<Pick<Debt, 'counterparty' | 'kind' | 'principal' | 'note' | 'reminder' | 'direction' | 'disbursement'>> & {
  schedule?: ScheduleRow[]
}

export async function updateDebt(db: AppDB, id: string, { schedule, ...patch }: DebtPatch): Promise<void> {
  if (patch.counterparty !== undefined && !patch.counterparty.trim()) throw new Error('نام طرف حساب را وارد کنید')
  await db.transaction('rw', db.debts, db.transactions, db.outbox, async () => {
    const prev = await db.debts.get(id)
    if (!prev) throw new Error('مورد پیدا نشد')
    let installments = prev.installments
    if (schedule) {
      const err = validateSchedule(schedule)
      if (err) throw new Error(err)
      installments = rowsToInstallments(schedule)
      // تراکنش اقساطی که از جدول حذف شده‌اند هم حذف شوند
      const kept = new Set(installments.map((i) => i.transactionId).filter(Boolean))
      const orphan = prev.installments.map((i) => i.transactionId).filter((t): t is string => !!t && !kept.has(t))
      if (orphan.length) await db.transactions.bulkDelete(orphan)
      for (const t of orphan) await markDirty(db, 'transactions', t)
    }
    await db.debts.put({ ...prev, ...patch, installments, updatedAt: now() })
    await markDirty(db, 'debts', id)
  })
}

export async function deleteDebt(db: AppDB, id: string): Promise<void> {
  await db.transaction('rw', db.debts, db.outbox, async () => {
    await db.debts.delete(id)
    await markDirty(db, 'debts', id)
  })
}

export interface PayOptions {
  date: IsoDate
  amount?: number
  recordAsTx: boolean
  categoryId?: string
}

export async function markInstallmentPaid(db: AppDB, debtId: string, installmentId: string, opts: PayOptions): Promise<void> {
  if (!isValidIso(opts.date)) throw new Error('تاریخ نامعتبر است')
  await db.transaction('rw', db.debts, db.transactions, db.categories, db.outbox, async () => {
    const debt = await db.debts.get(debtId)
    const ins = debt?.installments.find((i) => i.id === installmentId)
    if (!debt || !ins) throw new Error('قسط پیدا نشد')
    if (ins.paidDate) throw new Error('این قسط قبلاً پرداخت شده است')
    const amount = opts.amount ?? ins.amount
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount > ins.amount) throw new Error('مبلغ پرداخت نامعتبر است')
    let transactionId: string | undefined
    if (opts.recordAsTx) {
      const type = debt.direction === 'borrowed' ? 'expense' : 'income'
      const cat = opts.categoryId ? await db.categories.get(opts.categoryId) : undefined
      if (!cat || cat.type !== type) throw new Error('دسته‌بندی نامعتبر است')
      const tx = installmentTransaction(debt, ins, amount, opts.date, cat.id)
      await db.transactions.add(tx)
      await markDirty(db, 'transactions', tx.id)
      transactionId = tx.id
    }
    const rest = ins.amount - amount
    const paid = { ...ins, amount, paidDate: opts.date, paidBefore: undefined, transactionId }
    const list = debt.installments.flatMap((i) =>
      i.id !== installmentId ? [i] : rest > 0 ? [paid, { id: uuid(), index: 0, dueDate: ins.dueDate, amount: rest }] : [paid],
    )
    await db.debts.put({ ...debt, installments: rowsToInstallments(list.map((i) => ({ ...i, paid: !!i.paidDate }))), updatedAt: now() })
    await markDirty(db, 'debts', debtId)
  })
}

export async function markInstallmentUnpaid(db: AppDB, debtId: string, installmentId: string): Promise<void> {
  await db.transaction('rw', db.debts, db.transactions, db.outbox, async () => {
    const debt = await db.debts.get(debtId)
    const ins = debt?.installments.find((i) => i.id === installmentId)
    if (!debt || !ins) throw new Error('قسط پیدا نشد')
    if (ins.transactionId) {
      await db.transactions.delete(ins.transactionId)
      await markDirty(db, 'transactions', ins.transactionId)
    }
    await db.debts.put({
      ...debt,
      installments: debt.installments.map((i) => (i.id === installmentId ? { ...i, paidDate: undefined, paidBefore: undefined, transactionId: undefined } : i)),
      updatedAt: now(),
    })
    await markDirty(db, 'debts', debtId)
  })
}

// ───────────── فونت کاربر ─────────────

export async function saveCustomFont(db: AppDB, name: string, data: ArrayBuffer): Promise<void> {
  await db.files.put({ key: 'custom-font', name, data })
}

export async function getCustomFont(db: AppDB) {
  return db.files.get('custom-font')
}

// ───────────── ابزار ─────────────

export async function isEmpty(db: AppDB): Promise<boolean> {
  return (await db.transactions.count()) === 0 && (await db.debts.count()) === 0
}

/** افزودن دادهٔ نمونه برای آشنایی با برنامه (فقط وقتی داده‌ای وجود ندارد) */
export async function loadSampleData(db: AppDB): Promise<void> {
  await db.transaction('rw', db.transactions, db.debts, db.kv, db.outbox, async () => {
    if (!(await isEmpty(db))) throw new Error('دادهٔ نمونه فقط وقتی برنامه خالی است اضافه می‌شود')
    if (await db.kv.get('server-pairing')) throw new Error('این دستگاه به سرور متصل است؛ دادهٔ نمونه به داده‌های واقعی اضافه نمی‌شود')
    const txs = buildMockTransactions().map((t) => ({ ...t, id: uuid() }))
    const debts = buildMockDebts().map((d) => ({ ...d, id: uuid() }))
    await db.transactions.bulkAdd(txs)
    await db.debts.bulkAdd(debts)
    const cur = await getSettings(db)
    await db.kv.put({ key: 'settings', value: { ...cur, openingBalance: 25_000_000 } })
    await db.kv.put({ key: 'has-sample-data', value: true })
    for (const t of txs) await markDirty(db, 'transactions', t.id)
    for (const d of debts) await markDirty(db, 'debts', d.id)
    await markDirty(db, 'settings', 'settings')
  })
}

/**
 * حذف همهٔ داده‌های «این دستگاه» و بازگشت به حالت اول.
 * عمداً به سرور منتقل نمی‌شود (حذف روی دستگاه‌های دیگر اتفاق نمی‌افتد)؛ اتصال این دستگاه به سرور هم قطع می‌شود.
 */
export async function wipeAll(db: AppDB): Promise<void> {
  await db.transaction('rw', [db.transactions, db.debts, db.categories, db.kv, db.files, db.outbox, db.versions, db.conflicts], async () => {
    await Promise.all([
      db.transactions.clear(), db.debts.clear(), db.categories.clear(), db.kv.clear(), db.files.clear(),
      db.outbox.clear(), db.versions.clear(), db.conflicts.clear(),
    ])
  })
  await ensureSeeded(db)
}

/** درخواست ذخیره‌سازی ماندگار تا مرورگر داده‌ها را در کمبود فضا پاک نکند */
export async function requestPersistence(): Promise<boolean | undefined> {
  try {
    if (!navigator.storage?.persist) return undefined
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return undefined
  }
}

// ───────── پشتیبان و بازیابی ─────────

export async function exportBackup(db: AppDB, appVersion: string): Promise<BackupFile> {
  return db.transaction('r', db.transactions, db.categories, db.debts, db.kv, async () => {
    const { fonts: _fonts, ...settings } = await getSettings(db)
    return {
      app: 'dakhl-o-kharj' as const,
      format: 1 as const,
      exportedAt: now(),
      appVersion,
      data: {
        transactions: await db.transactions.toArray(),
        categories: await db.categories.toArray(),
        debts: await db.debts.toArray(),
        settings,
      },
    }
  })
}

/**
 * جایگزینی کامل داده‌های این دستگاه با فایل پشتیبان (پس از parseBackup).
 * رکوردها با همان شناسه‌ها بازگردانده می‌شوند، پس رکورد تکراری ساخته نمی‌شود.
 * اگر دستگاه به سرور متصل باشد، نتیجه (شامل حذف رکوردهایی که در پشتیبان نیستند) به سرور هم منتقل می‌شود.
 */
export async function restoreBackup(db: AppDB, b: BackupFile): Promise<void> {
  await db.transaction('rw', [db.transactions, db.categories, db.debts, db.kv, db.outbox, db.conflicts], async () => {
    const before = {
      transactions: (await db.transactions.toCollection().primaryKeys()) as string[],
      categories: (await db.categories.toCollection().primaryKeys()) as string[],
      debts: (await db.debts.toCollection().primaryKeys()) as string[],
    }
    const cur = await getSettings(db)
    await Promise.all([db.transactions.clear(), db.categories.clear(), db.debts.clear()])
    await db.transactions.bulkPut(b.data.transactions)
    await db.categories.bulkPut(b.data.categories)
    await db.debts.bulkPut(b.data.debts)
    await db.kv.put({ key: 'settings', value: { ...DEFAULT_SETTINGS, ...b.data.settings, fonts: cur.fonts } })
    await db.kv.delete('has-sample-data')
    await db.conflicts.clear()
    await db.outbox.toCollection().modify({ conflict: 0, error: undefined })
    for (const c of ['transactions', 'categories', 'debts'] as const) {
      const ids = new Set([...before[c], ...b.data[c].map((x) => x.id)])
      for (const id of ids) await markDirty(db, c, id)
    }
    await markDirty(db, 'settings', 'settings')
  })
}
