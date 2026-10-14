import { describe, expect, it } from 'vitest'
import type { Transaction } from '../../data/types'
import { byCategory, currentBalance, dailySeries, filterRange, monthlySeries, totals } from '../finance'
import { jMonthRange } from '../jalali'

const tx = (id: string, type: 'income' | 'expense', amount: number, date: string, categoryId = 'c'): Transaction => ({
  id, type, amount, date, categoryId, note: '', createdAt: `${date}T00:00:00Z`, updatedAt: `${date}T00:00:00Z`,
})

const data = [
  tx('1', 'income', 10_000_000, '2026-09-22', 'salary'), // ۳۱ شهریور
  tx('2', 'expense', 2_000_000, '2026-09-23', 'food'), // ۱ مهر
  tx('3', 'expense', 500_000, '2026-10-22', 'bills'), // ۳۰ مهر
  tx('4', 'expense', 300_000, '2026-10-23', 'food'), // ۱ آبان
]

describe('محاسبات مالی', () => {
  it('مانده = موجودی اولیه + درآمد − هزینه', () => {
    expect(currentBalance(1_000_000, data)).toBe(1_000_000 + 10_000_000 - 2_800_000)
    expect(currentBalance(0, [])).toBe(0)
  })
  it('فیلتر مرز ماه شمسی (مهر ۱۴۰۵)', () => {
    const mehr = filterRange(data, jMonthRange(1405, 7))
    expect(mehr.map((t) => t.id)).toEqual(['2', '3'])
    expect(totals(mehr)).toEqual({ income: 0, expense: 2_500_000, net: -2_500_000 })
  })
  it('سهم دسته‌بندی‌ها', () => {
    const s = byCategory(data, [], 'expense')
    expect(s[0].category.id).toBe('food')
    expect(s[0].amount).toBe(2_300_000)
    expect(s.reduce((a, b) => a + b.share, 0)).toBeCloseTo(1)
  })
  it('سری روزانه و ماهانه', () => {
    const d = dailySeries(data, { start: '2026-09-22', end: '2026-09-24' }, (x) => x)
    expect(d.map((p) => [p.income, p.expense])).toEqual([[10_000_000, 0], [0, 2_000_000], [0, 0]])
    const m = monthlySeries(data, 1405, 8, 3, (y, mm) => `${y}-${mm}`)
    expect(m.map((p) => p.key)).toEqual(['1405-6', '1405-7', '1405-8'])
    expect(m.map((p) => p.expense)).toEqual([0, 2_500_000, 300_000])
  })
})
