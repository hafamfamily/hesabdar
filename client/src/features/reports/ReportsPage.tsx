import { CalendarRange, ChevronLeft, ChevronRight, FileSpreadsheet, PieChart } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { PageHeader } from '../../app/AppShell'
import { useUI } from '../../app/ui-context'
import { Donut, IncomeExpenseBars, percent } from '../../components/charts'
import { CategoryIcon } from '../../components/icons'
import { RangePickerSheet } from '../../components/RangePicker'
import { Amount, Card, EmptyState, SectionHeader, Segmented, cx } from '../../components/ui'
import { useStore } from '../../data/store'
import type { TxType } from '../../data/types'
import { byCategory, dailySeries, filterRange, monthlySeries, type SeriesPoint, totals } from '../../lib/finance'
import {
  addDays, type DateRange, diffDays, formatJDayMonth, formatJLong, formatJMonth, JALALI_MONTHS, jMonthRange,
  shiftJMonth, toJ, todayIso, WEEKDAYS_SHORT, weekdayIndex, weekRange,
} from '../../lib/jalali'
import { toFaDigits } from '../../lib/digits'
import { formatCompact, formatNumber } from '../../lib/money'

type Period = 'day' | 'week' | 'month' | 'custom'

export function ReportsPage() {
  const { transactions, categories } = useStore()
  const ui = useUI()
  const today = todayIso()
  const [period, setPeriod] = useState<Period>('month')
  const [anchor, setAnchor] = useState(today) // تاریخ مرجع برای دوره‌های روز/هفته/ماه
  const [custom, setCustom] = useState<DateRange>({ start: addDays(today, -29), end: today })
  const [rangeOpen, setRangeOpen] = useState(false)
  const [catType, setCatType] = useState<TxType>('expense')

  const range: DateRange = useMemo(() => {
    if (period === 'day') return { start: anchor, end: anchor }
    if (period === 'week') return weekRange(anchor)
    if (period === 'month') {
      const { jy, jm } = toJ(anchor)
      return jMonthRange(jy, jm)
    }
    return custom
  }, [period, anchor, custom])

  const label = useMemo(() => {
    if (period === 'day') return formatJLong(anchor)
    if (period === 'week') return `${formatJDayMonth(range.start)} تا ${formatJDayMonth(range.end)}`
    if (period === 'month') {
      const { jy, jm } = toJ(anchor)
      return formatJMonth(jy, jm)
    }
    return `${formatJLong(custom.start)} تا ${formatJLong(custom.end)}`
  }, [period, anchor, range, custom])

  const step = (dir: 1 | -1) => {
    if (period === 'day') setAnchor(addDays(anchor, dir))
    else if (period === 'week') setAnchor(addDays(anchor, dir * 7))
    else if (period === 'month') {
      const { jy, jm } = toJ(anchor)
      const n = shiftJMonth(jy, jm, dir)
      setAnchor(jMonthRange(n.jy, n.jm).start)
    }
  }
  const atLatest = range.end >= today

  const inPeriod = useMemo(() => filterRange(transactions, range), [transactions, range])
  const sum = totals(inPeriod)
  const shares = useMemo(() => byCategory(inPeriod, categories, catType), [inPeriod, categories, catType])
  const catTotal = catType === 'income' ? sum.income : sum.expense

  const chart = useMemo((): { title: string; data: SeriesPoint[]; every: number } => {
    const dayLabel = (iso: string) => toFaDigits(toJ(iso).jd)
    if (period === 'day') {
      const r = { start: addDays(anchor, -6), end: anchor }
      return { title: 'هفت روز منتهی به این روز', data: dailySeries(filterRange(transactions, r), r, (iso) => WEEKDAYS_SHORT[weekdayIndex(iso)]), every: 1 }
    }
    if (period === 'week') return { title: 'روزهای هفته', data: dailySeries(inPeriod, range, (iso) => WEEKDAYS_SHORT[weekdayIndex(iso)]), every: 1 }
    if (period === 'month') {
      const { jy, jm } = toJ(anchor)
      return {
        title: 'مقایسهٔ شش ماه اخیر',
        data: monthlySeries(transactions, jy, jm, 6, (_y, m) => JALALI_MONTHS[m - 1]),
        every: 1,
      }
    }
    const days = diffDays(range.start, range.end) + 1
    if (days <= 31) return { title: 'روزانه', data: dailySeries(inPeriod, range, dayLabel), every: days > 14 ? 5 : 1 }
    const e = toJ(range.end)
    const s = toJ(range.start)
    const months = (e.jy - s.jy) * 12 + (e.jm - s.jm) + 1
    return {
      title: 'ماهانه',
      data: monthlySeries(inPeriod, e.jy, e.jm, Math.min(months, 12), (_y, m) => JALALI_MONTHS[m - 1]),
      every: months > 6 ? 2 : 1,
    }
  }, [period, anchor, range, transactions, inPeriod])

  const savingRate = sum.income > 0 ? sum.net / sum.income : null
  const ratio = sum.income + sum.expense > 0 ? sum.income / (sum.income + sum.expense) : 0.5

  return (
    <div className="space-y-4">
      <PageHeader
        title="گزارش‌ها"
        action={
          <button
            type="button"
            onClick={() => ui.toast('خروجی CSV در مرحلهٔ پنجم فعال می‌شود', 'info')}
            className="flex h-10 items-center gap-1.5 rounded-2xl bg-white px-3 text-[13px] font-semibold text-brand ring-1 ring-slate-200 dark:bg-night-card dark:text-brand-light dark:ring-white/5"
          >
            <FileSpreadsheet size={17} /> خروجی Excel
          </button>
        }
      />

      <Segmented
        value={period}
        onChange={(p) => {
          setPeriod(p)
          if (p === 'custom') setRangeOpen(true)
        }}
        options={[
          { value: 'day', label: 'روزانه' },
          { value: 'week', label: 'هفتگی' },
          { value: 'month', label: 'ماهانه' },
          { value: 'custom', label: 'دلخواه' },
        ]}
      />

      {/* انتخاب دوره */}
      <div className="flex items-center justify-between gap-2">
        {period !== 'custom' ? (
          <>
            <NavBtn onClick={() => step(-1)} label="دورهٔ قبل">
              <ChevronRight size={20} />
            </NavBtn>
            <button type="button" onClick={() => setAnchor(today)} className="text-center">
              <span className="block text-[16px] font-bold">{label}</span>
              {!atLatest && <span className="text-[11px] text-brand dark:text-brand-light">بازگشت به امروز</span>}
            </button>
            <NavBtn onClick={() => step(1)} label="دورهٔ بعد" disabled={atLatest}>
              <ChevronLeft size={20} />
            </NavBtn>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setRangeOpen(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-[14px] font-semibold ring-1 ring-slate-200 dark:bg-night-card dark:ring-white/5"
          >
            <CalendarRange size={18} className="text-brand dark:text-brand-light" />
            {label}
          </button>
        )}
      </div>

      {/* خلاصه و مقایسه */}
      <Card className="animate-rise">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-income-soft/50 p-3 dark:bg-income/10">
            <p className="text-[12px] text-emerald-700 dark:text-income">درآمد</p>
            <Amount value={sum.income} className="mt-1 block text-[18px] font-extrabold text-emerald-700 dark:text-income" />
          </div>
          <div className="rounded-2xl bg-expense-soft/60 p-3 dark:bg-expense/10">
            <p className="text-[12px] text-red-600 dark:text-expense">هزینه</p>
            <Amount value={sum.expense} className="mt-1 block text-[18px] font-extrabold text-red-600 dark:text-expense" />
          </div>
        </div>
        <div className="mt-4">
          <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
            <span className="bg-income transition-all duration-500" style={{ width: `${ratio * 100}%` }} />
            <span className="flex-1 bg-expense" />
          </div>
          <div className="mt-3 flex items-center justify-between text-[13px]">
            <span className="text-slate-500 dark:text-slate-400">
              مانده خالص:{' '}
              <b className={cx(sum.net >= 0 ? 'text-brand dark:text-brand-light' : 'text-red-500 dark:text-expense')}>
                {formatNumber(sum.net)} تومان
              </b>
            </span>
            {savingRate !== null && (
              <span className="text-slate-400">
                پس‌انداز: <b className="text-slate-600 dark:text-slate-300">{percent(Math.max(savingRate, 0))}</b>
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* نمودار میله‌ای */}
      <Card className="animate-rise">
        <SectionHeader title="درآمد و هزینه" action={<span className="text-[12px] text-slate-400">{chart.title}</span>} />
        <IncomeExpenseBars data={chart.data} labelEvery={chart.every} />
        <p className="mt-2 text-[11px] text-slate-400">
          بیشترین مقدار: {formatCompact(Math.max(0, ...chart.data.map((d) => Math.max(d.income, d.expense))))} تومان
        </p>
      </Card>

      {/* سهم دسته‌بندی‌ها */}
      <Card className="animate-rise">
        <SectionHeader
          title="سهم دسته‌بندی‌ها"
          action={
            <Segmented
              size="sm"
              className="w-36"
              value={catType}
              onChange={setCatType}
              options={[
                { value: 'expense', label: 'هزینه' },
                { value: 'income', label: 'درآمد' },
              ]}
            />
          }
        />
        {shares.length === 0 ? (
          <EmptyState icon={<PieChart size={24} />} title="در این دوره موردی ثبت نشده" />
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Donut
                parts={shares.map((s) => ({ color: s.category.color, value: s.amount }))}
                centerLabel={catType === 'expense' ? 'کل هزینه' : 'کل درآمد'}
                centerValue={formatCompact(catTotal)}
              />
              <ul className="min-w-0 flex-1 space-y-1.5">
                {shares.slice(0, 5).map((s) => (
                  <li key={s.category.id} className="flex items-center gap-2 text-[13px]">
                    <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.category.color }} />
                    <span className="truncate">{s.category.name}</span>
                    <span className="ms-auto font-semibold text-slate-500">{percent(s.share)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="mt-4 space-y-3 border-t border-slate-100 pt-4 dark:border-night-line">
              {shares.map((s) => (
                <div key={s.category.id} className="flex items-center gap-3">
                  <CategoryIcon icon={s.category.icon} color={s.category.color} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2 text-[14px]">
                      <span className="truncate font-semibold">
                        {s.category.name} <span className="text-[11px] font-normal text-slate-400">({toFaDigits(s.count)} مورد)</span>
                      </span>
                      <Amount value={s.amount} className="shrink-0 text-[13px] font-bold" />
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                      <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${s.share * 100}%`, background: s.category.color }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {rangeOpen && (
        <RangePickerSheet
          open
          initial={custom}
          onClose={() => setRangeOpen(false)}
          onApply={(r) => {
            setCustom(r)
            setRangeOpen(false)
          }}
        />
      )}
    </div>
  )
}

function NavBtn({ children, onClick, label, disabled }: { children: ReactNode; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="grid size-11 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 transition disabled:opacity-30 dark:bg-night-card dark:ring-white/5"
    >
      {children}
    </button>
  )
}
