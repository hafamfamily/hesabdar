import {
  ChevronLeft, CloudOff, Database, Download, FileSpreadsheet, Info, Monitor, Moon, RefreshCw, Server, Sun, Tags, Upload, Wallet,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { PageHeader } from '../../app/AppShell'
import { useUI } from '../../app/ui-context'
import { Sheet } from '../../components/Sheet'
import { Badge, Button, cx } from '../../components/ui'
import { useStore } from '../../data/store'
import type { ThemePref } from '../../data/types'
import { amountInWords, formatAmountInput, formatNumber, parseAmount } from '../../lib/money'
import { toEnDigits } from '../../lib/digits'
import { CategoryManager } from './CategoryManager'

export const APP_VERSION = '0.1.0'

export function SettingsPage() {
  const store = useStore()
  const ui = useUI()
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const later = (stage: string) => () => ui.toast(`این قابلیت در ${stage} فعال می‌شود`, 'info')

  return (
    <div>
      <PageHeader title="تنظیمات" />

      <Group title="حساب">
        <Row icon={<Wallet size={18} />} tint="#0F766E" label="موجودی اولیه" value={`${formatNumber(store.settings.openingBalance)} تومان`} onClick={() => setBalanceOpen(true)} />
        <Row icon={<Tags size={18} />} tint="#6366F1" label="مدیریت دسته‌بندی‌ها" onClick={() => setCatsOpen(true)} />
      </Group>

      <Group title="ظاهر">
        <div className="p-3">
          <ThemePicker value={store.settings.theme} onChange={store.setTheme} />
        </div>
      </Group>

      <Group title="سرور و همگام‌سازی">
        <Row icon={<Server size={18} />} tint="#0EA5E9" label="وضعیت سرور" value={<Badge>مرحلهٔ سوم</Badge>} onClick={later('مرحلهٔ سوم')} />
        <Row icon={<CloudOff size={18} />} tint="#64748B" label="آخرین همگام‌سازی" value="—" />
        <Row icon={<Database size={18} />} tint="#F59E0B" label="تغییرات همگام‌نشده" value="—" />
        <div className="p-3">
          <Button variant="secondary" className="w-full" onClick={later('مرحلهٔ چهارم')}>
            <RefreshCw size={18} /> همگام‌سازی اکنون
          </Button>
        </div>
      </Group>

      <Group title="داده‌ها">
        <Row icon={<Download size={18} />} tint="#10B981" label="تهیهٔ نسخهٔ پشتیبان (JSON)" onClick={later('مرحلهٔ پنجم')} />
        <Row icon={<Upload size={18} />} tint="#F97316" label="بازیابی از فایل پشتیبان" onClick={later('مرحلهٔ پنجم')} />
        <Row icon={<FileSpreadsheet size={18} />} tint="#0F766E" label="خروجی Excel / CSV" onClick={later('مرحلهٔ پنجم')} />
      </Group>

      <Group title="درباره">
        <Row icon={<Info size={18} />} tint="#94A3B8" label="نسخهٔ نرم‌افزار" value={<bdi>{toFa(APP_VERSION)}</bdi>} />
      </Group>

      <p className="mt-6 px-2 text-center text-[12px] leading-6 text-slate-400">
        پیش‌نمایش مرحلهٔ اول: داده‌ها نمونه هستند و فقط در حافظهٔ موقت نگه داشته می‌شوند.
        <br />
        ذخیرهٔ دائمی روی دستگاه در مرحلهٔ دوم اضافه می‌شود.
      </p>

      {balanceOpen && <OpeningBalanceSheet onClose={() => setBalanceOpen(false)} />}
      <CategoryManager open={catsOpen} onClose={() => setCatsOpen(false)} />
    </div>
  )
}

const toFa = (s: string) => s.replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[Number(d)])

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5 animate-rise">
      <h2 className="mb-2 px-2 text-[13px] font-semibold text-slate-400">{title}</h2>
      <div className="divide-y divide-slate-100 overflow-hidden rounded-3xl bg-white shadow-card ring-1 ring-slate-900/[0.03] dark:divide-night-line dark:bg-night-card dark:shadow-none dark:ring-white/[0.06]">
        {children}
      </div>
    </section>
  )
}

function Row({ icon, tint, label, value, onClick }: { icon: ReactNode; tint: string; label: string; value?: ReactNode; onClick?: () => void }) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cx('flex min-h-14 w-full items-center gap-3 px-3 text-start', onClick && 'transition active:bg-slate-50 dark:active:bg-white/5')}
    >
      <span className="grid size-9 place-items-center rounded-xl text-white" style={{ background: tint }}>
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-medium">{label}</span>
      {value && <span className="text-[14px] text-slate-400 tabular-nums">{value}</span>}
      {onClick && <ChevronLeft size={18} className="text-slate-300 dark:text-slate-600" />}
    </Tag>
  )
}

function ThemePicker({ value, onChange }: { value: ThemePref; onChange: (t: ThemePref) => void }) {
  const opts: { v: ThemePref; label: string; Icon: typeof Sun }[] = [
    { v: 'system', label: 'خودکار', Icon: Monitor },
    { v: 'light', label: 'روشن', Icon: Sun },
    { v: 'dark', label: 'تاریک', Icon: Moon },
  ]
  return (
    <div className="grid grid-cols-3 gap-2">
      {opts.map(({ v, label, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-pressed={value === v}
          className={cx(
            'flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[13px] font-semibold transition',
            value === v ? 'bg-brand text-white' : 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400',
          )}
        >
          <Icon size={20} />
          {label}
        </button>
      ))}
    </div>
  )
}

function OpeningBalanceSheet({ onClose }: { onClose: () => void }) {
  const store = useStore()
  const ui = useUI()
  const [text, setText] = useState(formatNumber(store.settings.openingBalance))
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    // موجودی اولیه می‌تواند صفر باشد، اما منفی و غیرعددی پذیرفته نمی‌شود
    const raw = toEnDigits(text).replace(/[\s,٬،]/g, '')
    const value = raw === '' || raw === '0' ? 0 : parseAmount(text)
    if (typeof value !== 'number' && !value.ok) return setError(value.error)
    await store.setOpeningBalance(typeof value === 'number' ? value : value.value)
    ui.toast('موجودی اولیه ذخیره شد')
    onClose()
  }

  const parsed = parseAmount(text)
  return (
    <Sheet
      open
      onClose={onClose}
      title="موجودی اولیه"
      footer={
        <Button className="w-full" onClick={save}>
          ذخیره
        </Button>
      }
    >
      <p className="mb-4 text-[14px] leading-7 text-slate-500 dark:text-slate-400">
        مبلغی که هنگام شروع استفاده از برنامه در اختیار داشتید.
        <br />
        <span className="text-[13px]">مانده فعلی = موجودی اولیه + درآمدها − هزینه‌ها</span>
      </p>
      <div className="rounded-3xl bg-white p-4 text-center shadow-card dark:bg-night-card dark:shadow-none">
        <input
          dir="ltr"
          inputMode="numeric"
          autoFocus
          value={text}
          onChange={(e) => {
            setText(formatAmountInput(e.target.value))
            setError(null)
          }}
          placeholder="۰"
          className="w-full bg-transparent text-center text-[30px] font-extrabold tabular-nums text-brand outline-none dark:text-brand-light"
        />
        <p className="min-h-5 text-[13px] text-slate-500">{parsed.ok ? amountInWords(parsed.value) : 'تومان'}</p>
      </div>
      {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}
    </Sheet>
  )
}
