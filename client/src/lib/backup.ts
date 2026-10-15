import type { Category, Debt, Transaction } from '../data/types'
import type { StoredSettings } from '../data/repo'
import { isValidIso } from './jalali'

/**
 * قالب فایل پشتیبان (JSON). نسخهٔ قالب برای سازگاری آینده نگه داشته می‌شود.
 * پشتیبان شامل تراکنش‌ها، دسته‌بندی‌ها، بدهی‌ها/اقساط، تنظیمات و موجودی اولیه است.
 */
export interface BackupFile {
  app: 'dakhl-o-kharj'
  format: 1
  exportedAt: string
  appVersion: string
  data: {
    transactions: Transaction[]
    categories: Category[]
    debts: Debt[]
    settings: Omit<StoredSettings, 'fonts'>
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v)
const isAmount = (v: unknown, zero = false) => typeof v === 'number' && Number.isSafeInteger(v) && (zero ? v >= 0 : v > 0)

export type BackupCheck = { ok: true; backup: BackupFile } | { ok: false; error: string }

/** بررسی کامل فایل پیش از بازیابی؛ هیچ تغییری در داده‌ها ایجاد نمی‌کند */
export function parseBackup(text: string): BackupCheck {
  let raw: unknown
  try {
    raw = JSON.parse(text.replace(/^﻿/, ''))
  } catch {
    return { ok: false, error: 'فایل JSON معتبر نیست' }
  }
  if (!isObj(raw) || raw.app !== 'dakhl-o-kharj') return { ok: false, error: 'این فایل پشتیبان «دخل‌وخرج من» نیست' }
  if (raw.format !== 1) return { ok: false, error: 'نسخهٔ این فایل پشتیبان پشتیبانی نمی‌شود' }
  const d = raw.data
  if (!isObj(d) || !Array.isArray(d.transactions) || !Array.isArray(d.categories) || !Array.isArray(d.debts) || !isObj(d.settings))
    return { ok: false, error: 'ساختار فایل پشتیبان ناقص است' }

  const catIds = new Set<string>()
  for (const [i, c] of d.categories.entries()) {
    if (!isObj(c) || !isId(c.id) || (c.type !== 'income' && c.type !== 'expense') || typeof c.name !== 'string' || !c.name.trim())
      return { ok: false, error: `دسته‌بندی شمارهٔ ${i + 1} نامعتبر است` }
    if (catIds.has(c.id as string)) return { ok: false, error: 'شناسهٔ تکراری در دسته‌بندی‌ها' }
    catIds.add(c.id as string)
  }
  if (catIds.size === 0) return { ok: false, error: 'فایل پشتیبان هیچ دسته‌بندی ندارد' }

  const txIds = new Set<string>()
  for (const [i, t] of d.transactions.entries()) {
    if (!isObj(t) || !isId(t.id) || (t.type !== 'income' && t.type !== 'expense') || !isAmount(t.amount) || typeof t.date !== 'string' || !isValidIso(t.date) || typeof t.categoryId !== 'string' || typeof t.note !== 'string')
      return { ok: false, error: `تراکنش شمارهٔ ${i + 1} نامعتبر است` }
    if (txIds.has(t.id as string)) return { ok: false, error: 'شناسهٔ تکراری در تراکنش‌ها' }
    txIds.add(t.id as string)
  }

  const debtIds = new Set<string>()
  for (const [i, x] of d.debts.entries()) {
    const bad = `بدهی/طلب شمارهٔ ${i + 1} نامعتبر است`
    if (!isObj(x) || !isId(x.id) || (x.direction !== 'borrowed' && x.direction !== 'lent') || typeof x.counterparty !== 'string' || !Array.isArray(x.installments) || x.installments.length === 0)
      return { ok: false, error: bad }
    for (const ins of x.installments) if (!isObj(ins) || !isId(ins.id) || !isAmount(ins.amount)) return { ok: false, error: bad }
    if (debtIds.has(x.id as string)) return { ok: false, error: 'شناسهٔ تکراری در بدهی‌ها' }
    debtIds.add(x.id as string)
  }

  if (!isAmount(d.settings.openingBalance, true)) return { ok: false, error: 'موجودی اولیه در فایل پشتیبان نامعتبر است' }
  return { ok: true, backup: raw as unknown as BackupFile }
}

export function summarizeBackup(b: BackupFile) {
  return { transactions: b.data.transactions.length, debts: b.data.debts.length, categories: b.data.categories.length, exportedAt: b.exportedAt }
}
