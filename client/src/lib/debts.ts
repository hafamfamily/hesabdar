import type { Debt, DebtInput, Installment, ScheduleRow, Transaction } from '../data/types'
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

/** جدول اقساط مساوی */
export function equalSchedule(count: number, amount: number, firstDue: IsoDate, alreadyPaid = 0): ScheduleRow[] {
  return monthlyDueDates(firstDue, count).map((dueDate, i) => ({
    dueDate,
    amount,
    paid: i < alreadyPaid,
    paidBefore: i < alreadyPaid || undefined,
    paidDate: i < alreadyPaid ? dueDate : undefined,
  }))
}

/**
 * جدول اقساط با سقف مبلغ: هیچ قسطی از سقف بیشتر نمی‌شود؛
 * تعداد اقساط = سقف بالای (جمع ÷ سقف) و آخرین قسط باقی‌ماندهٔ مبلغ است.
 */
export function cappedSchedule(total: number, maxAmount: number, firstDue: IsoDate, alreadyPaid = 0): ScheduleRow[] {
  if (total <= 0 || maxAmount <= 0) return []
  const count = Math.ceil(total / maxAmount)
  if (count > 360) return []
  const rows = equalSchedule(count, maxAmount, firstDue, alreadyPaid)
  rows[count - 1].amount = total - maxAmount * (count - 1)
  return rows
}

/** شماره‌گذاری اقساط بر اساس سررسید (بدون سررسید در انتها) */
export function rowsToInstallments(rows: ScheduleRow[]): Installment[] {
  return [...rows]
    .map((r, order) => ({ r, order }))
    .sort((a, b) => (a.r.dueDate ?? '9999').localeCompare(b.r.dueDate ?? '9999') || a.order - b.order)
    .map(({ r }, i) => ({
      id: r.id ?? uuid(),
      index: i + 1,
      dueDate: r.dueDate,
      amount: r.amount,
      paidDate: r.paid ? (r.paidDate ?? r.dueDate) : undefined,
      paidBefore: r.paid ? r.paidBefore : undefined,
      transactionId: r.paid ? r.transactionId : undefined,
    }))
}

export function installmentsToRows(list: Installment[]): ScheduleRow[] {
  return [...list]
    .sort((a, b) => a.index - b.index)
    .map((i) => ({ id: i.id, dueDate: i.dueDate, amount: i.amount, paid: !!i.paidDate, paidDate: i.paidDate, paidBefore: i.paidBefore, transactionId: i.transactionId }))
}

/** سازگاری با کد قبلی و دادهٔ نمونه */
export function buildInstallments(input: { count: number; installmentAmount: number; firstDueDate: IsoDate; alreadyPaid: number }): Installment[] {
  return rowsToInstallments(equalSchedule(input.count, input.installmentAmount, input.firstDueDate, input.alreadyPaid))
}

export function validateSchedule(rows: ScheduleRow[]): string | null {
  if (rows.length === 0) return 'حداقل یک قسط لازم است'
  if (rows.length > 360) return 'تعداد اقساط حداکثر ۳۶۰ است'
  if (rows.some((r) => !Number.isSafeInteger(r.amount) || r.amount <= 0)) return 'مبلغ همهٔ اقساط باید بیشتر از صفر باشد'
  return null
}

export function validateDebtInput(d: DebtInput): string | null {
  if (!d.counterparty.trim()) return 'نام طرف حساب را وارد کنید'
  if (d.principal !== undefined && (!Number.isSafeInteger(d.principal) || d.principal < 0)) return 'مبلغ اصل نامعتبر است'
  if (d.disbursement && (!Number.isSafeInteger(d.disbursement.amount) || d.disbursement.amount <= 0)) return 'مبلغ واردشده به موجودی نامعتبر است'
  return validateSchedule(d.schedule)
}

export const scheduleTotal = (rows: { amount: number }[]) => rows.reduce((s, r) => s + r.amount, 0)

export interface DebtStatus {
  total: number
  paidAmount: number
  remainingAmount: number
  paidCount: number
  count: number
  next?: Installment
  /** روز تا سررسید قسط بعدی (منفی = گذشته؛ خالی = بدون سررسید) */
  daysToNext?: number
  overdueCount: number
  settled: boolean
}

const byDue = (a: Installment, b: Installment) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.index - b.index

export function debtStatus(d: Debt, today: IsoDate): DebtStatus {
  let total = 0
  let paidAmount = 0
  let paidCount = 0
  let overdueCount = 0
  let next: Installment | undefined
  for (const ins of [...d.installments].sort(byDue)) {
    total += ins.amount
    if (ins.paidDate) {
      paidAmount += ins.amount
      paidCount++
    } else {
      if (!next) next = ins
      if (ins.dueDate && ins.dueDate < today) overdueCount++
    }
  }
  return {
    total,
    paidAmount,
    remainingAmount: total - paidAmount,
    paidCount,
    count: d.installments.length,
    next,
    daysToNext: next?.dueDate ? diffDays(today, next.dueDate) : undefined,
    overdueCount,
    settled: d.installments.length > 0 && paidCount === d.installments.length,
  }
}

