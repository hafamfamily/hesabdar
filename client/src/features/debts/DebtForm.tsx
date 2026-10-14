import { Bell, CalendarDays, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { useUI } from '../../app/ui-context'
import { JalaliCalendar } from '../../components/JalaliCalendar'
import { Sheet } from '../../components/Sheet'
import { Button, Segmented, cx } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Debt, DebtDirection, DebtKind } from '../../data/types'
import { monthlyDueDates, validateDebtInput } from '../../lib/debts'
import { toEnDigits, toFaDigits } from '../../lib/digits'
import { formatJLong, todayIso } from '../../lib/jalali'
import { amountInWords, formatAmountInput, formatNumber, parseAmount } from '../../lib/money'

const REMIND_OPTIONS = [0, 1, 3, 7]

/** فرم افزودن/ویرایش قرض، طلب یا وام */
export function DebtForm({ debt, onClose }: { debt?: Debt; onClose: () => void }) {
  const store = useStore()
  const ui = useUI()
  const isEdit = !!debt
  const today = todayIso()

  const [direction, setDirection] = useState<DebtDirection>(debt?.direction ?? 'borrowed')
  const [kind, setKind] = useState<DebtKind>(debt?.kind ?? 'personal')
  const [counterparty, setCounterparty] = useState(debt?.counterparty ?? '')
  const [principalText, setPrincipalText] = useState(debt?.principal ? formatNumber(debt.principal) : '')
  const [mode, setMode] = useState<'single' | 'installments'>('installments')
  const [countText, setCountText] = useState('12')
  const [amountText, setAmountText] = useState('')
  const [firstDue, setFirstDue] = useState(today)
  const [paidText, setPaidText] = useState('0')
  const [showCal, setShowCal] = useState(false)
  const [note, setNote] = useState(debt?.note ?? '')
  const [remindOn, setRemindOn] = useState(debt?.reminder.enabled ?? true)
  const [daysBefore, setDaysBefore] = useState(debt?.reminder.daysBefore ?? 3)
  const [error, setError] = useState<string | null>(null)

  const int = (t: string) => {
    const v = parseInt(toEnDigits(t).replace(/\D/g, ''), 10)
    return Number.isNaN(v) ? 0 : v
  }
  const count = mode === 'single' ? 1 : int(countText)
  const principal = principalText ? parseAmount(principalText) : null
  const amount = parseAmount(amountText)
  const total = amount.ok ? amount.value * count : 0
  const lastDue = count > 0 && count <= 360 ? monthlyDueDates(firstDue, count).at(-1) : undefined

  const save = async () => {
    if (principal && !principal.ok) return setError(`مبلغ اصل: ${principal.error}`)
    const reminder = { enabled: remindOn, daysBefore }
    try {
      if (debt) {
        if (!counterparty.trim()) return setError('نام طرف حساب را وارد کنید')
        await store.updateDebt(debt.id, {
          direction,
          kind,
          counterparty: counterparty.trim(),
          principal: principal?.ok ? principal.value : undefined,
          note: note.trim(),
          reminder,
        })
        ui.toast('تغییرات ذخیره شد')
      } else {
        if (!amount.ok) return setError(`مبلغ ${mode === 'single' ? 'بدهی' : 'هر قسط'}: ${amount.error}`)
        const input = {
          direction,
          kind,
          counterparty,
          principal: principal?.ok ? principal.value : undefined,
          startDate: today,
          note,
          count,
          installmentAmount: amount.value,
          firstDueDate: firstDue,
          alreadyPaid: mode === 'single' ? 0 : int(paidText),
          reminder,
        }
        const err = validateDebtInput(input)
        if (err) return setError(err)
        await store.addDebt(input)
        ui.toast(direction === 'borrowed' ? 'بدهی ثبت شد' : 'طلب ثبت شد')
      }
      onClose()
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'خطا در ذخیره', 'error')
    }
  }

  const field = 'h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-brand dark:bg-night-card dark:ring-white/5'
  const label = 'mb-2 block text-[13px] font-semibold text-slate-500 dark:text-slate-400'

  return (
    <Sheet
      open
      onClose={onClose}
      title={isEdit ? 'ویرایش' : 'قرض، طلب یا وام جدید'}
      footer={
        <Button className="w-full" onClick={save}>
          {isEdit ? 'ذخیرهٔ تغییرات' : 'ثبت'}
        </Button>
      }
    >
      <div className="space-y-5">
        <Segmented
          value={direction}
          onChange={setDirection}
          options={[
            { value: 'borrowed', label: 'گرفتم (بدهکارم)', tone: 'expense' },
            { value: 'lent', label: 'دادم (طلبکارم)', tone: 'income' },
          ]}
        />

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['personal', 'قرض شخصی'],
              ['loan', 'وام بانکی'],
            ] as const
          ).map(([k, l]) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cx(
                'h-11 rounded-2xl text-[14px] font-semibold transition',
                kind === k ? 'bg-ink text-white dark:bg-white dark:text-ink' : 'bg-white ring-1 ring-slate-200 dark:bg-night-card dark:ring-white/5',
              )}
            >
              {l}
            </button>
          ))}
        </div>

        <div>
          <label className={label} htmlFor="cp">
            {kind === 'loan' ? 'نام بانک یا مؤسسه' : direction === 'borrowed' ? 'از چه کسی گرفتم؟' : 'به چه کسی دادم؟'}
          </label>
          <input id="cp" value={counterparty} maxLength={40} onChange={(e) => setCounterparty(e.target.value)} placeholder={kind === 'loan' ? 'مثلاً: بانک ملت' : 'مثلاً: علی'} className={field} />
        </div>

        <div>
          <label className={label} htmlFor="pr">
            مبلغ اصل <span className="font-normal">(اختیاری)</span>
          </label>
          <input id="pr" dir="ltr" inputMode="numeric" value={principalText} onChange={(e) => setPrincipalText(formatAmountInput(e.target.value))} placeholder="۰" className={cx(field, 'text-center tabular-nums')} />
          {principal?.ok && <p className="mt-1 text-[12px] text-slate-400">{amountInWords(principal.value)}</p>}
        </div>

        {!isEdit && (
          <>
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              options={[
                { value: 'installments', label: 'اقساطی (ماهانه)' },
                { value: 'single', label: 'یکجا' },
              ]}
            />
            <div className={cx('grid gap-3', mode === 'installments' ? 'grid-cols-2' : 'grid-cols-1')}>
              {mode === 'installments' && (
                <div>
                  <label className={label} htmlFor="cnt">تعداد اقساط</label>
                  <input id="cnt" dir="ltr" inputMode="numeric" value={toFaDigits(countText)} onChange={(e) => setCountText(toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 3))} className={cx(field, 'text-center tabular-nums')} />
                </div>
              )}
              <div>
                <label className={label} htmlFor="amt">{mode === 'single' ? 'مبلغ' : 'مبلغ هر قسط'}</label>
                <input id="amt" dir="ltr" inputMode="numeric" value={amountText} onChange={(e) => { setAmountText(formatAmountInput(e.target.value)); setError(null) }} placeholder="۰" className={cx(field, 'text-center tabular-nums')} />
              </div>
            </div>

            <div>
              <span className={label}>{mode === 'single' ? 'تاریخ سررسید' : 'سررسید قسط اول'}</span>
              <button type="button" onClick={() => setShowCal((s) => !s)} className={cx(field, 'flex items-center justify-between')}>
                <span className="flex items-center gap-2">
                  <CalendarDays size={17} className="text-brand dark:text-brand-light" />
                  {formatJLong(firstDue)}
                </span>
                <ChevronDown size={16} className={cx('text-slate-400 transition', showCal && 'rotate-180')} />
              </button>
              {showCal && (
                <div className="mt-3 animate-rise rounded-3xl bg-white p-3 shadow-card dark:bg-night-card dark:shadow-none">
                  <JalaliCalendar value={firstDue} onChange={(iso) => { setFirstDue(iso); setShowCal(false) }} />
                </div>
              )}
            </div>

            {mode === 'installments' && (
              <div>
                <label className={label} htmlFor="paid">چند قسط تاکنون پرداخت شده؟</label>
                <input id="paid" dir="ltr" inputMode="numeric" value={toFaDigits(paidText)} onChange={(e) => setPaidText(toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 3))} className={cx(field, 'text-center tabular-nums')} />
              </div>
            )}

            {amount.ok && count > 0 && (
              <div className="rounded-2xl bg-brand/5 p-3 text-[13px] leading-7 text-slate-600 dark:bg-brand-light/10 dark:text-slate-300">
                جمع کل: <b className="tabular-nums">{formatNumber(total)} تومان</b>
                {mode === 'installments' && lastDue && (
                  <>
                    <br />
                    {toFaDigits(count)} قسط ماهانه، آخرین قسط: <b>{formatJLong(lastDue)}</b>
                  </>
                )}
                {principal?.ok && total > principal.value && (
                  <>
                    <br />
                    مازاد بر اصل (سود/کارمزد): <b className="tabular-nums">{formatNumber(total - principal.value)} تومان</b>
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* یادآوری */}
        <div className="rounded-3xl bg-white p-4 shadow-card dark:bg-night-card dark:shadow-none">
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-semibold">
              <Bell size={18} className="text-amber-500" /> یادآوری سررسید
            </span>
            <Toggle checked={remindOn} onChange={setRemindOn} />
          </label>
          {remindOn && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {REMIND_OPTIONS.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDaysBefore(d)}
                  className={cx('h-10 rounded-xl text-[13px] font-semibold', daysBefore === d ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5')}
                >
                  {d === 0 ? 'همان روز' : `${toFaDigits(d)} روز قبل`}
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={label} htmlFor="dn">
            توضیحات <span className="font-normal">(اختیاری)</span>
          </label>
          <input id="dn" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={field} />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-expense/10 px-4 py-3 text-[14px] font-medium text-red-600 dark:text-expense">
            {error}
          </p>
        )}
      </div>
    </Sheet>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 shrink-0 rounded-full transition', checked ? 'bg-brand' : 'bg-slate-300 dark:bg-slate-600')}
    >
      <span className={cx('absolute top-0.5 size-6 rounded-full bg-white shadow transition-all', checked ? 'left-0.5' : 'left-[22px]')} />
    </button>
  )
}
