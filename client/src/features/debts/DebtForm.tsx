import { Bell, CalendarDays, ChevronDown, RotateCcw, Wallet } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useUI } from '../../app/ui-context'
import { JalaliCalendar } from '../../components/JalaliCalendar'
import { Sheet } from '../../components/Sheet'
import { Button, Segmented, cx } from '../../components/ui'
import { useStore } from '../../data/store'
import type { Debt, DebtDirection, DebtKind, ScheduleRow } from '../../data/types'
import { cappedSchedule, equalSchedule, installmentsToRows, validateDebtInput, validateSchedule } from '../../lib/debts'
import { toEnDigits, toFaDigits } from '../../lib/digits'
import { formatJLong, todayIso } from '../../lib/jalali'
import { amountInWords, formatAmountInput, formatNumber, parseAmount } from '../../lib/money'
import { ScheduleEditor } from './ScheduleEditor'

const REMIND_OPTIONS = [0, 1, 3, 7]
type Repay = 'installments' | 'single' | 'open'
type Method = 'count' | 'cap'

const FIELD = 'h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-brand dark:bg-night-card dark:ring-white/5'
const LABEL = 'mb-2 block text-[13px] font-semibold text-slate-500 dark:text-slate-400'

const int = (t: string) => {
  const v = parseInt(toEnDigits(t).replace(/\D/g, ''), 10)
  return Number.isNaN(v) ? 0 : v
}
const amountOf = (t: string) => {
  const p = parseAmount(t)
  return p.ok ? p.value : 0
}

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
  const [inBalance, setInBalance] = useState(debt ? !!debt.disbursement : true)
  const [disbDate, setDisbDate] = useState(debt?.disbursement?.date ?? today)
  const [disbCal, setDisbCal] = useState(false)

  // تنظیمات ساخت جدول اقساط
  const [repay, setRepay] = useState<Repay>('installments')
  const [method, setMethod] = useState<Method>('count')
  const [countText, setCountText] = useState('12')
  const [amountText, setAmountText] = useState('')
  const [totalText, setTotalText] = useState('')
  const [capText, setCapText] = useState('')
  const [firstDue, setFirstDue] = useState(today)
  const [dueCal, setDueCal] = useState(false)
  const [paidText, setPaidText] = useState('0')
  const [customRows, setCustomRows] = useState<ScheduleRow[] | null>(debt ? installmentsToRows(debt.installments) : null)

  const [note, setNote] = useState(debt?.note ?? '')
  const [remindOn, setRemindOn] = useState(debt?.reminder.enabled ?? true)
  const [daysBefore, setDaysBefore] = useState(debt?.reminder.daysBefore ?? 3)
  const [error, setError] = useState<string | null>(null)

  const principal = amountOf(principalText)
  const borrowed = direction === 'borrowed'

  const generated = useMemo((): ScheduleRow[] => {
    if (repay === 'open') return [{ amount: amountOf(amountText) || principal, paid: false }]
    if (repay === 'single') return [{ amount: amountOf(amountText) || principal, dueDate: firstDue, paid: false }]
    const paid = int(paidText)
    if (method === 'cap') return cappedSchedule(amountOf(totalText) || principal, amountOf(capText), firstDue, paid)
    const count = Math.min(int(countText), 360)
    if (count < 1) return []
    const each = amountOf(amountText)
    // اگر مبلغ قسط وارد نشده، اصل وام بر تعداد تقسیم می‌شود و آخرین قسط باقی‌مانده را می‌گیرد
    if (!each) return principal ? cappedSchedule(principal, Math.ceil(principal / count), firstDue, paid) : []
    return equalSchedule(count, each, firstDue, paid)
  }, [repay, method, amountText, totalText, capText, countText, paidText, firstDue, principal])

  const rows = customRows ?? generated
  const capCount = method === 'cap' && amountOf(capText) ? Math.ceil((amountOf(totalText) || principal) / amountOf(capText)) : 0

  const save = async () => {
    const pText = principalText ? parseAmount(principalText) : null
    if (pText && !pText.ok) return setError(`مبلغ قرض/وام: ${pText.error}`)
    if (inBalance && !principal) return setError('برای ورود به موجودی، مبلغ قرض/وام را وارد کنید')
    const schedErr = validateSchedule(rows)
    if (schedErr) return setError(schedErr)
    const common = {
      direction,
      kind,
      counterparty: counterparty.trim(),
      principal: principal || undefined,
      note: note.trim(),
      disbursement: inBalance ? { amount: principal, date: disbDate } : undefined,
      reminder: { enabled: remindOn, daysBefore },
    }
    try {
      if (debt) {
        if (!common.counterparty) return setError('نام طرف حساب را وارد کنید')
        await store.updateDebt(debt.id, { ...common, schedule: rows })
        ui.toast('تغییرات ذخیره شد')
      } else {
        const input = { ...common, startDate: inBalance ? disbDate : today, schedule: rows }
        const err = validateDebtInput(input)
        if (err) return setError(err)
        await store.addDebt(input)
        ui.toast(borrowed ? 'بدهی ثبت شد' : 'طلب ثبت شد')
      }
      onClose()
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'خطا در ذخیره', 'error')
    }
  }

  const reset = () => setCustomRows(null)
  const onRows = (r: ScheduleRow[]) => {
    setCustomRows(r)
    setError(null)
  }

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
          <label className={LABEL} htmlFor="cp">
            {kind === 'loan' ? 'نام بانک یا مؤسسه' : borrowed ? 'از چه کسی گرفتم؟' : 'به چه کسی دادم؟'}
          </label>
          <input id="cp" value={counterparty} maxLength={40} onChange={(e) => setCounterparty(e.target.value)} placeholder={kind === 'loan' ? 'مثلاً: بانک ملت' : 'مثلاً: علی'} className={FIELD} />
        </div>

        {/* مبلغ و ورود به موجودی */}
        <div className="rounded-3xl bg-white p-4 shadow-card dark:bg-night-card dark:shadow-none">
          <label className={LABEL} htmlFor="pr">
            {borrowed ? 'مبلغ قرض/وام دریافتی' : 'مبلغ قرض داده‌شده'}
          </label>
          <input
            id="pr"
            dir="ltr"
            inputMode="numeric"
            value={principalText}
            onChange={(e) => {
              setPrincipalText(formatAmountInput(e.target.value))
              setError(null)
            }}
            placeholder="۰"
            className="w-full bg-transparent text-center text-[28px] font-extrabold outline-none placeholder:text-slate-300"
          />
          <p className="min-h-5 text-center text-[12px] text-slate-400">{principal ? amountInWords(principal) : 'تومان'}</p>

          <div className="mt-3 border-t border-slate-100 pt-3 dark:border-night-line">
            <ToggleLine
              icon={<Wallet size={18} className="text-brand dark:text-brand-light" />}
              title={borrowed ? 'به موجودی اضافه شود' : 'از موجودی کم شود'}
              hint="درآمد یا هزینه حساب نمی‌شود؛ به‌عنوان بدهی/طلب نگه داشته می‌شود"
              checked={inBalance}
              onChange={setInBalance}
            />
            {inBalance && (
              <>
                <button type="button" onClick={() => setDisbCal((v) => !v)} className={cx(FIELD, 'mt-3 flex items-center justify-between text-[14px]')}>
                  <span className="flex items-center gap-2">
                    <CalendarDays size={16} className="text-slate-400" />
                    تاریخ {borrowed ? 'دریافت' : 'پرداخت'}: {formatJLong(disbDate)}
                  </span>
                  <ChevronDown size={16} className={cx('text-slate-400 transition', disbCal && 'rotate-180')} />
                </button>
                {disbCal && (
                  <div className="mt-2 rounded-2xl bg-slate-50 p-2 dark:bg-white/5">
                    <JalaliCalendar value={disbDate} onChange={(d) => { setDisbDate(d); setDisbCal(false) }} />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* سازندهٔ جدول اقساط (فقط هنگام ثبت) */}
        {!isEdit && (
          <div className="space-y-4">
            <h3 className="text-[15px] font-bold">بازپرداخت</h3>
            <Segmented
              size="sm"
              value={repay}
              onChange={(v) => { setRepay(v); reset() }}
              options={[
                { value: 'installments', label: 'اقساطی' },
                { value: 'single', label: 'یکجا با سررسید' },
                { value: 'open', label: 'بدون سررسید' },
              ]}
            />

            {repay === 'installments' && (
              <>
                <Segmented
                  size="sm"
                  value={method}
                  onChange={(v) => { setMethod(v); reset() }}
                  options={[
                    { value: 'count', label: 'تعداد اقساط مشخص' },
                    { value: 'cap', label: 'سقف مبلغ هر قسط' },
                  ]}
                />
                {method === 'count' ? (
                  <div className="grid grid-cols-2 gap-3">
                    <NumField id="cnt" label="تعداد اقساط" value={toFaDigits(countText)} onChange={(v) => { setCountText(toEnDigits(v).replace(/\D/g, '').slice(0, 3)); reset() }} />
                    <NumField
                      id="amt"
                      label="مبلغ هر قسط"
                      value={amountText}
                      placeholder={principal && int(countText) ? formatNumber(Math.ceil(principal / int(countText))) : '۰'}
                      onChange={(v) => { setAmountText(formatAmountInput(v)); reset() }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <NumField id="tot" label="جمع قابل بازپرداخت" value={totalText} placeholder={principal ? formatNumber(principal) : '۰'} onChange={(v) => { setTotalText(formatAmountInput(v)); reset() }} />
                      <NumField id="cap" label="حداکثر مبلغ هر قسط" value={capText} onChange={(v) => { setCapText(formatAmountInput(v)); reset() }} />
                    </div>
                    {capCount > 0 && (
                      <p className="text-[12px] leading-6 text-slate-500">
                        هیچ قسطی بیشتر از {formatNumber(amountOf(capText))} تومان نمی‌شود؛ {toFaDigits(capCount)} قسط ساخته می‌شود و آخرین قسط باقی‌ماندهٔ مبلغ است.
                      </p>
                    )}
                  </>
                )}
                <DateField label="سررسید قسط اول" value={firstDue} open={dueCal} setOpen={setDueCal} onChange={(d) => { setFirstDue(d); reset() }} />
                <NumField id="paid" label="چند قسط پیش از امروز پرداخت شده؟" value={toFaDigits(paidText)} onChange={(v) => { setPaidText(toEnDigits(v).replace(/\D/g, '').slice(0, 3)); reset() }} />
              </>
            )}

            {repay === 'single' && (
              <>
                <NumField id="amt1" label="مبلغ بازپرداخت" value={amountText} placeholder={principal ? formatNumber(principal) : '۰'} onChange={(v) => { setAmountText(formatAmountInput(v)); reset() }} />
                <DateField label="تاریخ سررسید" value={firstDue} open={dueCal} setOpen={setDueCal} onChange={(d) => { setFirstDue(d); reset() }} />
              </>
            )}

            {repay === 'open' && (
              <NumField id="amt2" label="مبلغ بازپرداخت" value={amountText} placeholder={principal ? formatNumber(principal) : '۰'} onChange={(v) => { setAmountText(formatAmountInput(v)); reset() }} />
            )}
          </div>
        )}

        {/* جدول اقساط قابل ویرایش */}
        {rows.length > 0 && (
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-[15px] font-bold">جدول اقساط</h3>
              {!isEdit && customRows && (
                <button type="button" onClick={reset} className="flex items-center gap-1 text-[12px] font-semibold text-brand dark:text-brand-light">
                  <RotateCcw size={13} /> ساخت دوباره از تنظیمات بالا
                </button>
              )}
            </div>
            <p className="mb-2 text-[12px] text-slate-400">مبلغ و تاریخ هر قسط را می‌توانید جداگانه تغییر دهید.</p>
            <ScheduleEditor rows={rows} onChange={onRows} lockPaid={isEdit} principal={principal || undefined} direction={direction} />
          </div>
        )}

        {/* یادآوری */}
        <div className="rounded-3xl bg-white p-4 shadow-card dark:bg-night-card dark:shadow-none">
          <ToggleLine icon={<Bell size={18} className="text-amber-500" />} title="یادآوری سررسید" checked={remindOn} onChange={setRemindOn} />
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
          <label className={LABEL} htmlFor="dn">
            توضیحات <span className="font-normal">(اختیاری)</span>
          </label>
          <input id="dn" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className={FIELD} />
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

function NumField({ id, label, value, onChange, placeholder = '۰' }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <label className={LABEL} htmlFor={id}>
        {label}
      </label>
      <input id={id} dir="ltr" inputMode="numeric" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cx(FIELD, 'text-center')} />
    </div>
  )
}

function DateField({ label, value, open, setOpen, onChange }: { label: string; value: string; open: boolean; setOpen: (v: boolean) => void; onChange: (iso: string) => void }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <button type="button" onClick={() => setOpen(!open)} className={cx(FIELD, 'flex items-center justify-between')}>
        <span className="flex items-center gap-2">
          <CalendarDays size={17} className="text-brand dark:text-brand-light" />
          {formatJLong(value)}
        </span>
        <ChevronDown size={16} className={cx('text-slate-400 transition', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="mt-3 animate-rise rounded-3xl bg-white p-3 shadow-card dark:bg-night-card dark:shadow-none">
          <JalaliCalendar value={value} onChange={(iso) => { onChange(iso); setOpen(false) }} />
        </div>
      )}
    </div>
  )
}

function ToggleLine({ icon, title, hint, checked, onChange }: { icon: ReactNode; title: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <span>
          <span className="block font-semibold">{title}</span>
          {hint && <span className="block text-[12px] leading-5 text-slate-400">{hint}</span>}
        </span>
      </span>
      <Toggle label={title} checked={checked} onChange={onChange} />
    </div>
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
