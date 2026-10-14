import { BarChart3, Home, ListOrdered, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../components/ui'
import type { Route } from './router'

const TABS: { route: Route; label: string; Icon: typeof Home }[] = [
  { route: 'home', label: 'خانه', Icon: Home },
  { route: 'transactions', label: 'تراکنش‌ها', Icon: ListOrdered },
  { route: 'reports', label: 'گزارش‌ها', Icon: BarChart3 },
  { route: 'settings', label: 'تنظیمات', Icon: Settings },
]

export function AppShell({ route, onNavigate, children }: { route: Route; onNavigate: (r: Route) => void; children: ReactNode }) {
  return (
    <div className="mx-auto min-h-dvh max-w-lg">
      <main className="px-4 pt-[max(env(safe-area-inset-top),16px)] pb-[calc(env(safe-area-inset-bottom)+96px)]">{children}</main>

      <nav
        aria-label="ناوبری اصلی"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200/70 bg-white/85 pb-safe backdrop-blur-xl dark:border-night-line dark:bg-night/85"
      >
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {TABS.map(({ route: r, label, Icon }) => {
            const active = r === route
            return (
              <button
                key={r}
                type="button"
                onClick={() => onNavigate(r)}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition',
                  active ? 'text-brand dark:text-brand-light' : 'text-slate-400',
                )}
              >
                <span className={cx('grid h-7 w-12 place-items-center rounded-full transition', active && 'bg-brand/10 dark:bg-brand-light/10')}>
                  <Icon size={21} strokeWidth={active ? 2.4 : 2} />
                </span>
                {label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-4 flex items-center justify-between gap-3 pt-2">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[13px] text-slate-400">{subtitle}</p>}
      </div>
      {action}
    </header>
  )
}
