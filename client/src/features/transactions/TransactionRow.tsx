import { CategoryIcon } from '../../components/icons'
import { Amount } from '../../components/ui'
import type { Category, Transaction } from '../../data/types'
import { formatRelativeDay } from '../../lib/jalali'

export function TransactionRow({
  tx,
  category,
  onClick,
  showDate = true,
}: {
  tx: Transaction
  category?: Category
  onClick?: () => void
  showDate?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl px-1 py-2.5 text-start transition active:bg-slate-100 dark:active:bg-white/5"
    >
      <CategoryIcon icon={category?.icon ?? 'dots'} color={category?.color ?? '#94A3B8'} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{tx.note || category?.name || 'بدون عنوان'}</span>
        <span className="block truncate text-[12px] text-slate-400">
          {tx.note ? category?.name : tx.type === 'income' ? 'درآمد' : 'هزینه'}
          {showDate && ` · ${formatRelativeDay(tx.date)}`}
        </span>
      </span>
      <Amount value={tx.amount} type={tx.type} className="text-[15px] font-bold" />
    </button>
  )
}
