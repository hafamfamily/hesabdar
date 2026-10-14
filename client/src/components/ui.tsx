import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { formatNumber } from '../lib/money'
import type { TxType } from '../data/types'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        'rounded-3xl bg-white p-4 shadow-card ring-1 ring-slate-900/[0.03] dark:bg-night-card dark:shadow-none dark:ring-white/[0.06]',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-title text-[17px] text-ink dark:text-slate-100">{title}</h2>
      {action}
    </div>
  )
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

export function Button({
  variant = 'primary',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const styles: Record<Variant, string> = {
    primary: 'bg-brand text-white shadow-float hover:bg-teal-800 active:bg-teal-900 disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700',
    secondary: 'bg-slate-100 text-ink hover:bg-slate-200 dark:bg-white/[0.07] dark:text-slate-100 dark:hover:bg-white/10',
    ghost: 'text-brand hover:bg-brand/5 dark:text-brand-light dark:hover:bg-white/5',
    danger: 'bg-expense/10 text-red-600 hover:bg-expense/20 dark:text-expense',
  }
  return (
    <button
      className={cx(
        'inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-[15px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed',
        styles[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export interface SegOption<T extends string> {
  value: T
  label: string
  tone?: 'income' | 'expense'
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: {
  options: SegOption<T>[]
  value: T
  onChange: (v: T) => void
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cx('flex rounded-2xl bg-slate-100 p-1 dark:bg-white/[0.06]', className)}
    >
      {options.map((o) => {
        const active = o.value === value
        const activeTone =
          o.tone === 'income'
            ? 'bg-income text-white'
            : o.tone === 'expense'
              ? 'bg-expense text-white'
              : 'bg-white text-ink shadow-sm dark:bg-slate-700 dark:text-white'
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 rounded-xl font-semibold transition-all',
              size === 'sm' ? 'h-8 text-[13px]' : 'h-10 text-[14px]',
              active ? activeTone : 'text-slate-500 dark:text-slate-400',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** نمایش مبلغ با رنگ و علامت بر اساس نوع تراکنش */
export function Amount({
  value,
  type,
  className,
  unit = true,
  signed = true,
}: {
  value: number
  type?: TxType
  className?: string
  unit?: boolean
  signed?: boolean
}) {
  const sign = signed && type ? (type === 'income' ? '+' : '−') : ''
  const color = type === 'income' ? 'text-emerald-600 dark:text-income' : type === 'expense' ? 'text-red-500 dark:text-expense' : ''
  return (
    <span className={cx(color, className)}>
      <bdi>
        {sign}
        {formatNumber(value)}
      </bdi>
      {unit && <span className="ms-1 text-[0.75em] font-normal opacity-70">تومان</span>}
    </span>
  )
}

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-2xl bg-slate-100 text-slate-400 dark:bg-white/5">{icon}</div>
      <p className="font-semibold text-slate-600 dark:text-slate-300">{title}</p>
      {hint && <p className="max-w-60 text-sm text-slate-400">{hint}</p>}
    </div>
  )
}

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: 'slate' | 'amber' | 'brand' }) {
  const t = {
    slate: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-400/10 dark:text-amber-300',
    brand: 'bg-brand-soft text-brand dark:bg-brand/20 dark:text-brand-light',
  }[tone]
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium', t)}>{children}</span>
}
