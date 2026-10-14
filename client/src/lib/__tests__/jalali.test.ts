import { describe, expect, it } from 'vitest'
import {
  addDays, formatJLong, formatRelativeDay, fromJ, isValidIso, jMonthRange, monthLength, shiftJMonth, toJ, weekdayIndex, weekRange,
} from '../jalali'

describe('تبدیل تاریخ شمسی', () => {
  it('نوروزهای شناخته‌شده', () => {
    expect(fromJ(1403, 1, 1)).toBe('2024-03-20')
    expect(fromJ(1404, 1, 1)).toBe('2025-03-21')
    expect(fromJ(1405, 1, 1)).toBe('2026-03-21')
  })
  it('رفت و برگشت', () => {
    expect(toJ('2026-10-14')).toEqual({ jy: 1405, jm: 7, jd: 22 })
    expect(fromJ(1405, 7, 22)).toBe('2026-10-14')
  })
  it('طول ماه‌ها و سال کبیسه', () => {
    expect(monthLength(1403, 12)).toBe(30) // ۱۴۰۳ کبیسه
    expect(monthLength(1404, 12)).toBe(29)
    expect(monthLength(1405, 6)).toBe(31)
    expect(monthLength(1405, 7)).toBe(30)
  })
  it('مرز ماه و سال', () => {
    expect(jMonthRange(1403, 12)).toEqual({ start: '2025-02-19', end: '2025-03-20' })
    expect(addDays(jMonthRange(1403, 12).end, 1)).toBe(fromJ(1404, 1, 1))
    expect(shiftJMonth(1404, 12, 1)).toEqual({ jy: 1405, jm: 1 })
    expect(shiftJMonth(1405, 1, -1)).toEqual({ jy: 1404, jm: 12 })
    expect(shiftJMonth(1405, 7, -19)).toEqual({ jy: 1403, jm: 12 })
  })
  it('هفته از شنبه تا جمعه', () => {
    expect(weekdayIndex('2026-10-17')).toBe(0) // شنبه
    expect(weekdayIndex('2026-10-23')).toBe(6) // جمعه
    expect(weekRange('2026-10-14')).toEqual({ start: '2026-10-10', end: '2026-10-16' })
  })
  it('قالب نمایش', () => {
    expect(formatJLong('2026-10-14')).toBe('۲۲ مهر ۱۴۰۵')
    expect(formatRelativeDay('2026-10-14', '2026-10-14')).toBe('امروز')
    expect(formatRelativeDay('2026-10-13', '2026-10-14')).toBe('دیروز')
  })
  it('اعتبارسنجی ISO', () => {
    expect(isValidIso('2025-02-29')).toBe(false)
    expect(isValidIso('2024-02-29')).toBe(true)
    expect(isValidIso('2024-2-9')).toBe(false)
  })
})
