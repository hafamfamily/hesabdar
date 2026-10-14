import { AlertTriangle, ArrowDownLeft, ArrowUpRight, HandCoins, Landmark, Plus, User } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { PageHeader } from '../../app/AppShell'
import { Card, EmptyState, Segmented, cx } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Debt, DebtDirection } from '../../data/types'
import { debtStatus, describeDays, upcomingInstallments } from '../../lib/debts'
import { toFaDigits } from '../../lib/digits'
import { formatJDayMonth, todayIso } from '../../lib/jalali'
import { formatNumber } from '../../lib/money'
import { DebtDetail } from './DebtDetail'
import { DebtForm } from './DebtForm'

type Filter = 'all' | DebtDirection

export function DebtsPage() {
  const { debts } = useStore()
  const today = todayIso()
  const [filter, setFilter] = useState<Filter>('all')
  const [showSettled, setShowSettled] = useState(false)
  const [form, setForm] = useState<{ debt?: Debt } | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)

  const rows = useMemo(
    () =>
      debts
        .map((d) => ({ debt: d, st: debtStatus(d, today) }))
        .sort((a, b) => Number(a.st.settled) - Number(b.st.settled) || (a.st.next?.dueDate ?? '9').localeCompare(b.st.next?.dueDate ?? '9')),
    [debts, today],
  )
  const sumRemaining = (dir: DebtDirection) => rows.filter((r) => r.debt.direction === dir).reduce((s, r) => s + r.st.remainingAmount, 0)
  const visible = rows.filter((r) => (filter === 'all' || r.debt.direction === filter) && (showSettled || !r.st.settled))
  const settledCount = rows.filter((r) => r.st.settled).length
  const next30 = upcomingInstallments(debts, today, 30)
  const overdue = next30.filter((i) => i.days < 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="اقساط و بدهی‌ها"
        subtitle={`${toFaDigits(rows.filter((r) => !r.st.settled).length)} مورد فعال`}
        action={
          <button type="button" onClick={() => setForm({})} aria-label="افزودن" className="grid size-11 place-items-center rounded-2xl bg-brand text-white shadow-float active:scale-95">
            <Plus size={22} strokeWidth={2.6} />
          </button>
        }
      />

      <div className="grid grid-cols-2 gap-3">
        <SummaryCard tone="expense" icon={<ArrowUpRight size={16} />} label="بدهی‌های من" value={sumRemaining('borrowed')} />
        <SummaryCard tone="income" icon={<ArrowDownLeft size={16} />} label="طلب‌های من" value={sumRemaining('lent')} />
      </div>

      {next30.length > 0 && (
        <Card className={cx('!p-3', overdue.length > 0 && 'ring-2 ring-expense/40')}>
          <p className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-bold">
            <AlertTriangle size={16} className={overdue.length ? 'text-expense' : 'text-amber-500'} />
            {overdue.length ? `${toFaDigits(overdue.length)} قسط سررسیدگذشته` : 'سررسیدهای ۳۰ روز آینده'}
          </p>
          <ul className="space-y-1">
            {next30.slice(0, 4).map((i) => (
              <li key={i.installment.id}>
                <button type="button" onClick={() => setDetailId(i.debt.id)} className="flex w-full items-center gap-2 rounded-xl px-1 py-1.5 text-start text-[13px] active:bg-slate-100 dark:active:bg-white/5">
                  <span className={cx('size-2 shrink-0 rounded-full', i.debt.direction === 'borrowed' ? 'bg-expense' : 'bg-income')} />
                  <span className="flex-1 truncate">
                    {i.debt.direction === 'borrowed' ? 'پرداخت به' : 'دریافت از'} {i.debt.counterparty}
                  </span>
                  <span className="font-semibold">{formatNumber(i.installment.amount)}</span>
                  <span className={cx('w-20 text-left text-[11px] font-semibold', i.days < 0 ? 'text-red-500 dark:text-expense' : 'text-amber-600')}>{describeDays(i.days)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Segmented
        size="sm"
        value={filter}
        onChange={setFilter}
        options={[
          { value: 'all', label: 'همه' },
          { value: 'borrowed', label: 'بدهی‌ها' },
          { value: 'lent', label: 'طلب‌ها' },
        ]}
      />

      {visible.length === 0 ? (
        <Card>
          <EmptyState icon={<HandCoins size={24} />} title="موردی ثبت نشده" hint="قرض‌هایی که داده یا گرفته‌اید و وام‌های بانکی را با دکمهٔ + اضافه کنید." />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map(({ debt, st }) => {
            const borrowed = debt.direction === 'borrowed'
            const Icon = debt.kind === 'loan' ? Landmark : User
            return (
              <button
                key={debt.id}
                type="button"
                onClick={() => setDetailId(debt.id)}
                className={cx(
                  'block w-full animate-rise rounded-3xl bg-white p-4 text-start shadow-card ring-1 ring-slate-900/[0.03] transition active:scale-[0.99] dark:bg-night-card dark:shadow-none dark:ring-white/[0.06]',
                  st.settled && 'opacity-60',
                )}
              >
                <div className="flex items-center gap-3">
                  <span className={cx('grid size-11 shrink-0 place-items-center rounded-2xl', borrowed ? 'bg-expense/10 text-red-500 dark:text-expense' : 'bg-income/10 text-emerald-600 dark:text-income')}>
                    <Icon size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-bold">{debt.counterparty}</p>
                    <p className="text-[12px] text-slate-400">
                      {borrowed ? 'بدهی من' : 'طلب من'} · {debt.kind === 'loan' ? 'وام' : 'شخصی'}
                      {st.count > 1 && ` · ${toFaDigits(st.paidCount)}/${toFaDigits(st.count)} قسط`}
                    </p>
                  </div>
                  <div className="text-left">
                    <p className={cx('text-[15px] font-extrabold', borrowed ? 'text-red-500 dark:text-expense' : 'text-emerald-600 dark:text-income')}>
                      {formatNumber(st.remainingAmount)}
                    </p>
                    <p className="text-[11px] text-slate-400">مانده (تومان)</p>
                  </div>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
                  <span className={cx('block h-full rounded-full', borrowed ? 'bg-expense' : 'bg-income')} style={{ width: `${st.total ? (st.paidAmount / st.total) * 100 : 0}%` }} />
                </div>
                {st.next ? (
                  <p className="mt-2 flex justify-between text-[12px]">
                    <span className="text-slate-500 dark:text-slate-400">
                      {st.next.dueDate ? `قسط بعد: ${formatJDayMonth(st.next.dueDate)}` : 'بدون سررسید'} · {formatNumber(st.next.amount)} تومان
                    </span>
                    {st.daysToNext !== undefined && (
                      <span className={cx('font-semibold', st.daysToNext < 0 ? 'text-red-500 dark:text-expense' : st.daysToNext <= 7 ? 'text-amber-600' : 'text-slate-400')}>
                        {describeDays(st.daysToNext)}
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="mt-2 text-[12px] font-semibold text-brand dark:text-brand-light">تسویه شد ✓</p>
                )}
              </button>
            )
          })}
        </div>
      )}

      {settledCount > 0 && (
        <button type="button" onClick={() => setShowSettled((s) => !s)} className="w-full py-2 text-[13px] font-semibold text-slate-400">
          {showSettled ? 'پنهان کردن تسویه‌شده‌ها' : `نمایش ${toFaDigits(settledCount)} مورد تسویه‌شده`}
        </button>
      )}

      {detailId && !form && (
        <DebtDetail
          debtId={detailId}
          onClose={() => setDetailId(null)}
          onEdit={() => setForm({ debt: debts.find((d) => d.id === detailId) })}
        />
      )}
      {form && <DebtForm debt={form.debt} onClose={() => setForm(null)} />}
    </div>
  )
}

function SummaryCard({ tone, icon, label, value }: { tone: 'income' | 'expense'; icon: ReactNode; label: string; value: number }) {
  return (
    <div className={cx('rounded-3xl p-4', tone === 'income' ? 'bg-income-soft/60 text-emerald-700 dark:bg-income/10 dark:text-income' : 'bg-expense-soft/70 text-red-600 dark:bg-expense/10 dark:text-expense')}>
      <p className="flex items-center gap-1 text-[12px] opacity-80">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-[18px] font-extrabold">{formatNumber(value)}</p>
      <p className="text-[11px] opacity-70">تومان مانده</p>
    </div>
  )
}
