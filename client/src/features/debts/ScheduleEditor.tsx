import { CalendarDays, Check, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { JalaliCalendar } from '../../components/JalaliCalendar'
import { Sheet } from '../../components/Sheet'
import { Button, cx } from '../../components/ui'
import type { ScheduleRow } from '../../data/types'
import { monthlyDueDates, scheduleTotal } from '../../lib/debts'
import { toEnDigits, toFaDigits } from '../../lib/digits'
import { formatJNumeric, todayIso } from '../../lib/jalali'
import { formatNumber } from '../../lib/money'

/**
 * جدول اقساط قابل ویرایش: مبلغ و سررسید هر قسط جداگانه، افزودن و حذف قسط.
 * در حالت ویرایش، اقساط پرداخت‌شده قفل هستند (برای تغییر، ابتدا پرداخت را لغو کنید).
 */
export function ScheduleEditor({
  rows,
  onChange,
  lockPaid,
  principal,
  direction,
}: {
  rows: ScheduleRow[]
  onChange: (rows: ScheduleRow[]) => void
  lockPaid?: boolean
  principal?: number
  direction: 'borrowed' | 'lent'
}) {
  const [dateFor, setDateFor] = useState<number | null>(null)
  const total = scheduleTotal(rows)
  const unpaid = rows.filter((r) => !r.paid)
  const diff = principal ? total - principal : 0

  const patch = (i: number, p: Partial<ScheduleRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...p } : r)))
  const remove = (i: number) => onChange(rows.filter((_, j) => j !== i))
  const add = () => {
    const last = rows.at(-1)
    const due = last?.dueDate ? monthlyDueDates(last.dueDate, 2)[1] : todayIso()
    onChange([...rows, { amount: last?.amount ?? 0, dueDate: due, paid: false }])
  }

  return (
    <div>
      <ol className="divide-y divide-slate-100 rounded-3xl bg-white px-2 shadow-card dark:divide-night-line dark:bg-night-card dark:shadow-none">
        {rows.map((r, i) => {
          const locked = lockPaid && r.paid
          return (
            <li key={r.id ?? `n${i}`} className={cx('flex items-center gap-2 py-2', locked && 'opacity-60')}>
              <button
                type="button"
                disabled={locked}
                onClick={() => patch(i, r.paid ? { paid: false, paidDate: undefined, paidBefore: undefined } : { paid: true, paidBefore: true, paidDate: r.dueDate })}
                aria-label={r.paid ? `قسط ${i + 1} پرداخت‌شده` : `قسط ${i + 1}`}
                title={lockPaid ? undefined : 'علامت «از قبل پرداخت شده»'}
                className={cx(
                  'grid size-8 shrink-0 place-items-center rounded-full text-[12px] ring-2',
                  r.paid ? 'bg-brand text-white ring-brand' : 'text-slate-400 ring-slate-200 dark:ring-slate-600',
                )}
              >
                {r.paid ? <Check size={15} strokeWidth={3} /> : toFaDigits(i + 1)}
              </button>
              <button
                type="button"
                disabled={locked}
                onClick={() => setDateFor(i)}
                className="flex h-10 w-[112px] shrink-0 items-center justify-center gap-1 rounded-xl bg-slate-100 text-[13px] dark:bg-white/5"
              >
                <CalendarDays size={14} className="text-slate-400" />
                {r.dueDate ? formatJNumeric(r.dueDate) : 'بدون سررسید'}
              </button>
              <input
                dir="ltr"
                inputMode="numeric"
                aria-label={`مبلغ قسط ${i + 1}`}
                disabled={locked}
                value={r.amount ? formatNumber(r.amount) : ''}
                placeholder="مبلغ"
                onChange={(e) => {
                  const d = toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 15)
                  patch(i, { amount: d ? Number(d) : 0 })
                }}
                className={cx(
                  'h-10 min-w-0 flex-1 rounded-xl bg-slate-100 px-2 text-center text-[14px] font-semibold outline-none focus:ring-2 focus:ring-brand dark:bg-white/5',
                  !r.amount && 'ring-1 ring-expense',
                )}
              />
              <button
                type="button"
                disabled={locked || rows.length === 1}
                onClick={() => remove(i)}
                aria-label={`حذف قسط ${i + 1}`}
                className="grid size-9 shrink-0 place-items-center rounded-full text-slate-400 disabled:opacity-30"
              >
                <Trash2 size={16} />
              </button>
            </li>
          )
        })}
      </ol>

      <Button variant="secondary" className="mt-2 h-11 w-full text-[14px]" onClick={add} type="button">
        <Plus size={17} /> افزودن قسط
      </Button>

      <div className="mt-3 space-y-1 rounded-2xl bg-brand/5 p-3 text-[13px] leading-6 text-slate-600 dark:bg-brand-light/10 dark:text-slate-300">
        <p className="flex justify-between">
          <span>{toFaDigits(rows.length)} قسط · جمع کل</span>
          <b className="">{formatNumber(total)} تومان</b>
        </p>
        <p className="flex justify-between">
          <span>{direction === 'borrowed' ? 'باقی‌مانده برای پرداخت' : 'باقی‌مانده برای دریافت'} ({toFaDigits(unpaid.length)} قسط)</span>
          <b className="">{formatNumber(scheduleTotal(unpaid))} تومان</b>
        </p>
        {principal ? (
          <p className="flex justify-between">
            <span>{diff > 0 ? 'مازاد بر اصل (سود/کارمزد)' : diff < 0 ? 'کمتر از مبلغ اصل' : 'برابر با مبلغ اصل'}</span>
            <b className={cx(diff < 0 && 'text-amber-600')}>{diff ? `${formatNumber(Math.abs(diff))} تومان` : '✓'}</b>
          </p>
        ) : null}
        {!lockPaid && <p className="text-[11px] text-slate-400">برای علامت‌زدن قسطی که قبلاً پرداخت شده، روی شمارهٔ آن بزنید.</p>}
      </div>

      {dateFor !== null && (
        <DueDateSheet
          value={rows[dateFor]?.dueDate}
          onClose={() => setDateFor(null)}
          onPick={(iso) => {
            patch(dateFor, { dueDate: iso, paidDate: rows[dateFor].paid ? iso : undefined })
            setDateFor(null)
          }}
        />
      )}
    </div>
  )
}

export function DueDateSheet({ value, onPick, onClose }: { value?: string; onPick: (iso?: string) => void; onClose: () => void }) {
  return (
    <Sheet
      open
      onClose={onClose}
      title="تاریخ سررسید"
      footer={
        <Button variant="secondary" className="w-full" onClick={() => onPick(undefined)}>
          بدون سررسید مشخص
        </Button>
      }
    >
      <div className="rounded-3xl bg-white p-3 shadow-card dark:bg-night-card dark:shadow-none">
        <JalaliCalendar value={value ?? todayIso()} onChange={onPick} />
      </div>
    </Sheet>
  )
}
