import { ArrowDownLeft, ArrowUpRight, BellRing, ChevronLeft, Eye, EyeOff, Plus, Receipt, Wallet } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { PageHeader } from '../../app/AppShell'
import type { Route } from '../../app/router'
import { useUI } from '../../app/ui-context'
import { useDueList } from '../../app/useReminders'
import { describeDays } from '../../lib/debts'
import { IncomeExpenseBars } from '../../components/charts'
import { SyncBadge } from '../../components/SyncBadge'
import { Card, EmptyState, SectionHeader, cx } from '../../components/ui'
import { useCategoryMap, useStore } from '../../data/store'
import { currentBalance, currentJMonth, dailySeries, filterRange, sortByDateDesc, totals } from '../../lib/finance'
import { formatJMonth, toJ, todayIso, WEEKDAYS, weekdayIndex, formatJLong } from '../../lib/jalali'
import { toFaDigits } from '../../lib/digits'
import { formatNumber } from '../../lib/money'
import { TransactionRow } from '../transactions/TransactionRow'

export function Dashboard({ onNavigate }: { onNavigate: (r: Route) => void }) {
  const { transactions, settings } = useStore()
  const catMap = useCategoryMap()
  const ui = useUI()
  const [hidden, setHidden] = useState(false)
  const due = useDueList()
  const today = todayIso()

  const all = useMemo(() => totals(transactions), [transactions])
  const balance = currentBalance(settings.openingBalance, transactions)
  const month = currentJMonth(today)
  const monthTx = useMemo(() => filterRange(transactions, month.range), [transactions, month.range])
  const monthTotals = totals(monthTx)
  const series = useMemo(() => dailySeries(monthTx, month.range, (iso) => toFaDigits(toJ(iso).jd)), [monthTx, month.range])
  const recent = useMemo(() => sortByDateDesc(transactions).slice(0, 5), [transactions])

  const mask = (v: number) => (hidden ? '•••••••' : formatNumber(v))

  return (
    <div className="space-y-4">
      <PageHeader
        title="دخل‌وخرج من"
        subtitle={`${WEEKDAYS[weekdayIndex(today)]}، ${formatJLong(today)}`}
        action={<SyncBadge />}
      />

      {/* کارت موجودی */}
      <section className="relative animate-rise overflow-hidden rounded-[28px] bg-gradient-to-br from-brand via-teal-800 to-ink p-5 text-white shadow-float">
        <div className="pointer-events-none absolute -top-16 -left-10 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 right-10 size-40 rounded-full bg-emerald-300/20 blur-2xl" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] text-teal-100">
              <Wallet size={16} /> مانده فعلی
            </span>
            <button
              type="button"
              onClick={() => setHidden((h) => !h)}
              aria-label={hidden ? 'نمایش مبالغ' : 'پنهان کردن مبالغ'}
              className="grid size-9 place-items-center rounded-full bg-white/10 text-teal-50"
            >
              {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
          <p className="mt-1 text-[34px] font-extrabold tracking-tight tabular-nums">
            <bdi>{mask(balance)}</bdi>
            <span className="ms-1.5 text-[15px] font-medium text-teal-100">تومان</span>
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-3 text-center backdrop-blur-sm">
            <Mini label="موجودی اولیه" value={mask(settings.openingBalance)} />
            <Mini label="کل درآمد" value={mask(all.income)} tone="text-emerald-200" />
            <Mini label="کل هزینه" value={mask(all.expense)} tone="text-rose-200" />
          </div>
        </div>
      </section>

      {/* ثبت سریع */}
      <button
        type="button"
        onClick={() => ui.openTxForm()}
        className="flex h-14 w-full animate-rise items-center justify-center gap-2 rounded-2xl bg-white text-[16px] font-bold text-brand shadow-card ring-1 ring-brand/15 transition active:scale-[0.98] dark:bg-night-card dark:text-brand-light dark:ring-brand-light/20"
      >
        <span className="grid size-7 place-items-center rounded-full bg-brand text-white">
          <Plus size={18} strokeWidth={3} />
        </span>
        ثبت تراکنش
      </button>

      {/* یادآوری اقساط */}
      {due.length > 0 && (
        <button
          type="button"
          onClick={() => onNavigate('debts')}
          className="block w-full animate-rise rounded-3xl bg-amber-50 p-4 text-start ring-1 ring-amber-200 dark:bg-amber-400/10 dark:ring-amber-400/20"
        >
          <p className="mb-2 flex items-center gap-2 text-[14px] font-bold text-amber-800 dark:text-amber-200">
            <BellRing size={17} /> یادآوری اقساط
            <ChevronLeft size={16} className="ms-auto" />
          </p>
          <ul className="space-y-1.5">
            {due.slice(0, 3).map((i) => (
              <li key={i.installment.id} className="flex items-center gap-2 text-[13px] text-amber-900 dark:text-amber-100">
                <span className="flex-1 truncate">
                  {i.debt.direction === 'borrowed' ? 'پرداخت قسط' : 'دریافت از'} {i.debt.counterparty}
                </span>
                <span className="font-semibold tabular-nums">{formatNumber(i.installment.amount)}</span>
                <span className={cx('w-20 text-left text-[11px] font-bold', i.days < 0 ? 'text-red-600 dark:text-expense' : '')}>{describeDays(i.days)}</span>
              </li>
            ))}
          </ul>
        </button>
      )}

      {/* خلاصه ماه جاری */}
      <Card className="animate-rise">
        <SectionHeader
          title={`خلاصهٔ ${formatJMonth(month.jy, month.jm)}`}
          action={
            <button type="button" onClick={() => onNavigate('reports')} className="flex items-center text-[13px] font-semibold text-brand dark:text-brand-light">
              گزارش کامل <ChevronLeft size={16} />
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-2">
          <Stat icon={<ArrowDownLeft size={15} />} label="درآمد ماه" value={mask(monthTotals.income)} tone="income" />
          <Stat icon={<ArrowUpRight size={15} />} label="هزینه ماه" value={mask(monthTotals.expense)} tone="expense" />
          <div className="col-span-2">
            <Stat
              label="مانده خالص ماه"
              value={hidden ? '•••••' : formatNumber(monthTotals.net)}
              tone={monthTotals.net >= 0 ? 'brand' : 'expense'}
              inline
            />
          </div>
        </div>
        <div className="mt-4">
          <IncomeExpenseBars data={series} height={110} labelEvery={5} />
        </div>
      </Card>

      {/* تراکنش‌های اخیر */}
      <Card className="animate-rise">
        <SectionHeader
          title="تراکنش‌های اخیر"
          action={
            <button type="button" onClick={() => onNavigate('transactions')} className="flex items-center text-[13px] font-semibold text-brand dark:text-brand-light">
              همه <ChevronLeft size={16} />
            </button>
          }
        />
        {recent.length === 0 ? (
          <EmptyState icon={<Receipt size={24} />} title="هنوز تراکنشی ثبت نشده" hint="با دکمهٔ «ثبت تراکنش» اولین مورد را اضافه کنید." />
        ) : (
          <div className="-mx-1 divide-y divide-slate-100 dark:divide-night-line">
            {recent.map((t) => (
              <TransactionRow key={t.id} tx={t} category={catMap.get(t.categoryId)} onClick={() => ui.openTxForm(t)} />
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] text-teal-100/80">{label}</p>
      <p className={cx('mt-0.5 truncate text-[13px] font-bold tabular-nums', tone)}>{value}</p>
    </div>
  )
}

function Stat({ icon, label, value, tone, inline }: { icon?: ReactNode; label: string; value: string; tone: 'income' | 'expense' | 'brand'; inline?: boolean }) {
  const t = {
    income: 'bg-income-soft/60 text-emerald-700 dark:bg-income/10 dark:text-income',
    expense: 'bg-expense-soft/70 text-red-600 dark:bg-expense/10 dark:text-expense',
    brand: 'bg-brand-soft/60 text-brand dark:bg-brand/15 dark:text-brand-light',
  }[tone]
  return (
    <div className={cx('min-w-0 rounded-2xl p-3', t, inline && 'flex items-center justify-between')}>
      <p className="flex items-center gap-1 text-[12px] opacity-80">
        {icon}
        {label}
      </p>
      <p className={cx('text-[16px] font-extrabold tabular-nums', !inline && 'mt-1')}>
        <bdi>{value}</bdi>
        <span className="ms-1 text-[11px] font-normal opacity-70">تومان</span>
      </p>
    </div>
  )
}

