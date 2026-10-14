import { describe, expect, it } from 'vitest'
import type { Debt } from '../../data/types'
import { alarmTrigger, buildIcs, buildInstallments, cappedSchedule, debtCashFlow, debtPosition, debtStatus, equalSchedule, monthlyDueDates, remindersDue, rowsToInstallments, upcomingInstallments, validateDebtInput } from '../debts'
import { fromJ } from '../jalali'

const mk = (over: Partial<Debt> = {}): Debt => ({
  id: 'd1', direction: 'borrowed', kind: 'loan', counterparty: 'بانک', startDate: '2026-01-01', note: '',
  installments: buildInstallments({ count: 6, installmentAmount: 1_000_000, firstDueDate: fromJ(1405, 5, 10), alreadyPaid: 2 }),
  reminder: { enabled: true, daysBefore: 3 }, createdAt: '', updatedAt: '', ...over,
})

describe('اقساط', () => {
  it('سررسید ماهانهٔ شمسی با روز ثابت و برش در ماه‌های کوتاه', () => {
    expect(monthlyDueDates(fromJ(1405, 5, 31), 4)).toEqual([fromJ(1405, 5, 31), fromJ(1405, 6, 31), fromJ(1405, 7, 30), fromJ(1405, 8, 30)])
    expect(monthlyDueDates(fromJ(1404, 11, 30), 2)).toEqual([fromJ(1404, 11, 30), fromJ(1404, 12, 29)]) // اسفند ۱۴۰۴ ۲۹ روزه
  })
  it('وضعیت: پرداخت‌شده، مانده و قسط بعدی', () => {
    const today = fromJ(1405, 7, 22)
    const st = debtStatus(mk(), today)
    expect(st.paidCount).toBe(2)
    expect(st.remainingAmount).toBe(4_000_000)
    expect(st.next?.dueDate).toBe(fromJ(1405, 7, 10))
    expect(st.overdueCount).toBe(1)
    expect(st.daysToNext).toBe(-12)
    expect(st.settled).toBe(false)
  })
  it('یادآوری: فقط اقساط سررسیدگذشته یا در بازهٔ روزهای قبل', () => {
    const today = fromJ(1405, 8, 7) // ۳ روز قبل از قسط آبان
    const items = remindersDue([mk()], today)
    expect(items.map((i) => i.installment.index)).toEqual([3, 4])
    expect(remindersDue([mk({ reminder: { enabled: false, daysBefore: 3 } })], today)).toEqual([])
    expect(upcomingInstallments([mk()], today, 40).length).toBe(3)
  })
  it('اعتبارسنجی', () => {
    const base = { direction: 'borrowed' as const, kind: 'personal' as const, counterparty: 'علی', startDate: '2026-01-01', note: '', schedule: equalSchedule(3, 100, '2026-01-01'), reminder: { enabled: false, daysBefore: 0 } }
    expect(validateDebtInput(base)).toBeNull()
    expect(validateDebtInput({ ...base, counterparty: ' ' })).not.toBeNull()
    expect(validateDebtInput({ ...base, schedule: [] })).not.toBeNull()
    expect(validateDebtInput({ ...base, schedule: [{ amount: 0, paid: false }] })).not.toBeNull()
  })
  it('سقف مبلغ قسط: هیچ قسطی بیشتر از سقف نمی‌شود', () => {
    const rows = cappedSchedule(20_000_000, 3_000_000, '2026-01-01')
    expect(rows.length).toBe(7)
    expect(rows.slice(0, 6).every((r) => r.amount === 3_000_000)).toBe(true)
    expect(rows[6].amount).toBe(2_000_000)
    expect(cappedSchedule(9_000_000, 3_000_000, '2026-01-01').map((r) => r.amount)).toEqual([3e6, 3e6, 3e6])
  })
  it('اقساط با مبلغ متفاوت و بدون سررسید', () => {
    const rows = equalSchedule(24, 2_500_000, '2026-01-01')
    rows[0].amount = 3_000_000
    rows[1].amount = 3_000_000
    const list = rowsToInstallments([...rows, { amount: 1000, paid: false }])
    expect(list.at(-1)?.dueDate).toBeUndefined()
    expect(list.at(-1)?.index).toBe(25)
    const d = mk({ installments: list })
    expect(debtStatus(d, '2025-01-01').total).toBe(6_000_000 + 22 * 2_500_000 + 1000)
    expect(upcomingInstallments([d], '2030-01-01', 0).length).toBe(24) // بدون سررسید شامل نمی‌شود
  })
  it('اثر نقدی: وام دریافتی وارد موجودی، اقساط پیش از برنامه بی‌اثر، تراکنش‌دار دوبار حساب نمی‌شود', () => {
    const loan = mk({ disbursement: { amount: 60_000_000, date: '2026-01-01' } }) // ۲ قسط paidBefore
    loan.installments[2] = { ...loan.installments[2], paidDate: '2026-02-01' }
    loan.installments[3] = { ...loan.installments[3], paidDate: '2026-03-01', transactionId: 't1' }
    const lent = mk({ id: 'd2', direction: 'lent', disbursement: { amount: 5_000_000, date: '2026-01-01' } })
    lent.installments[2] = { ...lent.installments[2], paidDate: '2026-02-01' }
    const f = debtCashFlow([loan, lent])
    expect(f).toEqual({ received: 60_000_000, lent: 5_000_000, repaid: 1_000_000, collected: 1_000_000, net: 55_000_000 })
    expect(debtPosition([loan, lent], '2026-01-01')).toEqual({ owe: 2_000_000, owed: 3_000_000 })
  })
  it('فایل تقویم فقط اقساط پرداخت‌نشده با هشدار ۹ صبح', () => {
    const ics = buildIcs([mk()], String, new Date('2026-10-14T00:00:00Z'))
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(4)
    expect(ics).toContain('TRIGGER:-P2DT15H')
    expect(alarmTrigger(0)).toBe('PT9H')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
})
