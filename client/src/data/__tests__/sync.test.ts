import 'fake-indexeddb/auto'
import { mkdtempSync, rmSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
// سرور واقعی برنامه (همان کدی که روی لپ‌تاپ اجرا می‌شود)
// @ts-expect-error ماژول JavaScript سرور
import { createApp } from '../../../../server/src/app.js'
// @ts-expect-error ماژول JavaScript سرور
import { createDevice, setPassword } from '../../../../server/src/auth.js'
// @ts-expect-error ماژول JavaScript سرور
import { openDatabase } from '../../../../server/src/db.js'
import { AppDB } from '../db'
import * as repo from '../repo'
import { pull, push, resetSyncState, resolveKeepBoth, resolveKeepLocal, resolveKeepServer, syncOnce, type SyncOptions } from '../sync'

let server: Server
let serverDb: { close(): void; prepare(sql: string): { get(...a: unknown[]): unknown } }
let dir: string
let baseUrl = ''
let up = true

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'dk-sync-'))
  serverDb = openDatabase(join(dir, 'data'))
  setPassword(serverDb, 'رمز-امن-تست')
  const config = { dataDir: join(dir, 'data'), clientDir: join(dir, 'none'), port: 0, setupPort: 0, hostname: 'dakhlkharj.local', mdns: false, allowAnyNetwork: false }
  server = createServer(createApp({ db: serverDb, config }))
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()))
  baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`
})
afterAll(() => {
  server.close()
  serverDb.close()
  rmSync(dir, { recursive: true, force: true })
})

// شبیه‌سازی قطع شبکه/خاموش بودن لپ‌تاپ
const fetchImpl: typeof fetch = (input, init) => (up ? fetch(input, init) : Promise.reject(new TypeError('network down')))

let n = 0
async function device(name: string) {
  const db = new AppDB(`sync-${name}-${++n}`)
  await repo.ensureSeeded(db)
  const { token } = createDevice(serverDb, name)
  const o: SyncOptions = { token, baseUrl, fetchImpl }
  return { db, o, sync: () => syncOnce(db, o) }
}

const expense = (amount: number, note = '') => ({ type: 'expense' as const, amount, date: '2026-10-14', categoryId: 'exp-food', note })

describe('همگام‌سازی دو دستگاه از طریق سرور', () => {
  beforeEach(() => {
    up = true
  })

  it('دسته‌های پیش‌فرض یکسان روی دو دستگاه، تعارض نمی‌سازند', async () => {
    const a = await device('A')
    const b = await device('B')
    await a.sync()
    const r = await b.sync()
    expect(r.conflicts).toBe(0)
    expect(await b.db.outbox.count()).toBe(0)
    expect(await b.db.conflicts.count()).toBe(0)
  })

  it('ثبت روی آیفون ← دیده‌شدن روی لپ‌تاپ؛ ویرایش و حذف هم منتقل می‌شوند', async () => {
    const phone = await device('phone')
    const laptop = await device('laptop')
    await phone.sync()
    await laptop.sync()
    const t = await repo.addTransaction(phone.db, expense(250_000, 'نان'))
    expect(await phone.db.outbox.count()).toBe(1)
    await phone.sync()
    expect(await phone.db.outbox.count()).toBe(0)
    await laptop.sync()
    expect((await laptop.db.transactions.get(t.id))?.note).toBe('نان')

    await repo.updateTransaction(laptop.db, t.id, { ...expense(300_000, 'نان و شیر') })
    await laptop.sync()
    await phone.sync()
    expect((await phone.db.transactions.get(t.id))?.amount).toBe(300_000)

    await repo.deleteTransaction(phone.db, t.id)
    await phone.sync()
    await laptop.sync()
    expect(await laptop.db.transactions.get(t.id)).toBeUndefined()
  })

  it('لپ‌تاپ خاموش: ثبت آفلاین حفظ می‌شود و پس از اتصال ارسال می‌شود', async () => {
    const phone = await device('phone2')
    const laptop = await device('laptop2')
    await phone.sync()
    up = false
    const t1 = await repo.addTransaction(phone.db, expense(10_000, 'آفلاین ۱'))
    const t2 = await repo.addTransaction(phone.db, expense(20_000, 'آفلاین ۲'))
    await expect(phone.sync()).rejects.toThrow('سرور در دسترس نیست')
    expect(await phone.db.transactions.count()).toBe(2)
    expect(await phone.db.outbox.count()).toBe(2)
    up = true
    await phone.sync()
    expect(await phone.db.outbox.count()).toBe(0)
    await laptop.sync()
    expect((await laptop.db.transactions.bulkGet([t1.id, t2.id])).every(Boolean)).toBe(true)
  })

  it('اگر پاسخ سرور گم شود و دوباره ارسال شود، رکورد تکراری ساخته نمی‌شود', async () => {
    const phone = await device('phone3')
    await phone.sync()
    const t = await repo.addTransaction(phone.db, expense(77_000, 'یک بار'))
    // ارسال انجام می‌شود ولی پاسخ به دستگاه نمی‌رسد
    let calls = 0
    const lossy: typeof fetch = async (input, init) => {
      const res = await fetch(input, init)
      if (init?.method === 'POST' && calls++ === 0) throw new TypeError('connection reset')
      return res
    }
    await expect(push(phone.db, { ...phone.o, fetchImpl: lossy })).rejects.toThrow()
    expect(await phone.db.outbox.count()).toBe(1)
    await push(phone.db, phone.o)
    expect(await phone.db.outbox.count()).toBe(0)
    const rows = serverDb.prepare("SELECT COUNT(*) AS n FROM records WHERE collection = 'transactions' AND id = ?").get(t.id) as { n: number }
    expect(rows.n).toBe(1)
    const ops = serverDb.prepare("SELECT version FROM records WHERE id = ?").get(t.id) as { version: number }
    expect(ops.version).toBe(1)
  })

  it('تغییر هم‌زمان روی دو دستگاه ← تعارض؛ هیچ نسخه‌ای بی‌صدا حذف نمی‌شود', async () => {
    const phone = await device('phone4')
    const laptop = await device('laptop4')
    const t = await repo.addTransaction(phone.db, expense(100_000, 'اصلی'))
    await phone.sync()
    await laptop.sync()
    await repo.updateTransaction(phone.db, t.id, expense(111_000, 'نسخهٔ آیفون'))
    await repo.updateTransaction(laptop.db, t.id, expense(222_000, 'نسخهٔ لپ‌تاپ'))
    await phone.sync()
    const r = await laptop.sync()
    expect(r.conflicts).toBe(1)
    // لپ‌تاپ نسخهٔ خودش را نگه داشته و نسخهٔ آیفون در جدول تعارض است
    expect((await laptop.db.transactions.get(t.id))?.note).toBe('نسخهٔ لپ‌تاپ')
    const c = (await laptop.db.conflicts.toArray())[0]
    expect((c.server?.data as { note: string }).note).toBe('نسخهٔ آیفون')
    // تا تصمیم کاربر، چیزی به سرور ارسال نمی‌شود
    await laptop.sync()
    await phone.sync()
    expect((await phone.db.transactions.get(t.id))?.note).toBe('نسخهٔ آیفون')
    // انتخاب «نسخهٔ این دستگاه» روی لپ‌تاپ
    await resolveKeepLocal(laptop.db, c.key)
    await laptop.sync()
    await phone.sync()
    expect((await phone.db.transactions.get(t.id))?.note).toBe('نسخهٔ لپ‌تاپ')
    expect(await laptop.db.conflicts.count()).toBe(0)
  })

  it('حل تعارض با «نسخهٔ سرور» و «نگه‌داشتن هر دو»', async () => {
    const a = await device('A5')
    const b = await device('B5')
    const t = await repo.addTransaction(a.db, expense(1000, 'x'))
    await a.sync()
    await b.sync()
    await repo.updateTransaction(a.db, t.id, expense(2000, 'A'))
    await repo.updateTransaction(b.db, t.id, expense(3000, 'B'))
    await a.sync()
    await b.sync()
    const key = (await b.db.conflicts.toArray())[0].key
    await resolveKeepServer(b.db, key)
    expect((await b.db.transactions.get(t.id))?.note).toBe('A')

    await repo.updateTransaction(a.db, t.id, expense(4000, 'A2'))
    await repo.updateTransaction(b.db, t.id, expense(5000, 'B2'))
    await a.sync()
    await b.sync()
    await resolveKeepBoth(b.db, (await b.db.conflicts.toArray())[0].key)
    await b.sync()
    await a.sync()
    const notes = (await a.db.transactions.toArray()).map((x) => x.note)
    expect(notes).toEqual(expect.arrayContaining(['A2', 'B2']))
    expect(notes.filter((x) => x === 'A2' || x === 'B2')).toHaveLength(2)
  })

  it('حذف روی یک دستگاه و ویرایش روی دیگری ← تعارض', async () => {
    const a = await device('A6')
    const b = await device('B6')
    const t = await repo.addTransaction(a.db, expense(1000, 'x'))
    await a.sync()
    await b.sync()
    await repo.deleteTransaction(a.db, t.id)
    await repo.updateTransaction(b.db, t.id, expense(9000, 'ویرایش'))
    await a.sync()
    const r = await b.sync()
    expect(r.conflicts).toBe(1)
    const c = (await b.db.conflicts.toArray())[0]
    expect(c.server?.deleted).toBe(true)
    expect((await b.db.transactions.get(t.id))?.note).toBe('ویرایش')
  })

  it('بدهی با پرداخت قسط و تنظیمات منتقل می‌شوند؛ فونت هر دستگاه جداست', async () => {
    const a = await device('A7')
    const b = await device('B7')
    await a.sync()
    await b.sync()
    const d = await repo.addDebt(a.db, {
      direction: 'borrowed', kind: 'loan', counterparty: 'بانک', startDate: '2026-10-01', note: '',
      disbursement: { amount: 3_000_000, date: '2026-10-01' },
      schedule: [{ amount: 1_000_000, dueDate: '2026-11-01', paid: false }, { amount: 2_000_000, dueDate: '2026-12-01', paid: false }],
      reminder: { enabled: true, daysBefore: 3 },
    })
    await repo.markInstallmentPaid(a.db, d.id, d.installments[0].id, { date: '2026-11-01', recordAsTx: true, categoryId: 'exp-debt' })
    await repo.patchSettings(a.db, { openingBalance: 9_000_000 })
    await repo.patchSettings(b.db, { fonts: { body: 'naskh', title: 'same' } })
    await a.sync()
    await b.sync()
    const bd = await b.db.debts.get(d.id)
    expect(bd?.installments[0].paidDate).toBe('2026-11-01')
    expect(await b.db.transactions.get(bd!.installments[0].transactionId!)).toBeDefined()
    const s = await repo.getSettings(b.db)
    expect(s.openingBalance).toBe(9_000_000)
    expect(s.fonts.body).toBe('naskh')
  })

  it('دستگاه جدید همهٔ داده‌ها را از سرور دریافت می‌کند (بیش از یک صفحه)', async () => {
    const a = await device('A8')
    for (let i = 0; i < 30; i++) await repo.addTransaction(a.db, expense(1000 + i, `t${i}`))
    await a.sync()
    const fresh = await device('fresh')
    const r = await pull(fresh.db, fresh.o)
    expect(r.applied).toBeGreaterThan(30)
    const notes = new Set((await fresh.db.transactions.toArray()).map((t) => t.note))
    expect(notes.has('t0') && notes.has('t29')).toBe(true)
  })

  it('اتصال دوباره (قطع و وصل) تعارض بی‌مورد نمی‌سازد', async () => {
    const a = await device('A9')
    for (let i = 0; i < 3; i++) await repo.addTransaction(a.db, expense(500 + i, `r${i}`))
    await a.sync()
    await resetSyncState(a.db)
    expect(await a.db.outbox.count()).toBeGreaterThan(3)
    await a.sync()
    // تنها تعارض مجاز: تنظیمات (موجودی اولیه را آزمون دیگری روی همین سرور تغییر داده؛ تفاوت واقعی است)
    const cs = await a.db.conflicts.toArray()
    expect(cs.every((c) => c.collection === 'settings')).toBe(true)
    expect(await a.db.outbox.where('conflict').equals(0).count()).toBe(0)
  })
})
