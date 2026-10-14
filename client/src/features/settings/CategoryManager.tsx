import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useUI } from '../../app/ui-context'
import { CATEGORY_ICONS, CategoryIcon } from '../../components/icons'
import { Sheet } from '../../components/Sheet'
import { Button, Segmented, cx } from '../../components/ui'
import { CATEGORY_COLORS } from '../../data/defaults'
import { useCategories, useStore } from '../../data/store'
import type { Category, TxType } from '../../data/types'

/**
 * مدیریت دسته‌بندی‌ها.
 * دسته‌ها حذف نمی‌شوند بلکه «بایگانی» می‌شوند تا تراکنش‌های قدیمی بی‌دسته نمانند و گزارش‌ها درست بمانند.
 */
export function CategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [type, setType] = useState<TxType>('expense')
  const cats = useCategories(type, true)
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const [deleting, setDeleting] = useState<Category | null>(null)
  const store = useStore()
  const ui = useUI()

  const toggleArchive = async (c: Category) => {
    if (!c.archived && cats.filter((x) => !x.archived).length <= 1) {
      ui.toast('حداقل یک دسته باید فعال بماند', 'error')
      return
    }
    await store.saveCategory({ ...c, archived: !c.archived })
    ui.toast(c.archived ? 'دسته فعال شد' : 'دسته بایگانی شد')
  }

  return (
    <>
      <Sheet open={open && !editing && !deleting} onClose={onClose} title="دسته‌بندی‌ها">
        <Segmented
          value={type}
          onChange={setType}
          className="mb-4"
          options={[
            { value: 'expense', label: 'هزینه' },
            { value: 'income', label: 'درآمد' },
          ]}
        />
        <ul className="divide-y divide-slate-100 rounded-3xl bg-white px-3 shadow-card dark:divide-night-line dark:bg-night-card dark:shadow-none">
          {cats.map((c) => (
            <li key={c.id} className={cx('flex items-center gap-3 py-2.5', c.archived && 'opacity-50')}>
              <CategoryIcon icon={c.icon} color={c.color} size="sm" />
              <span className="flex-1 font-medium">
                {c.name}
                {c.archived && <span className="ms-2 text-[11px] text-slate-400">بایگانی</span>}
              </span>
              <button type="button" aria-label={`ویرایش ${c.name}`} onClick={() => setEditing(c)} className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                <Pencil size={16} />
              </button>
              <button type="button" aria-label={`حذف ${c.name}`} onClick={() => setDeleting(c)} className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
                <Trash2 size={16} />
              </button>
              <button
                type="button"
                aria-label={c.archived ? `فعال‌سازی ${c.name}` : `بایگانی ${c.name}`}
                onClick={() => toggleArchive(c)}
                className="grid size-9 place-items-center rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                {c.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
              </button>
            </li>
          ))}
        </ul>
        <Button variant="secondary" className="mt-4 w-full" onClick={() => setEditing({ type, icon: 'dots', color: CATEGORY_COLORS[0], name: '' })}>
          <Plus size={18} /> افزودن دستهٔ جدید
        </Button>
      </Sheet>

      {editing && <CategoryEditor initial={editing} onClose={() => setEditing(null)} />}
      {deleting && <CategoryDelete cat={deleting} onClose={() => setDeleting(null)} />}
    </>
  )
}

