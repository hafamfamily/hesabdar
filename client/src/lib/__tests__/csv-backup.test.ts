import 'fake-indexeddb/auto'
import { describe, expect, it } from 'vitest'
import { AppDB } from '../../data/db'
import * as repo from '../../data/repo'
import { parseBackup } from '../backup'
import { csvCell, transactionsCsv } from '../csv'

describe('خروجی CSV', () => {
  it('BOM، ستون‌ها، تاریخ شمسی و مبلغ عددی', () => {
    const csv = transactionsCsv(
      [{ id: 'a', type: 'expense', amount: 1250000, date: '2026-10-14', categoryId: 'c1', note: 'نان، "تازه"', createdAt: '2026-10-14T10:00:00Z', updatedAt: '' }],
      [{ id: 'c1', type: 'expense', name: 'خوراک', icon: 'x', color: '#000000', order: 1 }],
    )
    expect(csv.startsWith('﻿')).toBe(true)
    const lines = csv.slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('تاریخ (شمسی),تاریخ (میلادی),نوع,دسته‌بندی,مبلغ (تومان),توضیحات')
    expect(lines[1]).toBe('1405/07/22,2026-10-14,هزینه,خوراک,1250000,"نان، ""تازه"""')
  })
  it('جلوگیری از اجرای فرمول در Excel', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(csvCell('+98')).toBe("'+98")
    expect(csvCell(-5)).toBe('-5')
  })
})

describe('پشتیبان و بازیابی', () => {
  it('پشتیبان ← بازیابی روی دستگاه دیگر بدون رکورد تکراری', async () => {
    const a = new AppDB('bk-a')
    await repo.ensureSeeded(a)
    await repo.patchSettings(a, { openingBalance: 7_000_000 })
    const t = await repo.addTransaction(a, { type: 'expense', amount: 5000, date: '2026-10-14', categoryId: 'exp-food', note: 'x' })
    await repo.addDebt(a, {
      direction: 'lent', kind: 'personal', counterparty: 'علی', startDate: '2026-10-01', note: '',
      schedule: [{ amount: 1000, paid: false }], reminder: { enabled: false, daysBefore: 0 },
    })
    const file = JSON.stringify(await repo.exportBackup(a, '0.5.0'))

    const b = new AppDB('bk-b')
    await repo.ensureSeeded(b)
    await repo.addTransaction(b, { type: 'income', amount: 9, date: '2026-10-14', categoryId: 'inc-salary', note: 'باید حذف شود' })
    const check = parseBackup(file)
    expect(check.ok).toBe(true)
    if (!check.ok) return
    await repo.restoreBackup(b, check.backup)
    await repo.restoreBackup(b, check.backup) // بازیابی دوباره هم تکرار نمی‌سازد
    expect(await b.transactions.count()).toBe(1)
    expect((await b.transactions.get(t.id))?.note).toBe('x')
    expect(await b.debts.count()).toBe(1)
    expect((await repo.getSettings(b)).openingBalance).toBe(7_000_000)
    // رکورد حذف‌شده هم برای همگام‌سازی علامت خورده است
    expect((await b.outbox.toArray()).length).toBeGreaterThan(20)
  })
  it('فایل نامعتبر یا دستکاری‌شده رد می‌شود', () => {
    expect(parseBackup('not json').ok).toBe(false)
    expect(parseBackup('{"app":"other"}').ok).toBe(false)
    const good: { [k: string]: unknown; data: { transactions: unknown[]; [k: string]: unknown } } = { app: 'dakhl-o-kharj', format: 1, exportedAt: '', appVersion: '', data: { transactions: [], categories: [{ id: 'c', type: 'expense', name: 'x' }], debts: [], settings: { openingBalance: 0 } } }
    expect(parseBackup(JSON.stringify(good)).ok).toBe(true)
    const bad = structuredClone(good)
    bad.data.transactions = [{ id: 't', type: 'expense', amount: -1, date: '2026-01-01', categoryId: 'c', note: '' }]
    const r = parseBackup(JSON.stringify(bad))
    expect(r.ok).toBe(false)
    expect(!r.ok && r.error).toContain('تراکنش')
    expect(parseBackup(JSON.stringify({ ...good, format: 9 })).ok).toBe(false)
  })
})
