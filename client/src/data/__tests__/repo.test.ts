import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { equalSchedule } from '../../lib/debts'
import { AppDB } from '../db'
import * as repo from '../repo'
import type { DebtInput } from '../types'

let db: AppDB
let n = 0
beforeEach(async () => {
  db = new AppDB(`test-${++n}`)
  await repo.ensureSeeded(db)
})
afterEach(async () => {
  db.close()
  await db.delete()
})

const tx = { type: 'expense' as const, amount: 150_000, date: '2026-10-14', categoryId: 'exp-food', note: ' نان ' }
const loan = (over: Partial<DebtInput> = {}): DebtInput => ({
  direction: 'borrowed', kind: 'loan', counterparty: 'بانک', startDate: '2026-10-01', note: '',
  disbursement: { amount: 3_000_000, date: '2026-10-01' }, schedule: equalSchedule(3, 1_000_000, '2026-11-01'),
  reminder: { enabled: true, daysBefore: 3 }, ...over,
})

describe('پایگاه دادهٔ محلی', () => {
  it('راه‌اندازی اولیه با دسته‌های پیش‌فرض و فقط یک بار', async () => {
    const count = await db.categories.count()
    expect(count).toBeGreaterThan(10)
    await repo.saveCategory(db, { type: 'expense', name: 'حیوان خانگی', icon: 'pet', color: '#000000' })
    await repo.ensureSeeded(db)
    expect(await db.categories.count()).toBe(count + 1)
    expect((await repo.getSettings(db)).openingBalance).toBe(0)
  })

  it('داده پس از بستن و باز کردن دوباره باقی می‌ماند (شبیه بارگذاری مجدد صفحه)', async () => {
    const t = await repo.addTransaction(db, tx)
    await repo.patchSettings(db, { openingBalance: 5_000_000 })
    db.close()
    const again = new AppDB(db.name)
    expect((await again.transactions.get(t.id))?.note).toBe('نان')
    expect((await repo.getSettings(again)).openingBalance).toBe(5_000_000)
    again.close()
    await db.open()
  })

  it('اعتبارسنجی ورودی تراکنش', async () => {
    await expect(repo.addTransaction(db, { ...tx, amount: 0 })).rejects.toThrow()
    await expect(repo.addTransaction(db, { ...tx, amount: 1.5 })).rejects.toThrow()
    await expect(repo.addTransaction(db, { ...tx, date: '2026-02-30' })).rejects.toThrow()
    await expect(repo.addTransaction(db, { ...tx, categoryId: 'inc-salary' })).rejects.toThrow('دسته')
    expect(await db.transactions.count()).toBe(0)
  })

  it('حذف دسته با انتقال تراکنش‌ها؛ در صورت خطا هیچ تغییری ثبت نمی‌شود', async () => {
    const t = await repo.addTransaction(db, tx)
    await expect(repo.deleteCategory(db, 'exp-food')).rejects.toThrow()
    await expect(repo.deleteCategory(db, 'exp-food', 'inc-salary')).rejects.toThrow()
    expect(await db.categories.get('exp-food')).toBeDefined()
    await repo.deleteCategory(db, 'exp-food', 'exp-other')
    expect(await db.categories.get('exp-food')).toBeUndefined()
    expect((await db.transactions.get(t.id))?.categoryId).toBe('exp-other')
  })

  it('پرداخت بخشی قسط، ثبت در گزارش و لغو آن', async () => {
    const d = await repo.addDebt(db, loan())
    const first = d.installments[0]
    await repo.markInstallmentPaid(db, d.id, first.id, { date: '2026-11-01', amount: 400_000, recordAsTx: true, categoryId: 'exp-debt' })
    let saved = (await db.debts.get(d.id))!
    expect(saved.installments.map((i) => [i.amount, !!i.paidDate])).toEqual([[400_000, true], [600_000, false], [1_000_000, false], [1_000_000, false]])
    const txId = saved.installments[0].transactionId!
    expect((await db.transactions.get(txId))?.amount).toBe(400_000)
    await expect(repo.markInstallmentPaid(db, d.id, saved.installments[0].id, { date: '2026-11-01', recordAsTx: false })).rejects.toThrow()
    await repo.markInstallmentUnpaid(db, d.id, saved.installments[0].id)
    saved = (await db.debts.get(d.id))!
    expect(saved.installments[0].paidDate).toBeUndefined()
    expect(await db.transactions.get(txId)).toBeUndefined()
  })

  it('خطا در ثبت پرداخت، نیمه‌کاره نمی‌ماند', async () => {
    const d = await repo.addDebt(db, loan())
    await expect(
      repo.markInstallmentPaid(db, d.id, d.installments[0].id, { date: '2026-11-01', recordAsTx: true, categoryId: 'inc-salary' }),
    ).rejects.toThrow()
    expect(await db.transactions.count()).toBe(0)
    expect((await db.debts.get(d.id))!.installments[0].paidDate).toBeUndefined()
  })

  it('ویرایش جدول اقساط: حذف قسط پرداخت‌شده تراکنش آن را هم حذف می‌کند', async () => {
    const d = await repo.addDebt(db, loan())
    await repo.markInstallmentPaid(db, d.id, d.installments[0].id, { date: '2026-11-01', recordAsTx: true, categoryId: 'exp-debt' })
    const saved = (await db.debts.get(d.id))!
    const rows = saved.installments.slice(1).map((i) => ({ id: i.id, dueDate: i.dueDate, amount: i.amount + 500, paid: false }))
    await repo.updateDebt(db, d.id, { schedule: rows })
    expect(await db.transactions.count()).toBe(0)
    expect((await db.debts.get(d.id))!.installments.map((i) => i.amount)).toEqual([1_000_500, 1_000_500])
    await expect(repo.updateDebt(db, d.id, { schedule: [] })).rejects.toThrow()
  })

  it('حذف تراکنش پرداخت قسط، پیوند را برمی‌دارد', async () => {
    const d = await repo.addDebt(db, loan())
    await repo.markInstallmentPaid(db, d.id, d.installments[0].id, { date: '2026-11-01', recordAsTx: true, categoryId: 'exp-debt' })
    const txId = (await db.debts.get(d.id))!.installments[0].transactionId!
    await repo.deleteTransaction(db, txId)
    const ins = (await db.debts.get(d.id))!.installments[0]
    expect(ins.paidDate).toBe('2026-11-01')
    expect(ins.transactionId).toBeUndefined()
  })

  it('دادهٔ نمونه فقط روی برنامهٔ خالی؛ حذف همه به حالت اول برمی‌گردد', async () => {
    await repo.loadSampleData(db)
    expect(await db.transactions.count()).toBeGreaterThan(10)
    await expect(repo.loadSampleData(db)).rejects.toThrow()
    await repo.wipeAll(db)
    expect(await db.transactions.count()).toBe(0)
    expect(await db.debts.count()).toBe(0)
    expect(await db.categories.count()).toBeGreaterThan(10)
  })

  it('فونت کاربر ذخیره و بازیابی می‌شود', async () => {
    await repo.saveCustomFont(db, 'BNazanin.ttf', new Uint8Array([1, 2, 3]).buffer)
    const f = await repo.getCustomFont(db)
    expect(f?.name).toBe('BNazanin.ttf')
    expect(new Uint8Array(f!.data)).toEqual(new Uint8Array([1, 2, 3]))
  })
})