function CategoryEditor({ initial, onClose }: { initial: Partial<Category>; onClose: () => void }) {
  const store = useStore()
  const ui = useUI()
  const [name, setName] = useState(initial.name ?? '')
  const [icon, setIcon] = useState(initial.icon ?? 'dots')
  const [color, setColor] = useState(initial.color ?? CATEGORY_COLORS[0])
  const isNew = !initial.id

  const save = async () => {
    const n = name.trim()
    if (!n) return ui.toast('نام دسته را وارد کنید', 'error')
    const dup = store.categories.some((c) => c.type === initial.type && c.name === n && c.id !== initial.id)
    if (dup) return ui.toast('دسته‌ای با این نام وجود دارد', 'error')
    await store.saveCategory({ id: initial.id, type: initial.type!, name: n, icon, color, archived: initial.archived })
    ui.toast(isNew ? 'دسته اضافه شد' : 'دسته ویرایش شد')
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={isNew ? 'دستهٔ جدید' : 'ویرایش دسته'}
      footer={
        <Button className="w-full" onClick={save}>
          <Check size={18} /> ذخیره
        </Button>
      }
    >
      <div className="mb-5 flex items-center gap-3">
        <CategoryIcon icon={icon} color={color} size="lg" />
        <input
          autoFocus
          value={name}
          maxLength={24}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام دسته"
          className="h-12 flex-1 rounded-2xl bg-white px-4 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-brand dark:bg-night-card dark:ring-white/5"
        />
      </div>
      <h3 className="mb-2 text-[13px] font-semibold text-slate-500">رنگ</h3>
      <div className="mb-5 flex flex-wrap gap-2.5">
        {CATEGORY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={`رنگ ${c}`}
            className={cx('size-9 rounded-full transition', color === c && 'ring-2 ring-offset-2 ring-offset-canvas dark:ring-offset-night')}
            style={{ background: c, ['--tw-ring-color' as string]: c }}
          />
        ))}
      </div>
      <h3 className="mb-2 text-[13px] font-semibold text-slate-500">آیکون</h3>
      <div className="grid grid-cols-5 gap-2">
        {Object.keys(CATEGORY_ICONS).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setIcon(k)}
            className={cx('grid place-items-center rounded-2xl py-2 transition', icon === k ? 'bg-white ring-2 ring-brand dark:bg-night-card' : 'bg-white/50 dark:bg-white/5')}
          >
            <CategoryIcon icon={k} color={icon === k ? color : '#94A3B8'} size="sm" />
          </button>
        ))}
      </div>
    </Sheet>
  )
}

/** حذف دسته؛ اگر در تراکنش‌ها استفاده شده باشد، کاربر دستهٔ جایگزین را انتخاب می‌کند */
function CategoryDelete({ cat, onClose }: { cat: Category; onClose: () => void }) {
  const store = useStore()
  const ui = useUI()
  const used = store.transactions.filter((t) => t.categoryId === cat.id).length
  const others = store.categories.filter((c) => c.type === cat.type && c.id !== cat.id && !c.archived)
  const [moveTo, setMoveTo] = useState(others.find((c) => c.order === 99)?.id ?? others[0]?.id ?? '')

  const remove = async () => {
    if (others.length === 0) return ui.toast('حداقل یک دسته باید باقی بماند', 'error')
    try {
      await store.deleteCategory(cat.id, used ? moveTo : undefined)
      ui.toast('دسته حذف شد')
      onClose()
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'خطا', 'error')
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`حذف «${cat.name}»`}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>
            انصراف
          </Button>
          <Button className="flex-1 !bg-red-500 !shadow-none" onClick={remove}>
            <Trash2 size={18} /> حذف دسته
          </Button>
        </div>
      }
    >
      {used > 0 ? (
        <>
          <p className="mb-3 text-[14px] leading-7 text-slate-600 dark:text-slate-300">
            این دسته در <b>{String(used).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])}</b> تراکنش استفاده شده است. این تراکنش‌ها به کدام دسته منتقل شوند؟
          </p>
          <div className="grid grid-cols-2 gap-2">
            {others.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setMoveTo(c.id)}
                className={cx('flex items-center gap-2 rounded-2xl p-2 text-[14px]', moveTo === c.id ? 'bg-white ring-2 ring-brand dark:bg-night-card' : 'bg-white/60 ring-1 ring-slate-200 dark:bg-white/5 dark:ring-white/5')}
              >
                <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                <span className="truncate">{c.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-4 text-[12px] text-slate-400">اگر فقط می‌خواهید دسته در فرم ثبت نمایش داده نشود، به‌جای حذف از «بایگانی» استفاده کنید.</p>
        </>
      ) : (
        <p className="text-[14px] leading-7 text-slate-600 dark:text-slate-300">این دسته در هیچ تراکنشی استفاده نشده و بدون مشکل حذف می‌شود.</p>
      )}
    </Sheet>
  )
}
