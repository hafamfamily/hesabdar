import { useState } from 'react'
import type { SeriesPoint } from '../lib/finance'
import { formatNumber } from '../lib/money'
import { toFaDigits } from '../lib/digits'
import { cx } from './ui'

/**
 * نمودار میله‌ای درآمد/هزینه با HTML و CSS (بدون کتابخانه).
 * جهت زمان راست‌به‌چپ است: قدیمی‌ترین در راست.
 */
export function IncomeExpenseBars({
  data,
  height = 140,
  labelEvery = 1,
}: {
  data: SeriesPoint[]
  height?: number
  labelEvery?: number
}) {
  const [active, setActive] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => Math.max(d.income, d.expense)))
  const sel = active !== null ? data[active] : null
  const dense = data.length > 14

  return (
    <div>
      <div className="mb-2 flex min-h-10 items-center justify-between text-[12px]">
        {sel ? (
          <>
            <span className="font-semibold text-slate-600 dark:text-slate-300">{sel.label}</span>
            <span className="flex gap-3">
              <bdi className="text-emerald-600 dark:text-income">+{formatNumber(sel.income)}</bdi>
              <bdi className="text-red-500 dark:text-expense">−{formatNumber(sel.expense)}</bdi>
            </span>
          </>
        ) : (
          <span className="flex gap-4 text-slate-400">
            <Legend color="bg-income" label="درآمد" />
            <Legend color="bg-expense" label="هزینه" />
            <span className="text-slate-300 dark:text-slate-600">برای جزئیات روی ستون بزنید</span>
          </span>
        )}
      </div>
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {data.map((d, i) => (
          <button
            key={d.key}
            type="button"
            onClick={() => setActive(active === i ? null : i)}
            aria-label={`${d.label}: درآمد ${formatNumber(d.income)}، هزینه ${formatNumber(d.expense)}`}
            className={cx(
              'flex h-full flex-1 items-end justify-center gap-[2px] rounded-lg transition',
              active === i ? 'bg-slate-100 dark:bg-white/5' : '',
              active !== null && active !== i && 'opacity-50',
            )}
          >
            <Bar value={d.income} max={max} className="bg-income" thin={dense} />
            <Bar value={d.expense} max={max} className="bg-expense" thin={dense} />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[3px]">
        {data.map((d, i) => (
          <span key={d.key} className="flex flex-1 justify-center overflow-visible whitespace-nowrap text-[10px] text-slate-400">
            {i % labelEvery === 0 ? d.label : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function Bar({ value, max, className, thin }: { value: number; max: number; className: string; thin: boolean }) {
  const h = value > 0 ? Math.max(3, (value / max) * 100) : 0
  return (
    <span
      className={cx('block rounded-t-[4px] transition-[height] duration-500', className, thin ? 'w-[3px]' : 'w-full max-w-3')}
      style={{ height: `${h}%` }}
    />
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cx('size-2 rounded-full', color)} />
      {label}
    </span>
  )
}

/** نمودار حلقه‌ای سهم دسته‌بندی‌ها */
export function Donut({
  parts,
  size = 148,
  centerLabel,
  centerValue,
}: {
  parts: { color: string; value: number }[]
  size?: number
  centerLabel: string
  centerValue: string
}) {
  const r = 52
  const c = 2 * Math.PI * r
  const total = parts.reduce((s, p) => s + p.value, 0)
  const gap = parts.length > 1 ? 2.5 : 0
  let offset = 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" className="-rotate-90" width={size} height={size}>
        <circle cx="60" cy="60" r={r} fill="none" strokeWidth="14" className="stroke-slate-100 dark:stroke-white/5" />
        {total > 0 &&
          parts.map((p, i) => {
            const len = (p.value / total) * c
            const seg = (
              <circle
                key={i}
                cx="60"
                cy="60"
                r={r}
                fill="none"
                stroke={p.color}
                strokeWidth="14"
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            )
            offset += len
            return seg
          })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-[11px] text-slate-400">{centerLabel}</span>
        <span className="text-[14px] font-extrabold">{centerValue}</span>
      </div>
    </div>
  )
}

export function percent(share: number): string {
  const v = share * 100
  return `${toFaDigits(v >= 10 || v === 0 ? Math.round(v) : v.toFixed(1)).replace('.', '٫')}٪`
}
