import type { Category } from '../data/types'
import { CategoryIcon } from './icons'
import { cx } from './ui'

export function CategoryGrid({
  categories,
  value,
  onChange,
}: {
  categories: Category[]
  value: string
  onChange: (id: string) => void
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {categories.map((c) => {
        const active = c.id === value
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onChange(c.id)}
            aria-pressed={active}
            className={cx(
              'flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 text-[12px] font-medium transition',
              active
                ? 'bg-white shadow-card ring-2 ring-brand dark:bg-night-card dark:ring-brand-light'
                : 'bg-white/60 ring-1 ring-slate-200/70 dark:bg-white/[0.03] dark:ring-white/5',
            )}
          >
            <CategoryIcon icon={c.icon} color={c.color} size="sm" />
            <span className="line-clamp-1">{c.name}</span>
          </button>
        )
      })}
    </div>
  )
}
