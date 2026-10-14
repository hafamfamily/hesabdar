import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { toFaDigits } from '../lib/digits'
import {
  formatJMonth, fromJ, type IsoDate, monthLength, shiftJMonth, toJ, todayIso, WEEKDAYS_SHORT, weekdayIndex,
} from '../lib/jalali'
import { cx } from './ui'

/** تقویم شمسی سبک (هفته از شنبه شروع می‌شود) */
export function JalaliCalendar({
  value,
  onChange,
  max,
}: {
  value: IsoDate
  onChange: (iso: IsoDate) => void
  max?: IsoDate
}) {
  const v = toJ(value)
  const [view, setView] = useState({ jy: v.jy, jm: v.jm })
  const today = todayIso()
  const first = fromJ(view.jy, view.jm, 1)
  const lead = weekdayIndex(first)
  const len = monthLength(view.jy, view.jm)
  const cells: (number | null)[] = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, i) => i + 1)]

  const go = (d: number) => setView(shiftJMonth(view.jy, view.jm, d))

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => go(-1)} aria-label="ماه قبل" className="grid size-9 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5">
          <ChevronRight size={18} />
        </button>
        <span className="text-[15px] font-bold">{formatJMonth(view.jy, view.jm)}</span>
        <button type="button" onClick={() => go(1)} aria-label="ماه بعد" className="grid size-9 place-items-center rounded-full hover:bg-slate-100 dark:hover:bg-white/5">
          <ChevronLeft size={18} />
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAYS_SHORT.map((w, i) => (
          <span key={w} className={cx('py-1 text-[12px] font-medium text-slate-400', i === 6 && 'text-expense/80')}>
            {w}
          </span>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <span key={`e${i}`} />
          const iso = fromJ(view.jy, view.jm, d)
          const selected = iso === value
          const isToday = iso === today
          const disabled = !!max && iso > max
          return (
            <button
              key={iso}
              type="button"
              disabled={disabled}
              onClick={() => onChange(iso)}
              className={cx(
                'mx-auto grid size-10 place-items-center rounded-full text-[15px] tabular-nums transition',
                selected
                  ? 'bg-brand font-bold text-white'
                  : isToday
                    ? 'font-bold text-brand ring-1 ring-brand/40 dark:text-brand-light'
                    : 'hover:bg-slate-100 dark:hover:bg-white/5',
                disabled && 'opacity-30',
              )}
            >
              {toFaDigits(d)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
