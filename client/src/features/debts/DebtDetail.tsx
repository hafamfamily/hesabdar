import { Bell, BellOff, CalendarPlus, Check, Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useUI } from '../../app/ui-context'
import { Sheet } from '../../components/Sheet'
import { Badge, Button, cx } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Debt, Installment } from '../../data/types'
import { buildIcs, debtStatus, describeDays } from '../../lib/debts'
import { toFaDigits } from '../../lib/digits'
import { diffDays, formatJLong, formatJNumeric, todayIso } from '../../lib/jalali'
import { formatNumber } from '../../lib/money'
import { downloadFile } from '../../lib/reminders'
import { Toggle } from './DebtForm'

export function DebtDetail({ debtId, onClose, onEdit }: { debtId: string; onClose: () => void; onEdit: () => void }) {
  const store = useStore()
  const ui = useUI()
  const debt = store.debts.find((d) => d.id === debtId)
  const [paying, setPaying] = useState<Installment | null>(null)
  const [showPaid, setShowPaid] = useState(false)
  if (!debt) return null
  const today = todayIso()
  const st = debtStatus(debt, today)
  const borrowed = debt.direction === 'borrowed'
  const progress = st.total ? st.paidAmount / st.total : 0

  const remove = async () => {
    const ok = await ui.confirm({
      title: 'حذف این مورد',
      message: 'برنامهٔ اقساط حذف می‌شود. تراکنش‌هایی که قبلاً برای پرداخت‌ها ثبت شده‌اند باقی می‌مانند.',
      confirmLabel: 'حذف',
      danger: true,
    })
    if (!ok) return
    await store.deleteDebt(debt.id)
    ui.toast('حذف شد')
    onClose()
  }

  const unpay = async (ins: Installment) => {
    const ok = await ui.confirm({
      title: 'لغو پرداخت قسط',
      message: ins.transactionId ? 'تراکنش ثبت‌شده برای این قسط هم حذف می‌شود.' : undefined,
      confirmLabel: 'لغو پرداخت',
    })
    if (!ok) return
    await store.markInstallmentUnpaid(debt.id, ins.id)
    ui.toast('پرداخت لغو شد')
  }

  const exportIcs = () => {
    const ics = buildIcs([debt], formatNumber)
    if (!ics.includes('BEGIN:VEVENT')) return ui.toast('قسط پرداخت‌نشده‌ای وجود ندارد', 'info')
    downloadFile(`aqsat-${debt.counterparty}.ics`, ics, 'text/calendar')
  }

  return (
    <>
      <Sheet
        open={!paying}
        onClose={onClose}
        title={debt.counterparty}
        footer={
          <div className="flex gap-2">
            <Button variant="danger" onClick={remove} aria-label="حذف" className="w-14 px-0">
              <Trash2 size={20} />
            </Button>
            <Button variant="secondary" className="flex-1" onClick={onEdit}>
              <Pencil size={17} /> ویرایش
            </Button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2">
          <Badge tone={borrowed ? 'amber' : 'brand'}>{borrowed ? 'بدهی من' : 'طلب من'}</Badge>
          <Badge>{debt.kind === 'loan' ? 'وام بانکی' : 'قرض شخصی'}</Badge>
          {st.settled && <Badge tone="brand">تسویه‌شده ✓</Badge>}
        </div>

        <div className="rounded-3xl bg-white p-4 shadow-card dark:bg-night-card dark:shadow-none">
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <Info label={borrowed ? 'مانده بدهی' : 'مانده طلب'} value={`${formatNumber(st.remainingAmount)} تومان`} strong />
            <Info label="جمع کل" value={`${formatNumber(st.total)} تومان`} />
            <Info label="اقساط پرداخت‌شده" value={`${toFaDigits(st.paidCount)} از ${toFaDigits(st.count)}`} />
            <Info label="اقساط باقی‌مانده" value={toFaDigits(st.count - st.paidCount)} />
            {debt.principal ? <Info label="مبلغ اصل" value={`${formatNumber(debt.principal)} تومان`} /> : null}
            {st.next && <Info label="قسط بعدی" value={formatJLong(st.next.dueDate)} />}
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/5">
            <span className="block h-full rounded-full bg-brand transition-all" style={{ width: `${progress * 100}%` }} />
          </div>
          {debt.note && <p className="mt-3 text-[13px] text-slate-500">{debt.note}</p>}
        </div>

        <div className="mt-4 flex items-center justify-between rounded-3xl bg-white p-4 shadow-card dark:bg-night-card dark:shadow-none">
          <span className="flex items-center gap-2 text-[14px] font-semibold">
            {debt.reminder.enabled ? <Bell size={18} className="text-amber-500" /> : <BellOff size={18} className="text-slate-400" />}
            یادآوری {debt.reminder.enabled ? (debt.reminder.daysBefore === 0 ? 'همان روز' : `${toFaDigits(debt.reminder.daysBefore)} روز قبل`) : 'خاموش'}
          </span>
          <Toggle
            label="یادآوری"
            checked={debt.reminder.enabled}
            onChange={(v) => store.updateDebt(debt.id, { reminder: { ...debt.reminder, enabled: v } })}
          />
        </div>
        <button type="button" onClick={exportIcs} className="mt-2 flex w-full items-center justify-center gap-2 py-2 text-[13px] font-semibold text-brand dark:text-brand-light">
          <CalendarPlus size={16} /> افزودن سررسیدها به تقویم آیفون
        </button>

        <div className="mt-3 mb-2 flex items-center justify-between">
          <h3 className="text-[14px] font-bold">برنامهٔ اقساط</h3>
          {st.paidCount > 2 && (
            <button type="button" onClick={() => setShowPaid((v) => !v)} className="text-[12px] font-semibold text-brand dark:text-brand-light">
              {showPaid ? 'پنهان کردن پرداخت‌شده‌ها' : `نمایش ${toFaDigits(st.paidCount)} قسط پرداخت‌شده`}
            </button>
          )}
        </div>
        <ol className="divide-y divide-slate-100 rounded-3xl bg-white px-3 shadow-card dark:divide-night-line dark:bg-night-card dark:shadow-none">
          {[...debt.installments]
            .sort((a, b) => a.index - b.index)
            .filter((ins) => showPaid || st.paidCount <= 2 || !ins.paidDate)
            .map((ins) => {
              const days = diffDays(today, ins.dueDate)
              const overdue = !ins.paidDate && days < 0
              const soon = !ins.paidDate && days >= 0 && days <= 7
              return (
                <li key={ins.id} className="flex items-center gap-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => (ins.paidDate ? unpay(ins) : setPaying(ins))}
                    aria-label={ins.paidDate ? `لغو پرداخت قسط ${ins.index}` : `ثبت پرداخت قسط ${ins.index}`}
                    className={cx(
                      'grid size-8 shrink-0 place-items-center rounded-full ring-2 transition',
                      ins.paidDate ? 'bg-brand text-white ring-brand' : overdue ? 'ring-expense' : 'ring-slate-300 dark:ring-slate-600',
                    )}
                  >
                    {ins.paidDate ? <Check size={16} strokeWidth={3} /> : <span className="text-[12px] tabular-nums text-slate-400">{toFaDigits(ins.index)}</span>}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cx('text-[14px] font-semibold tabular-nums', ins.paidDate && 'text-slate-400 line-through decoration-slate-300')}>
                      {formatNumber(ins.amount)} <span className="text-[11px] font-normal">تومان</span>
                    </p>
                    <p className="text-[12px] text-slate-400">
                      سررسید {formatJNumeric(ins.dueDate)}
                      {ins.paidDate && ` · پرداخت ${formatJNumeric(ins.paidDate)}`}
                    </p>
                  </div>
                  {overdue && <span className="text-[11px] font-semibold text-red-500 dark:text-expense">{describeDays(days)}</span>}
                  {soon && <span className="text-[11px] font-semibold text-amber-600">{describeDays(days)}</span>}
                </li>
              )
            })}
        </ol>
      </Sheet>

      {paying && <PaySheet debt={debt} ins={paying} onClose={() => setPaying(null)} />}
    </>
  )
}

