import { useState } from 'react'
import { type DateRange, formatJLong } from '../lib/jalali'
import { JalaliCalendar } from './JalaliCalendar'
import { Sheet } from './Sheet'
import { Button, cx } from './ui'

/** انتخاب بازهٔ تاریخ شمسی دلخواه */
export function RangePickerSheet({
  open,
  initial,
  onClose,
  onApply,
}: {
  open: boolean
  initial: DateRange
  onClose: () => void
  onApply: (r: DateRange) => void
}) {
  const [range, setRange] = useState(initial)
  const [edge, setEdge] = useState<'start' | 'end'>('start')

  const pick = (iso: string) => {
    if (edge === 'start') {
      setRange({ start: iso, end: iso > range.end ? iso : range.end })
      setEdge('end')
    } else {
      setRange(iso < range.start ? { start: iso, end: range.start } : { ...range, end: iso })
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="بازهٔ دلخواه"
      footer={
        <Button className="w-full" onClick={() => onApply(range)}>
          اعمال بازه
        </Button>
      }
    >
      <div className="mb-4 grid grid-cols-2 gap-2">
        {(['start', 'end'] as const).map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => setEdge(e)}
            className={cx(
              'rounded-2xl p-3 text-start transition',
              edge === e ? 'bg-white ring-2 ring-brand dark:bg-night-card' : 'bg-white/60 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/5',
            )}
          >
            <span className="block text-[12px] text-slate-400">{e === 'start' ? 'از تاریخ' : 'تا تاریخ'}</span>
            <span className="mt-0.5 block text-[15px] font-bold">{formatJLong(range[e])}</span>
          </button>
        ))}
      </div>
      <div className="rounded-3xl bg-white p-3 shadow-card dark:bg-night-card dark:shadow-none">
        <JalaliCalendar key={edge} value={range[edge]} onChange={pick} />
      </div>
    </Sheet>
  )
}
