import { describe, expect, it } from 'vitest'
import type { Debt } from '../../data/types'
import { alarmTrigger, buildIcs, buildInstallments, debtStatus, monthlyDueDates, remindersDue, upcomingInstallments, validateDebtInput } from '../debts'
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
    const base = { direction: 'borrowed' as const, kind: 'personal' as const, counterparty: 'علی', startDate: '2026-01-01', note: '', count: 3, installmentAmount: 100, firstDueDate: '2026-01-01', alreadyPaid: 0, reminder: { enabled: false, daysBefore: 0 } }
    expect(validateDebtInput(base)).toBeNull()
    expect(validateDebtInput({ ...base, counterparty: ' ' })).not.toBeNull()
    expect(validateDebtInput({ ...base, alreadyPaid: 4 })).not.toBeNull()
    expect(validateDebtInput({ ...base, installmentAmount: 0 })).not.toBeNull()
  })
  it('فایل تقویم فقط اقساط پرداخت‌نشده با هشدار ۹ صبح', () => {
    const ics = buildIcs([mk()], String, new Date('2026-10-14T00:00:00Z'))
    expect(ics.match(/BEGIN:VEVENT/g)?.length).toBe(4)
    expect(ics).toContain('TRIGGER:-P2DT15H')
    expect(alarmTrigger(0)).toBe('PT9H')
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR')
  })
})
