import { describe, expect, it } from 'vitest'
import type { Debt } from '../../data/types'
import { notificationId, planReminders } from '../nativeReminders'

const debt = (over: Partial<Debt> = {}): Debt => ({
  id: 'd', direction: 'borrowed', kind: 'loan', counterparty: 'بانک', startDate: '2026-01-01', note: '',
  installments: [
    { id: 'i1', index: 1, dueDate: '2026-10-10', amount: 1000, paidDate: '2026-10-10' },
    { id: 'i2', index: 2, dueDate: '2026-11-10', amount: 2000 },
    { id: 'i3', index: 3, amount: 3000 }, // بدون سررسید
    { id: 'i4', index: 4, dueDate: '2026-12-10', amount: 4000 },
  ],
  reminder: { enabled: true, daysBefore: 3 }, createdAt: '', updatedAt: '', ...over,
})

describe('اعلان‌های زمان‌بندی‌شدهٔ اندروید', () => {
  it('فقط اقساط پرداخت‌نشدهٔ دارای سررسید آینده، ساعت ۹ صبحِ N روز قبل', () => {
    const plan = planReminders([debt()], new Date(2026, 9, 15))
    expect(plan.map((p) => p.body.includes('۲٬۰۰۰'))).toEqual([true, false])
    expect(plan[0].at).toEqual(new Date(2026, 10, 7, 9, 0, 0))
    expect(plan[0].title).toContain('پرداخت قسط')
  })
  it('یادآوری خاموش یا زمان گذشته ← بدون اعلان', () => {
    expect(planReminders([debt({ reminder: { enabled: false, daysBefore: 3 } })], new Date(2026, 9, 15))).toEqual([])
    expect(planReminders([debt()], new Date(2027, 0, 1))).toEqual([])
  })
  it('شناسهٔ پایدار، مثبت و ۳۲ بیتی', () => {
    expect(notificationId('abc')).toBe(notificationId('abc'))
    expect(notificationId('abc')).not.toBe(notificationId('abd'))
    for (const s of ['x', 'یک', '0f8b-41'] ) expect(notificationId(s)).toBeGreaterThan(0)
    expect(notificationId('long-id-'.repeat(20))).toBeLessThan(2 ** 31)
  })
})
