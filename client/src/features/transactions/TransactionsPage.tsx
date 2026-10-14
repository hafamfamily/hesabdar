import { Plus, Search, SearchX, SlidersHorizontal, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeader } from '../../app/AppShell'
import { useUI } from '../../app/ui-context'
import { RangePickerSheet } from '../../components/RangePicker'
import { Sheet } from '../../components/Sheet'
import { CategoryIcon } from '../../components/icons'
import { Amount, Button, Card, EmptyState, Segmented, cx } from '../../components/ui'
import { useCategories, useCategoryMap, useStore } from '../../data/store'
import type { Transaction, TxType } from '../../data/types'
import { sortByDateDesc, totals } from '../../lib/finance'
import { addDays, type DateRange, formatJDayMonth, formatRelativeDay, jMonthRange, shiftJMonth, toJ, todayIso } from '../../lib/jalali'
import { toFaDigits } from '../../lib/digits'
import { formatNumber } from '../../lib/money'
import { TransactionRow } from './TransactionRow'

type TypeFilter = 'all' | TxType
type Preset = 'all' | 'thisMonth' | 'lastMonth' | 'last30' | 'custom'

const PRESETS: { value: Preset; label: string }[] = [
  { value: 'all', label: 'همهٔ زمان‌ها' },
  { value: 'thisMonth', label: 'ماه جاری' },
  { value: 'lastMonth', label: 'ماه گذشته' },
  { value: 'last30', label: '۳۰ روز اخیر' },
  { value: 'custom', label: 'بازهٔ دلخواه' },
]

function presetRange(p: Preset, custom: DateRange | null): DateRange | null {
  const today = todayIso()
  const { jy, jm } = toJ(today)
  switch (p) {
    case 'thisMonth':
      return jMonthRange(jy, jm)
    case 'lastMonth': {
      const prev = shiftJMonth(jy, jm, -1)
      return jMonthRange(prev.jy, prev.jm)
    }
    case 'last30':
      return { start: addDays(today, -29), end: today }
    case 'custom':
      return custom
    default:
      return null
  }
}

export function TransactionsPage() {
  const { transactions } = useStore()
  const catMap = useCategoryMap()
  const ui = useUI()

  const [query, setQuery] = useState('')
  const [type, setType] = useState<TypeFilter>('all')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [preset, setPreset] = useState<Preset>('all')
  const [custom, setCustom] = useState<DateRange | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [rangeOpen, setRangeOpen] = useState(false)

  const range = presetRange(preset, custom)

  const filtered = useMemo(() => {
    const q = query.trim()
    return sortByDateDesc(
      transactions.filter(
        (t) =>
          (type === 'all' || t.type === type) &&
          (!categoryId || t.categoryId === categoryId) &&
          (!range || (t.date >= range.start && t.date <= range.end)) &&
          (!q || t.note.includes(q) || (catMap.get(t.categoryId)?.name ?? '').includes(q)),
      ),
    )
  }, [transactions, type, categoryId, range, query, catMap])

  const groups = useMemo(() => {
    const out: { date: string; items: Transaction[] }[] = []
    for (const t of filtered) {
      const last = out[out.length - 1]
      if (last && last.date === t.date) last.items.push(t)
      else out.push({ date: t.date, items: [t] })
    }
    return out
  }, [filtered])

  const sum = totals(filtered)
  const activeCat = categoryId ? catMap.get(categoryId) : undefined
  const filterCount = (categoryId ? 1 : 0) + (preset !== 'all' ? 1 : 0)
  const rangeLabel =
    preset === 'custom' && custom ? `${formatJDayMonth(custom.start)} تا ${formatJDayMonth(custom.end)}` : PRESETS.find((p) => p.value === preset)?.label

  return (
    <div>
      <PageHeader title="تراکنش‌ها" subtitle={`${toFaDigits(filtered.length)} مورد`} />

      <div className="sticky top-0 z-20 -mx-4 space-y-3 bg-canvas/90 px-4 pt-[env(safe-area-inset-top)] pb-3 backdrop-blur-xl dark:bg-night/90">
        <div className="flex gap-2">
          <label className="flex h-12 flex-1 items-center gap-2 rounded-2xl bg-white px-3 ring-1 ring-slate-200 focus-within:ring-2 focus-within:ring-brand dark:bg-night-card dark:ring-white/5">
            <Search size={18} className="text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجو در توضیحات…"
              className="h-full min-w-0 flex-1 bg-transparent outline-none placeholder:text-slate-400"
            />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="پاک کردن جست‌وجو" className="text-slate-400">
                <X size={18} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setFiltersOpen(true)}
            aria-label="فیلترها"
            className="relative grid size-12 place-items-center rounded-2xl bg-white ring-1 ring-slate-200 dark:bg-night-card dark:ring-white/5"
          >
            <SlidersHorizontal size={19} />
            {filterCount > 0 && (
              <span className="absolute -top-1 -left-1 grid size-5 place-items-center rounded-full bg-brand text-[11px] font-bold text-white">
                {toFaDigits(filterCount)}
              </span>
            )}
          </button>
        </div>
        <Segmented
          size="sm"
          value={type}
          onChange={setType}
          options={[
            { value: 'all', label: 'همه' },
            { value: 'income', label: 'درآمد' },
            { value: 'expense', label: 'هزینه' },
          ]}
        />
        {filterCount > 0 && (
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {preset !== 'all' && <Chip label={rangeLabel ?? ''} onClear={() => setPreset('all')} />}
            {activeCat && <Chip label={activeCat.name} onClear={() => setCategoryId(null)} />}
          </div>
        )}
      </div>

      <Card className="mb-4 !p-3">
        <div className="grid grid-cols-3 divide-x divide-slate-100 text-center dark:divide-night-line">
          <MiniSum label="درآمد" value={sum.income} type="income" />
          <MiniSum label="هزینه" value={sum.expense} type="expense" />
          <div>
            <p className="text-[11px] text-slate-400">خالص</p>
            <p className={cx('text-[14px] font-bold', sum.net < 0 && 'text-red-500 dark:text-expense')}>{formatNumber(sum.net)}</p>
          </div>
        </div>
      </Card>

      {groups.length === 0 ? (
        <Card>
          <EmptyState icon={<SearchX size={24} />} title="تراکنشی پیدا نشد" hint="فیلترها یا عبارت جست‌وجو را تغییر دهید." />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => {
            const day = totals(g.items)
            return (
              <section key={g.date}>
                <div className="mb-1.5 flex items-center justify-between px-1 text-[12px]">
                  <span className="font-bold text-slate-500 dark:text-slate-400">{formatRelativeDay(g.date)}</span>
                  <span className="text-slate-400">
                    {day.income > 0 && <bdi className="text-emerald-600 dark:text-income">+{formatNumber(day.income)}</bdi>}
                    {day.expense > 0 && <bdi className="ms-2 text-red-500 dark:text-expense">−{formatNumber(day.expense)}</bdi>}
                  </span>
                </div>
                <Card className="!px-3 !py-1">
                  <div className="divide-y divide-slate-100 dark:divide-night-line">
                    {g.items.map((t) => (
                      <TransactionRow key={t.id} tx={t} category={catMap.get(t.categoryId)} showDate={false} onClick={() => ui.openTxForm(t)} />
                    ))}
                  </div>
                </Card>
              </section>
            )
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => ui.openTxForm()}
        aria-label="ثبت تراکنش"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+80px)] left-[max(16px,calc(50%-256px+16px))] z-30 grid size-14 place-items-center rounded-2xl bg-brand text-white shadow-float transition active:scale-95"
      >
        <Plus size={26} strokeWidth={2.6} />
      </button>

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        type={type}
        categoryId={categoryId}
        onCategory={setCategoryId}
        preset={preset}
        onPreset={(p) => {
          if (p === 'custom') {
            setFiltersOpen(false)
            setRangeOpen(true)
          } else setPreset(p)
        }}
        onReset={() => {
          setCategoryId(null)
          setPreset('all')
        }}
      />
      {rangeOpen && (
        <RangePickerSheet
          open
          initial={custom ?? { start: addDays(todayIso(), -6), end: todayIso() }}
          onClose={() => setRangeOpen(false)}
          onApply={(r) => {
            setCustom(r)
            setPreset('custom')
            setRangeOpen(false)
          }}
        />
      )}
    </div>
  )
}

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <span className="flex shrink-0 items-center gap-1 rounded-full bg-brand/10 py-1 ps-3 pe-1 text-[13px] font-medium text-brand dark:bg-brand-light/10 dark:text-brand-light">
      {label}
      <button type="button" onClick={onClear} aria-label={`حذف فیلتر ${label}`} className="grid size-6 place-items-center rounded-full hover:bg-brand/10">
        <X size={14} />
      </button>
    </span>
  )
}

