import type { DueItem } from './debts'
import { describeDays } from './debts'
import { formatNumber } from './money'

/**
 * اعلان‌های یادآوری اقساط.
 *
 * محدودیت واقعی iOS: وب‌اپ فقط وقتی به صفحهٔ اصلی اضافه شده باشد (iOS 16.4+) اجازهٔ اعلان دارد،
 * و «زمان‌بندی اعلان محلی» در هیچ مرورگری وجود ندارد. بنابراین:
 *  - هنگام باز شدن برنامه، اقساط سررسیدشده/نزدیک به‌صورت اعلان و نشان (Badge) اعلام می‌شوند؛
 *  - برای اعلان در زمان بسته بودن برنامه، باید از Web Push از طریق سرور لپ‌تاپ (مرحلهٔ ۴/۵)
 *    یا افزودن سررسیدها به تقویم آیفون (فایل .ics) استفاده شود.
 */

export type NotifSupport = 'unsupported' | 'default' | 'granted' | 'denied'

export function notificationSupport(): NotifSupport {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission as NotifSupport
}

export async function requestNotificationPermission(): Promise<NotifSupport> {
  if (notificationSupport() === 'unsupported') return 'unsupported'
  try {
    return (await Notification.requestPermission()) as NotifSupport
  } catch {
    return 'denied'
  }
}

export function reminderText(item: DueItem): { title: string; body: string } {
  const verb = item.debt.direction === 'borrowed' ? 'پرداخت قسط' : 'دریافت قسط'
  return {
    title: `${verb} ${item.debt.counterparty}`,
    body: `قسط ${formatNumber(item.installment.index)} به مبلغ ${formatNumber(item.installment.amount)} تومان — ${describeDays(item.days)}`,
  }
}

function alreadyNotified(key: string): boolean {
  try {
    if (localStorage.getItem(key)) return true
    localStorage.setItem(key, '1')
  } catch {
    /* در صورت در دسترس نبودن حافظه، تکرار اعلان بی‌خطر است */
  }
  return false
}

/** نمایش اعلان سیستمی برای اقساط (هر قسط حداکثر یک بار در روز) */
export async function showDueNotifications(items: DueItem[], today: string): Promise<number> {
  if (notificationSupport() !== 'granted') return 0
  let shown = 0
  const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration().catch(() => undefined) : undefined
  for (const item of items) {
    if (alreadyNotified(`dk-notified:${item.installment.id}:${today}`)) continue
    const { title, body } = reminderText(item)
    try {
      if (reg) await reg.showNotification(title, { body, tag: item.installment.id, icon: '/icon.svg' })
      else new Notification(title, { body, tag: item.installment.id })
      shown++
    } catch {
      /* برخی مرورگرها سازندهٔ Notification را بدون Service Worker نمی‌پذیرند */
    }
  }
  return shown
}

/** نشان عددی روی آیکون برنامه (iOS 16.4+ برای وب‌اپ نصب‌شده) */
export function setAppBadge(count: number) {
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  try {
    if (count > 0) nav.setAppBadge?.(count)?.catch(() => {})
    else nav.clearAppBadge?.()?.catch(() => {})
  } catch {
    /* پشتیبانی نمی‌شود */
  }
}
