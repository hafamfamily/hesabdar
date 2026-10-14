import { useEffect, useMemo } from 'react'
import { useStore } from '../data/store'
import { remindersDue } from '../lib/debts'
import { todayIso } from '../lib/jalali'
import { setAppBadge, showDueNotifications } from '../lib/reminders'

/** فهرست اقساطی که طبق تنظیم یادآوری باید اعلام شوند */
export function useDueList() {
  const { debts, settings } = useStore()
  const today = todayIso()
  return useMemo(() => (settings.reminders.enabled ? remindersDue(debts, today) : []), [debts, settings.reminders.enabled, today])
}

/** اعلام یادآوری‌ها هنگام باز شدن/بازگشت به برنامه (فقط یک بار در ریشهٔ برنامه استفاده شود) */
export function useDueReminders() {
  const { settings } = useStore()
  const due = useDueList()
  const today = todayIso()

  useEffect(() => {
    const run = () => {
      if (document.visibilityState !== 'visible') return
      setAppBadge(due.length)
      if (settings.reminders.systemNotifications) showDueNotifications(due, today)
    }
    run()
    document.addEventListener('visibilitychange', run)
    return () => document.removeEventListener('visibilitychange', run)
  }, [due, settings.reminders.systemNotifications, today])

  return due
}