function MiniSum({ label, value, type }: { label: string; value: number; type: TxType }) {
  return (
    <div>
      <p className="text-[11px] text-slate-400">{label}</p>
      <Amount value={value} type={type} unit={false} signed={false} className="text-[14px] font-bold" />
    </div>
  )
}

function FilterSheet({
  open,
  onClose,
  type,
  categoryId,
  onCategory,
  preset,
  onPreset,
  onReset,
}: {
  open: boolean
  onClose: () => void
  type: TypeFilter
  categoryId: string | null
  onCategory: (id: string | null) => void
  preset: Preset
  onPreset: (p: Preset) => void
  onReset: () => void
}) {
  const cats = useCategories(type === 'all' ? undefined : type)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="فیلترها"
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReset}>
            پاک کردن
          </Button>
          <Button className="flex-1" onClick={onClose}>
            نمایش نتایج
          </Button>
        </div>
      }
    >
      <h3 className="mb-2 text-[13px] font-semibold text-slate-500">بازهٔ زمانی</h3>
      <div className="mb-5 flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.value}
            type="button"
            onClick={() => onPreset(p.value)}
            className={cx(
              'h-10 rounded-full px-4 text-[14px] font-medium transition',
              preset === p.value ? 'bg-brand text-white' : 'bg-white ring-1 ring-slate-200 dark:bg-night-card dark:ring-white/5',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <h3 className="mb-2 text-[13px] font-semibold text-slate-500">دسته‌بندی</h3>
      <div className="grid grid-cols-2 gap-2">
        {cats.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onCategory(categoryId === c.id ? null : c.id)}
            className={cx(
              'flex items-center gap-2 rounded-2xl p-2 text-[14px] font-medium transition',
              categoryId === c.id ? 'bg-white ring-2 ring-brand dark:bg-night-card' : 'bg-white/60 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/5',
            )}
          >
            <CategoryIcon icon={c.icon} color={c.color} size="sm" />
            <span className="truncate">{c.name}</span>
            {type === 'all' && <span className="ms-auto text-[11px] text-slate-400">{c.type === 'income' ? 'درآمد' : 'هزینه'}</span>}
          </button>
        ))}
      </div>
    </Sheet>
  )
}
