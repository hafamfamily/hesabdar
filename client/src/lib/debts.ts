import type { Debt, DebtInput, Installment } from '../data/types'
import { uuid } from './id'
import { diffDays, fromJ, type IsoDate, monthLength, shiftJMonth, toJ } from './jalali'

/**
 * سررسیدهای ماهانه بر اساس تقویم شمسی.
 * روز سررسید ثابت می‌ماند؛ اگر ماهی آن روز را نداشته باشد (مثلاً ۳۱ در مهر)، آخرین روز همان ماه در نظر گرفته می‌شود.
 */
export function monthlyDueDates(first: IsoDate, count: number): IsoDate[] {
  const { jy, jm, jd } = toJ(first)
  const out: IsoDate[] = []
  for (let i = 0; i < count; i++) {
    const m = shiftJMonth(jy, jm, i)
    out.push(fromJ(m.jy, m.jm, Math.min(jd, monthLength(m.jy, m.jm))))
  }
  return out
}

export function buildInstallments(input: Pick<DebtInput, 'count' | 'installmentAmount' | 'firstDueDate' | 'alreadyPaid'>): Installment[] {
  return monthlyDueDates(input.firstDueDate, input.count).map((dueDate, i) => ({
    id: uuid(),
    index: i + 1,
    dueDate,
    amount: input.installmentAmount,
    paidDate: i < input.alreadyPaid ? dueDate : undefined,
  }))
}

export function validateDebtInput(d: DebtInput): string | null {
  if (!d.counterparty.trim()) return 'نام طرف حساب را وارد کنید'
  if (!Number.isInteger(d.count) || d.count < 1 || d.count > 360) return 'تعداد اقساط باید بین ۱ تا ۳۶۰ باشد'
  if (!Number.isSafeInteger(d.installmentAmount) || d.installmentAmount <= 0) return 'مبلغ قسط باید بیشتر از صفر باشد'
  if (!Number.isInteger(d.alreadyPaid) || d.alreadyPaid < 0 || d.alreadyPaid > d.count) return 'تعداد اقساط پرداخت‌شده نامعتبر است'
  if (d.principal !== undefined && (!Number.isSafeInteger(d.principal) || d.principal < 0)) return 'مبلغ اصل نامعتبر است'
  return null
}

export interface DebtStatus {
  total: number
  paidAmount: number
  remainingAmount: number
  paidCount: number
  count: number
  next?: Installment
  /** روز تا سررسید قسط بعدی (منفی = گذشته) */
  daysToNext?: number
  overdueCount: number
  settled: boolean
}

export function debtStatus(d: Debt, today: IsoDate): DebtStatus {
  let total = 0
  let paidAmount = 0
  let paidCount = 0
  let overdueCount = 0
  let next: Installment | undefined
  for (const ins of [...d.installments].sort((a, b) => a.dueDate.localeCompare(b.dueDate))) {
    total += ins.amount
    if (ins.paidDate) {
      paidAmount += ins.amount
      paidCount++
    } else {
      if (!next) next = ins
      if (ins.dueDate < today) overdueCount++
    }
  }
  return {
    total,
    paidAmount,
    remainingAmount: total - paidAmount,
    paidCount,
    count: d.installments.length,
    next,
    daysToNext: next ? diffDays(today, next.dueDate) : undefined,
    overdueCount,
    settled: d.installments.length > 0 && paidCount === d.installments.length,
  }
}

export interface DueItem {
  debt: Debt
  installment: Installment
  days: number // منفی = سررسید گذشته
}

/** اقساط پرداخت‌نشده‌ای که سررسیدشان گذشته یا در N روز آینده است */
export function upcomingInstallments(debts: Debt[], today: IsoDate, withinDays: number): DueItem[] {
  const out: DueItem[] = []
  for (const debt of debts) {
    for (const ins of debt.installments) {
      if (ins.paidDate) continue
      const days = diffDays(today, ins.dueDate)
      if (days <= withinDays) out.push({ debt, installment: ins, days })
    }
  }
  return out.sort((a, b) => a.installment.dueDate.localeCompare(b.installment.dueDate))
}

/** اقساطی که بر اساس تنظیم یادآوری هر بدهی باید امروز اعلام شوند */
export function remindersDue(debts: Debt[], today: IsoDate): DueItem[] {
  return debts
    .filter((d) => d.reminder.enabled)
    .flatMap((d) => upcomingInstallments([d], today, d.reminder.daysBefore))
}

export function describeDays(days: number): string {
  const fa = (n: number) => String(n).replace(/\d/g, (x) => '۰۱۲۳۴۵۶۷۸۹'[Number(x)])
  if (days === 0) return 'امروز'
  if (days === 1) return 'فردا'
  if (days === -1) return 'دیروز گذشت'
  if (days > 0) return `${fa(days)} روز دیگر`
  return `${fa(-days)} روز گذشته`
}

/**
 * فایل تقویم (iCalendar / RFC 5545) برای اقساط پرداخت‌نشده، همراه هشدار.
 * با باز کردن این فایل در آیفون، رویدادها به تقویم دستگاه اضافه می‌شوند و
 * هشدارها حتی وقتی برنامه بسته و لپ‌تاپ خاموش است توسط خود iOS نمایش داده می‌شوند.
 */
export function buildIcs(debts: Debt[], formatAmount: (n: number) => string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DakhlKharj//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const d of debts) {
    for (const ins of d.installments) {
      if (ins.paidDate) continue
      const day = ins.dueDate.replace(/-/g, '')
      const verb = d.direction === 'borrowed' ? 'پرداخت قسط' : 'دریافت قسط'
      const before = Math.max(0, d.reminder.daysBefore)
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ins.id}@dakhlkharj`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${day}`,
        `SUMMARY:${esc(`${verb} ${ins.index} — ${d.counterparty}`)}`,
        `DESCRIPTION:${esc(`مبلغ: ${formatAmount(ins.amount)} تومان`)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(`${verb} ${d.counterparty}`)}`,
        `TRIGGER:${alarmTrigger(before)}`,
        'END:VALARM',
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** هشدار ساعت ۹ صبحِ N روز قبل از سررسید (رویداد تمام‌روز از نیمه‌شب شروع می‌شود) */
export function alarmTrigger(daysBefore: number): string {
  return daysBefore <= 0 ? 'PT9H' : `-P${daysBefore - 1}DT15H`
}