/**
 * اثر بدهی‌ها روی موجودی نقد:
 *  - مبلغ قرض/وام دریافتی (+) یا قرض داده‌شده (−) اگر «وارد موجودی» شده باشد؛
 *  - اقساط پرداختی (−) یا دریافتی (+)، به‌جز اقساطی که پیش از شروع برنامه پرداخت شده‌اند
 *    یا به‌صورت تراکنش هزینه/درآمد ثبت شده‌اند (تا دوبار حساب نشوند).
 */
export interface DebtCashFlow {
  received: number // قرض/وام گرفته‌شده واردشده به موجودی
  lent: number // قرض داده‌شده خارج‌شده از موجودی
  repaid: number // اقساط پرداختی من
  collected: number // اقساط دریافتی از دیگران
  net: number
}

export function debtCashFlow(debts: Debt[]): DebtCashFlow {
  const f = { received: 0, lent: 0, repaid: 0, collected: 0 }
  for (const d of debts) {
    const borrowed = d.direction === 'borrowed'
    if (d.disbursement) borrowed ? (f.received += d.disbursement.amount) : (f.lent += d.disbursement.amount)
    for (const i of d.installments) {
      if (!i.paidDate || i.paidBefore || i.transactionId) continue
      borrowed ? (f.repaid += i.amount) : (f.collected += i.amount)
    }
  }
  return { ...f, net: f.received - f.lent - f.repaid + f.collected }
}

export interface DebtPosition {
  owe: number // مانده بدهی‌های من
  owed: number // مانده طلب‌های من
}

export function debtPosition(debts: Debt[], today: IsoDate): DebtPosition {
  let owe = 0
  let owed = 0
  for (const d of debts) {
    const r = debtStatus(d, today).remainingAmount
    if (d.direction === 'borrowed') owe += r
    else owed += r
  }
  return { owe, owed }
}

export interface DueItem {
  debt: Debt
  installment: Installment
  days: number // منفی = سررسید گذشته
}

/** اقساط پرداخت‌نشده‌ای که سررسیدشان گذشته یا در N روز آینده است (اقساط بدون سررسید شامل نمی‌شوند) */
export function upcomingInstallments(debts: Debt[], today: IsoDate, withinDays: number): DueItem[] {
  const out: DueItem[] = []
  for (const debt of debts) {
    for (const ins of debt.installments) {
      if (ins.paidDate || !ins.dueDate) continue
      const days = diffDays(today, ins.dueDate)
      if (days <= withinDays) out.push({ debt, installment: ins, days })
    }
  }
  return out.sort((a, b) => a.installment.dueDate!.localeCompare(b.installment.dueDate!))
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

/** هشدار ساعت ۹ صبحِ N روز قبل از سررسید (رویداد تمام‌روز از نیمه‌شب شروع می‌شود) */
export function alarmTrigger(daysBefore: number): string {
  return daysBefore <= 0 ? 'PT9H' : `-P${daysBefore - 1}DT15H`
}

/**
 * فایل تقویم (iCalendar / RFC 5545) برای اقساط پرداخت‌نشدهٔ دارای سررسید، همراه هشدار.
 * با باز کردن این فایل در آیفون، رویدادها به تقویم دستگاه اضافه می‌شوند و
 * هشدارها حتی وقتی برنامه بسته و لپ‌تاپ خاموش است توسط خود iOS نمایش داده می‌شوند.
 */
export function buildIcs(debts: Debt[], formatAmount: (n: number) => string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\n/g, '\\n')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DakhlKharj//FA', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const d of debts) {
    for (const ins of d.installments) {
      if (ins.paidDate || !ins.dueDate) continue
      const verb = d.direction === 'borrowed' ? 'پرداخت قسط' : 'دریافت قسط'
      lines.push(
        'BEGIN:VEVENT',
        `UID:${ins.id}@dakhlkharj`,
        `DTSTAMP:${stamp}`,
        `DTSTART;VALUE=DATE:${ins.dueDate.replace(/-/g, '')}`,
        `SUMMARY:${esc(`${verb} ${ins.index} — ${d.counterparty}`)}`,
        `DESCRIPTION:${esc(`مبلغ: ${formatAmount(ins.amount)} تومان`)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        `DESCRIPTION:${esc(`${verb} ${d.counterparty}`)}`,
        `TRIGGER:${alarmTrigger(Math.max(0, d.reminder.daysBefore))}`,
        'END:VALARM',
        'END:VEVENT',
      )
    }
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}

/** تراکنش متناظر با پرداخت قسط (فقط وقتی کاربر بخواهد در گزارش هزینه/درآمد هم دیده شود) */
export function installmentTransaction(debt: Debt, ins: Installment, amount: number, date: IsoDate, categoryId: string): Transaction {
  const now = new Date().toISOString()
  return {
    id: uuid(),
    type: debt.direction === 'borrowed' ? 'expense' : 'income',
    amount,
    date,
    categoryId,
    note: `قسط ${ins.index} — ${debt.counterparty}`,
    createdAt: now,
    updatedAt: now,
  }
}