function Info({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <p className={cx('tabular-nums', strong ? 'text-[16px] font-extrabold text-brand dark:text-brand-light' : 'font-semibold')}>{value}</p>
    </div>
  )
}

function PaySheet({ debt, ins, onClose }: { debt: Debt; ins: Installment; onClose: () => void }) {
  const store = useStore()
  const ui = useUI()
  const today = todayIso()
  const [date, setDate] = useState(today)
  const [createTx, setCreateTx] = useState(true)
  const borrowed = debt.direction === 'borrowed'
  const type = borrowed ? 'expense' : 'income'
  const cats = store.categories.filter((c) => c.type === type && !c.archived)
  const preferred = borrowed ? 'exp-debt' : 'inc-debt'
  const [categoryId, setCategoryId] = useState(cats.some((c) => c.id === preferred) ? preferred : (cats[0]?.id ?? ''))

  const save = async () => {
    await store.markInstallmentPaid(debt.id, ins.id, { date, createTx, categoryId })
    ui.toast(borrowed ? 'پرداخت قسط ثبت شد' : 'دریافت قسط ثبت شد')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`${borrowed ? 'پرداخت' : 'دریافت'} قسط ${toFaDigits(ins.index)}`}
      footer={
        <Button className="w-full" onClick={save}>
          <Check size={18} /> تأیید {borrowed ? 'پرداخت' : 'دریافت'}
        </Button>
      }
    >
      <p className="mb-4 text-center text-[28px] font-extrabold tabular-nums">
        {formatNumber(ins.amount)} <span className="text-[14px] font-medium text-slate-400">تومان</span>
      </p>
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[
          { v: today, l: 'امروز' },
          { v: ins.dueDate, l: `سررسید (${formatJNumeric(ins.dueDate)})` },
        ].map((o) => (
          <button
            key={o.l}
            type="button"
            onClick={() => setDate(o.v)}
            className={cx('h-11 rounded-2xl text-[13px] font-semibold', date === o.v ? 'bg-brand text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-night-card dark:ring-white/5')}
          >
            {o.l}
          </button>
        ))}
      </div>
      <div className="rounded-3xl bg-white p-4 shadow-card dark:bg-night-card dark:shadow-none">
        <label className="flex items-center justify-between gap-3">
          <span>
            <span className="block font-semibold">ثبت در {borrowed ? 'هزینه‌ها' : 'درآمدها'}</span>
            <span className="text-[12px] text-slate-400">مانده حساب هم به‌روز می‌شود</span>
          </span>
          <Toggle checked={createTx} onChange={setCreateTx} />
        </label>
        {createTx && (
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="mt-3 h-11 w-full rounded-xl bg-slate-100 px-3 outline-none dark:bg-white/5"
          >
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </Sheet>
  )
}
