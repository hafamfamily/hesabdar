import { CalendarDays, ChevronDown, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useUI } from '../../app/ui-context'
import { CategoryGrid } from '../../components/CategoryGrid'
import { JalaliCalendar } from '../../components/JalaliCalendar'
import { Sheet } from '../../components/Sheet'
import { Button, Segmented, cx } from '../../components/ui'
import { useCategories, useStore } from '../../data/store'
import type { Transaction, TxType } from '../../data/types'
import { addDays, formatJLong, formatRelativeDay, todayIso } from '../../lib/jalali'
import { amountInWords, formatAmountInput, formatNumber, parseAmount } from '../../lib/money'

export function TransactionForm({ open, tx, onClose }: { open: boolean; tx?: Transaction; onClose: () => void }) {
  const store = useStore()
  const ui = useUI()
  const isEdit = !!tx
  const today = todayIso()

  const [type, setType] = useState<TxType>(tx?.type ?? 'expense')
  const [amountText, setAmountText] = useState(tx ? formatNumber(tx.amount) : '')
  const [date, setDate] = useState(tx?.date ?? today)
  const [showCal, setShowCal] = useState(false)
  const categories = useCategories(type)
  const [categoryId, setCategoryId] = useState(tx?.categoryId ?? '')
  const [note, setNote] = useState(tx?.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const parsed = parseAmount(amountText)
  const effectiveCategory = categories.some((c) => c.id === categoryId) ? categoryId : (categories[0]?.id ?? '')

  const switchType = (t: TxType) => {
    setType(t)
    setCategoryId('')
  }

  const submit = async () => {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    if (!effectiveCategory) {
      setError('یک دسته‌بندی انتخاب کنید')
      return
    }
    setSaving(true)
    try {
      const input = { type, amount: parsed.value, date, categoryId: effectiveCategory, note: note.trim() }
      if (tx) await store.updateTransaction(tx.id, input)
      else await store.addTransaction(input)
      ui.toast(isEdit ? 'تغییرات ذخیره شد' : type === 'income' ? 'درآمد ثبت شد' : 'هزینه ثبت شد')
      onClose()
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'خطا در ذخیره', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!tx) return
    const ok = await ui.confirm({
      title: 'حذف تراکنش',
      message: `تراکنش ${formatNumber(tx.amount)} تومانی حذف شود؟`,
      confirmLabel: 'حذف',
      danger: true,
    })
    if (!ok) return
    await store.deleteTransaction(tx.id)
    ui.toast('تراکنش حذف شد')
    onClose()
  }

  const accent = type === 'income' ? 'text-emerald-600 dark:text-income' : 'text-red-500 dark:text-expense'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isEdit ? 'ویرایش تراکنش' : 'ثبت تراکنش'}
      footer={
        <div className="flex gap-2">
          {isEdit && (
            <Button variant="danger" onClick={remove} aria-label="حذف تراکنش" className="w-14 px-0">
              <Trash2 size={20} />
            </Button>
          )}
          <Button className="flex-1" onClick={submit} disabled={saving}>
            {isEdit ? 'ذخیرهٔ تغییرات' : type === 'income' ? 'ثبت درآمد' : 'ثبت هزینه'}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Segmented
          value={type}
          onChange={switchType}
          options={[
            { value: 'expense', label: 'هزینه', tone: 'expense' },
            { value: 'income', label: 'درآمد', tone: 'income' },
          ]}
        />

        {/* مبلغ */}
        <div className="rounded-3xl bg-white p-4 text-center shadow-card dark:bg-night-card dark:shadow-none">
          <label htmlFor="amount" className="text-[13px] text-slate-400">
            مبلغ (تومان)
          </label>
          <input
            id="amount"
            dir="ltr"
            inputMode="numeric"
            autoComplete="off"
            placeholder="۰"
            value={amountText}
            onChange={(e) => {
              setAmountText(formatAmountInput(e.target.value))
              setError(null)
            }}
            className={cx(
              'mt-1 w-full bg-transparent text-center text-[34px] font-extrabold tracking-tight outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600',
              accent,
            )}
          />
          <p className="min-h-5 text-[13px] text-slate-500 dark:text-slate-400">
            {parsed.ok ? amountInWords(parsed.value) : ''}
          </p>
        </div>

        {/* تاریخ */}
        <div>
          <span className="mb-2 block text-[13px] font-semibold text-slate-500 dark:text-slate-400">تاریخ</span>
          <div className="flex gap-2">
            {[
              { iso: today, label: 'امروز' },
              { iso: addDays(today, -1), label: 'دیروز' },
            ].map((q) => (
              <button
                key={q.iso}
                type="button"
                onClick={() => {
                  setDate(q.iso)
                  setShowCal(false)
                }}
                className={cx(
                  'h-11 rounded-2xl px-4 text-[14px] font-semibold transition',
                  date === q.iso ? 'bg-brand text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-night-card dark:ring-white/5',
                )}
              >
                {q.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCal((s) => !s)}
              className="flex h-11 flex-1 items-center justify-between gap-2 rounded-2xl bg-white px-3 text-[14px] ring-1 ring-slate-200 dark:bg-night-card dark:ring-white/5"
            >
              <span className="flex items-center gap-2">
                <CalendarDays size={17} className="text-brand dark:text-brand-light" />
                {formatJLong(date)}
              </span>
              <ChevronDown size={16} className={cx('text-slate-400 transition', showCal && 'rotate-180')} />
            </button>
          </div>
          {showCal && (
            <div className="mt-3 animate-rise rounded-3xl bg-white p-3 shadow-card dark:bg-night-card dark:shadow-none">
              <JalaliCalendar
                value={date}
                onChange={(iso) => {
                  setDate(iso)
                  setShowCal(false)
                }}
              />
            </div>
          )}
          {date > today && <p className="mt-2 text-[12px] text-amber-600">توجه: تاریخ انتخاب‌شده در آینده است ({formatRelativeDay(date)}).</p>}
        </div>

        {/* دسته‌بندی */}
        <div>
          <span className="mb-2 block text-[13px] font-semibold text-slate-500 dark:text-slate-400">دسته‌بندی</span>
          <CategoryGrid categories={categories} value={effectiveCategory} onChange={setCategoryId} />
        </div>

        {/* توضیحات */}
        <div>
          <label htmlFor="note" className="mb-2 block text-[13px] font-semibold text-slate-500 dark:text-slate-400">
            توضیحات <span className="font-normal">(اختیاری)</span>
          </label>
          <input
            id="note"
            value={note}
            maxLength={200}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثلاً: خرید نان"
            className="h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-brand dark:bg-night-card dark:ring-white/5"
          />
        </div>

        {error && (
          <p role="alert" className="rounded-2xl bg-expense/10 px-4 py-3 text-[14px] font-medium text-red-600 dark:text-expense">
            {error}
          </p>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  )
}
