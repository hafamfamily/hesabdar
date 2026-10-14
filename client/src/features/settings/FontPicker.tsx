import { Check, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { useUI } from '../../app/ui-context'
import { cx } from '../../components/ui'
import { useStore } from '../../data/store'
import { BODY_FONTS, CUSTOM_FAMILY, isCustomFontLoaded, loadCustomFont, TITLE_FONTS } from '../../lib/fonts'

const SAMPLE = 'خرید منزل · ۱۲٬۵۰۰٬۰۰۰ تومان'

export function FontPicker() {
  const { settings, setFonts } = useStore()
  const ui = useUI()
  const f = settings.fonts
  const fileRef = useRef<HTMLInputElement>(null)
  const [custom, setCustom] = useState(isCustomFontLoaded() ? f.customName : undefined)
  const [target, setTarget] = useState<'body' | 'title'>('body')

  const pickFile = (t: 'body' | 'title') => {
    setTarget(t)
    fileRef.current?.click()
  }

  const onFile = async (file?: File) => {
    if (!file) return
    try {
      await loadCustomFont(file)
      setCustom(file.name)
      setFonts({ customName: file.name, [target]: 'custom' })
      ui.toast('فونت بارگذاری شد')
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'خطا در بارگذاری فونت', 'error')
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4 p-3">
      <div>
        <p className="mb-2 px-1 text-[13px] font-semibold text-slate-500">فونت متن</p>
        <div className="space-y-2">
          {BODY_FONTS.map((b) => (
            <Option key={b.id} active={f.body === b.id} onClick={() => setFonts({ body: b.id })} name={b.name} note={b.note} family={b.family} />
          ))}
          {custom && <Option active={f.body === 'custom'} onClick={() => setFonts({ body: 'custom' })} name={custom} note="فونت شما" family={`"${CUSTOM_FAMILY}"`} />}
        </div>
      </div>
      <div>
        <p className="mb-2 px-1 text-[13px] font-semibold text-slate-500">فونت تیترها و مبلغ اصلی</p>
        <div className="space-y-2">
          {TITLE_FONTS.map((t) => (
            <Option
              key={t.id}
              active={f.title === t.id}
              onClick={() => setFonts({ title: t.id })}
              name={t.name}
              note={t.note}
              family={t.family}
              weight={t.weight}
              sample="دخل‌وخرج من"
            />
          ))}
          {custom && <Option active={f.title === 'custom'} onClick={() => setFonts({ title: 'custom' })} name={custom} note="فونت شما" family={`"${CUSTOM_FAMILY}"`} weight={700} sample="دخل‌وخرج من" />}
        </div>
      </div>

      <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
        <p className="text-[13px] font-semibold">فونت‌های B (نازنین، میترا، تیتر، یکان)</p>
        <p className="mt-1 text-[12px] leading-6 text-slate-500 dark:text-slate-400">
          این فونت‌ها مجوز انتشار آزاد ندارند و نمی‌توان آن‌ها را داخل برنامه قرار داد. اگر فایل آن‌ها را دارید (مثلاً BNazanin.ttf)، از اینجا بارگذاری کنید.
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => pickFile('body')} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-[13px] font-semibold text-brand ring-1 ring-slate-200 dark:bg-night-card dark:text-brand-light dark:ring-white/5">
            <Upload size={15} /> برای متن
          </button>
          <button type="button" onClick={() => pickFile('title')} className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-white text-[13px] font-semibold text-brand ring-1 ring-slate-200 dark:bg-night-card dark:text-brand-light dark:ring-white/5">
            <Upload size={15} /> برای تیتر
          </button>
        </div>
        <input id="fontfile" ref={fileRef} type="file" accept=".ttf,.otf,.woff,.woff2" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <p className="mt-2 text-[11px] text-slate-400">در پیش‌نمایش فعلی، فونت بارگذاری‌شده با بستن صفحه حذف می‌شود؛ ذخیرهٔ دائمی در مرحلهٔ دوم.</p>
      </div>
    </div>
  )
}

function Option({
  active,
  onClick,
  name,
  note,
  family,
  weight,
  sample = SAMPLE,
}: {
  active: boolean
  onClick: () => void
  name: string
  note: string
  family?: string
  weight?: number
  sample?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        'flex w-full items-center gap-3 rounded-2xl p-3 text-start transition',
        active ? 'bg-brand/10 ring-2 ring-brand dark:bg-brand-light/10 dark:ring-brand-light' : 'bg-slate-50 dark:bg-white/5',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[18px]" style={{ fontFamily: family ? `${family}, var(--app-font)` : 'var(--app-font)', fontWeight: weight ?? 500 }}>
          {sample}
        </span>
        <span className="block text-[12px] text-slate-400">
          {name}
          {note && ` · ${note}`}
        </span>
      </span>
      {active && (
        <span className="grid size-6 place-items-center rounded-full bg-brand text-white">
          <Check size={14} strokeWidth={3} />
        </span>
      )}
    </button>
  )
}
