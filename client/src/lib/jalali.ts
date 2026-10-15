import { jalaaliMonthLength, toGregorian, toJalaali } from 'jalaali-js'
import { toFaDigits } from './digits'

/**
 * قرارداد تاریخ در کل برنامه:
 * تاریخ تراکنش به‌صورت رشتهٔ «YYYY-MM-DD» میلادی (ISO 8601، فقط تاریخ، بدون منطقهٔ زمانی) ذخیره می‌شود.
 * این قالب استاندارد، قابل مرتب‌سازی متنی و بدون خطای جابه‌جایی ساعت است.
 * تبدیل به شمسی فقط در لایهٔ نمایش و فیلترها انجام می‌شود.
 */
export type IsoDate = string

export interface JDate {
  jy: number
  jm: number
  jd: number
}

export const JALALI_MONTHS = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
]

/** روزهای هفته با شروع از شنبه */
export const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']
export const WEEKDAYS_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

const pad = (n: number) => String(n).padStart(2, '0')

export function isoFromParts(y: number, m: number, d: number): IsoDate {
  return `${String(y).padStart(4, '0')}-${pad(m)}-${pad(d)}`
}

function parseIso(iso: IsoDate): [number, number, number] {
  const [y, m, d] = iso.split('-').map(Number)
  return [y, m, d]
}

export function isValidIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const [y, m, d] = parseIso(iso)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

/** تاریخ امروز بر اساس ساعت محلی دستگاه */
export function todayIso(now: Date = new Date()): IsoDate {
  return isoFromParts(now.getFullYear(), now.getMonth() + 1, now.getDate())
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const [y, m, d] = parseIso(iso)
  const dt = new Date(Date.UTC(y, m - 1, d + days))
  return isoFromParts(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate())
}

export function diffDays(a: IsoDate, b: IsoDate): number {
  const [ay, am, ad] = parseIso(a)
  const [by, bm, bd] = parseIso(b)
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000)
}

export function toJ(iso: IsoDate): JDate {
  const [y, m, d] = parseIso(iso)
  return toJalaali(y, m, d)
}

export function fromJ(jy: number, jm: number, jd: number): IsoDate {
  const g = toGregorian(jy, jm, jd)
  return isoFromParts(g.gy, g.gm, g.gd)
}

export function monthLength(jy: number, jm: number): number {
  return jalaaliMonthLength(jy, jm)
}

/** اندیس روز هفته با شروع از شنبه (۰ = شنبه … ۶ = جمعه) */
export function weekdayIndex(iso: IsoDate): number {
  const [y, m, d] = parseIso(iso)
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 1) % 7
}

export interface DateRange {
  start: IsoDate
  end: IsoDate // شامل
}

export function jMonthRange(jy: number, jm: number): DateRange {
  return { start: fromJ(jy, jm, 1), end: fromJ(jy, jm, monthLength(jy, jm)) }
}

export function shiftJMonth(jy: number, jm: number, delta: number): { jy: number; jm: number } {
  const idx = jy * 12 + (jm - 1) + delta
  return { jy: Math.floor(idx / 12), jm: (idx % 12) + 1 }
}

/** هفتهٔ شنبه تا جمعه شامل تاریخ داده‌شده */
export function weekRange(iso: IsoDate): DateRange {
  const start = addDays(iso, -weekdayIndex(iso))
  return { start, end: addDays(start, 6) }
}

export function inRange(iso: IsoDate, r: DateRange): boolean {
  return iso >= r.start && iso <= r.end
}

/** ۲۲ مهر ۱۴۰۵ */
export function formatJLong(iso: IsoDate): string {
  const { jy, jm, jd } = toJ(iso)
  return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`
}

/** ۲۲ مهر */
export function formatJDayMonth(iso: IsoDate): string {
  const { jm, jd } = toJ(iso)
  return `${toFaDigits(jd)} ${JALALI_MONTHS[jm - 1]}`
}

/** ۱۴۰۵/۰۷/۲۲ */
export function formatJNumeric(iso: IsoDate): string {
  const { jy, jm, jd } = toJ(iso)
  return toFaDigits(`${jy}/${pad(jm)}/${pad(jd)}`)
}

export function formatJMonth(jy: number, jm: number): string {
  return `${JALALI_MONTHS[jm - 1]} ${toFaDigits(jy)}`
}

/** «امروز»، «دیروز» یا «سه‌شنبه ۲۲ مهر» */
export function formatRelativeDay(iso: IsoDate, today: IsoDate = todayIso()): string {
  const diff = diffDays(iso, today)
  if (diff === 0) return 'امروز'
  if (diff === 1) return 'دیروز'
  const { jy } = toJ(iso)
  const base = `${WEEKDAYS[weekdayIndex(iso)]} ${formatJDayMonth(iso)}`
  return jy === toJ(today).jy ? base : `${base} ${toFaDigits(jy)}`
}

/** زمان (ISO) به‌صورت «امروز، ۱۴:۰۵» یا «دیروز، ۰۹:۳۰» بر اساس ساعت محلی */
export function formatDateTime(isoTimestamp: string, now: Date = new Date()): string {
  const d = new Date(isoTimestamp)
  if (Number.isNaN(d.getTime())) return '—'
  const hm = toFaDigits(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`)
  return `${formatRelativeDay(todayIso(d), todayIso(now))}، ${hm}`
}
