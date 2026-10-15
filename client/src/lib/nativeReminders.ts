import type { Debt } from '../data/types'
import { formatNumber } from './money'

/**
 * اعلان‌های زمان‌بندی‌شدهٔ اندروید برای اقساط.
 * برخلاف نسخهٔ وب، این اعلان‌ها حتی وقتی برنامه بسته است در زمان مقرر (ساعت ۹ صبح) نمایش داده می‌شوند.
 * پس از هر تغییر در بدهی‌ها، همهٔ اعلان‌ها از نو زمان‌بندی می‌شوند.
 */

const MAX = 64 // اندروید تعداد هشدارهای هم‌زمان هر برنامه را محدود می‌کند

/** شناسهٔ عددی پایدار برای هر قسط (اندروید شناسهٔ ۳۲ بیتی می‌خواهد) */
export function notificationId(installmentId: string): number {
  let h = 2166136261
  for (let i = 0; i < installmentId.length; i++) h = Math.imul(h ^ installmentId.charCodeAt(i), 16777619)
  return (h >>> 1) || 1
}

export interface PlannedNotification {
  id: number
  title: string
  body: string
  at: Date
}

/** برنامهٔ اعلان‌ها (تابع خالص، قابل تست) */
export function planReminders(debts: Debt[], now: Date = new Date()): PlannedNotification[] {
  const out: PlannedNotification[] = []
  for (const d of debts) {
    if (!d.reminder.enabled) continue
    for (const ins of d.installments) {
      if (ins.paidDate || !ins.dueDate) continue
      const [y, m, day] = ins.dueDate.split('-').map(Number)
      const at = new Date(y, m - 1, day - d.reminder.daysBefore, 9, 0, 0)
      if (at <= now) continue
      const verb = d.direction === 'borrowed' ? 'پرداخت قسط' : 'دریافت قسط'
      const when = d.reminder.daysBefore === 0 ? 'امروز' : `${String(d.reminder.daysBefore).replace(/\d/g, (x) => '۰۱۲۳۴۵۶۷۸۹'[Number(x)])} روز دیگر`
      out.push({
        id: notificationId(ins.id),
        title: `${verb} — ${d.counterparty}`,
        body: `قسط ${formatNumber(ins.index)} به مبلغ ${formatNumber(ins.amount)} تومان، سررسید ${when}`,
        at,
      })
    }
  }
  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX)
}

async function plugin() {
  return (await import('@capacitor/local-notifications')).LocalNotifications
}

export async function nativePermission(request = false): Promise<'granted' | 'denied' | 'default'> {
  const LN = await plugin()
  const p = request ? await LN.requestPermissions() : await LN.checkPermissions()
  return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'default'
}

/** لغو همهٔ اعلان‌های قبلی و زمان‌بندی دوباره */
export async function rescheduleNative(debts: Debt[], enabled: boolean): Promise<number> {
  const LN = await plugin()
  const pending = await LN.getPending()
  if (pending.notifications.length) await LN.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) })
  if (!enabled || (await nativePermission()) !== 'granted') return 0
  const plan = planReminders(debts)
  if (plan.length === 0) return 0
  await LN.schedule({
    notifications: plan.map((p) => ({ id: p.id, title: p.title, body: p.body, schedule: { at: p.at, allowWhileIdle: true } })),
  })
  return plan.length
}
