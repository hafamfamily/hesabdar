import {
  Bell, BellRing, CalendarPlus, ChevronLeft, HardDrive, Trash2, Info, Monitor, Moon, Sun, Tags, Wallet,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { PageHeader } from '../../app/AppShell'
import { useUI } from '../../app/ui-context'
import { Sheet } from '../../components/Sheet'
import { Badge, Button, cx } from '../../components/ui'
import { useStore } from '../../data/store'
import type { ThemePref } from '../../data/types'
import { amountInWords, formatAmountInput, formatNumber, parseAmount } from '../../lib/money'
import { toEnDigits } from '../../lib/digits'
import { CategoryManager } from './CategoryManager'
import { isNative } from '../../lib/platform'
import { nativePermission } from '../../lib/nativeReminders'
import { FontPicker } from './FontPicker'
import { ServerSection } from './ServerSection'
import { SyncSection } from './SyncSection'
import { DataSection } from './DataSection'
import { Toggle } from '../debts/DebtForm'
import { buildIcs } from '../../lib/debts'
import { notificationSupport, requestNotificationPermission } from '../../lib/reminders'
import { saveFile } from '../../lib/download'

export const APP_VERSION = '0.5.0'

export function SettingsPage() {
  const store = useStore()
  const ui = useUI()
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [catsOpen, setCatsOpen] = useState(false)
  const [perm, setPerm] = useState<string>(isNative ? 'default' : notificationSupport())
  useEffect(() => {
    if (isNative) nativePermission().then(setPerm).catch(() => undefined)
  }, [])
  const notifHint = isNative
    ? perm === 'denied'
      ? 'اجازهٔ اعلان رد شده است؛ از تنظیمات اندروید ← برنامه‌ها ← دخل‌وخرج ← اعلان‌ها فعال کنید'
      : 'ساعت ۹ صبحِ روز یادآوری، حتی وقتی برنامه بسته است'
    : perm === 'unsupported'
      ? 'در این مرورگر پشتیبانی نمی‌شود؛ ابتدا برنامه را به صفحهٔ اصلی آیفون اضافه کنید'
      : perm === 'denied'
        ? 'اجازه رد شده است؛ از تنظیمات آیفون فعال کنید'
        : 'هنگام باز کردن برنامه، اقساط نزدیک اعلام می‌شوند'
  const toggleSystemNotif = async (v: boolean) => {
    if (!v) return store.setReminders({ systemNotifications: false })
    const p = perm === 'granted' ? 'granted' : isNative ? await nativePermission(true) : await requestNotificationPermission()
    setPerm(p)
    if (p === 'granted') {
      await store.setReminders({ systemNotifications: true })
      ui.toast('اعلان سیستمی فعال شد')
    } else ui.toast(p === 'unsupported' ? 'این دستگاه/مرورگر از اعلان وب پشتیبانی نمی‌کند' : 'اجازهٔ اعلان داده نشد', 'error')
  }
  const wipe = async () => {
    const ok = await ui.confirm({
      title: 'حذف همهٔ داده‌ها',
      message: isNative
        ? 'همهٔ تراکنش‌ها، بدهی‌ها و تنظیمات از این گوشی پاک می‌شوند. اگر نسخهٔ پشتیبان ندارید، ابتدا از «تهیهٔ نسخهٔ پشتیبان» استفاده کنید. این کار برگشت‌پذیر نیست.'
        : 'همهٔ داده‌های این دستگاه پاک و اتصال آن به سرور قطع می‌شود. داده‌های روی سرور لپ‌تاپ حذف نمی‌شوند و با اتصال دوباره برمی‌گردند. داده‌هایی که هنوز همگام نشده‌اند از بین می‌روند.',
      confirmLabel: 'حذف همه',
      danger: true,
    })
    if (!ok) return
    try {
      await store.wipeAll()
      ui.toast('همهٔ داده‌ها حذف شد')
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'خطا', 'error')
    }
  }

  return (
    <div>
      <PageHeader title="تنظیمات" />

      <Group title="حساب">
        <Row icon={<Wallet size={18} />} tint="#0F766E" label="موجودی اولیه" value={`${formatNumber(store.settings.openingBalance)} تومان`} onClick={() => setBalanceOpen(true)} />
        <Row icon={<Tags size={18} />} tint="#6366F1" label="مدیریت دسته‌بندی‌ها" onClick={() => setCatsOpen(true)} />
      </Group>

      <Group title="یادآوری اقساط">
        <ToggleRow
          icon={<Bell size={18} />}
          tint="#F59E0B"
          label="یادآوری داخل برنامه"
          hint="نمایش اقساط نزدیک و نشان عددی روی آیکون"
          checked={store.settings.reminders.enabled}
          onChange={(v) => store.setReminders({ enabled: v })}
        />
        <ToggleRow
          icon={<BellRing size={18} />}
          tint="#EF4444"
          label="اعلان سیستمی"
          hint={notifHint}
          checked={store.settings.reminders.systemNotifications}
          onChange={toggleSystemNotif}
        />
        {!isNative && <Row
          icon={<CalendarPlus size={18} />}
          tint="#6366F1"
          label="افزودن همهٔ سررسیدها به تقویم"
          onClick={() => {
            const ics = buildIcs(store.debts.filter((d) => d.reminder.enabled), formatNumber)
            if (!ics.includes('BEGIN:VEVENT')) return ui.toast('قسط پرداخت‌نشده‌ای با یادآوری فعال وجود ندارد', 'info')
            saveFile('aqsat.ics', ics, 'text/calendar')
          }}
        />}
      </Group>

      <Group title="ظاهر">
        <div className="p-3">
          <ThemePicker value={store.settings.theme} onChange={store.setTheme} />
        </div>
      </Group>

      <Group title="فونت">
        <FontPicker />
      </Group>

      {/* نسخهٔ اندروید مستقل است و به سرور لپ‌تاپ وصل نمی‌شود */}
      {!isNative && (
        <Group title="سرور لپ‌تاپ و همگام‌سازی">
          <ServerSection Row={Row} />
          <SyncSection Row={Row} />
        </Group>
      )}

      <Group title="داده‌ها">
        <DataSection Row={Row} appVersion={APP_VERSION} />
        <Row
          icon={<HardDrive size={18} />}
          tint="#64748B"
          label="ذخیره روی این دستگاه"
          value={store.persisted ? <Badge tone="brand">ماندگار</Badge> : <Badge>عادی</Badge>}
          onClick={() =>
            ui.toast(
              store.persisted ? 'مرورگر اجازهٔ ذخیرهٔ ماندگار داده است' : 'مرورگر هنوز ذخیرهٔ ماندگار را تأیید نکرده؛ برنامه را به صفحهٔ اصلی اضافه کنید',
              'info',
            )
          }
        />
        <Row icon={<Trash2 size={18} />} tint="#EF4444" label="حذف همهٔ داده‌های این دستگاه" onClick={wipe} />
      </Group>

      <Group title="درباره">
        <Row icon={<Info size={18} />} tint="#94A3B8" label="نسخهٔ نرم‌افزار" value={<bdi>{toFa(APP_VERSION)}</bdi>} />
      </Group>

      <p className="mt-6 px-2 text-center text-[12px] leading-6 text-slate-400">
        همهٔ داده‌ها فقط روی همین دستگاه ذخیره می‌شوند و بدون اینترنت هم در دسترس‌اند.
        <br />
        همگام‌سازی با لپ‌تاپ و پشتیبان‌گیری در مراحل بعد اضافه می‌شوند.
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
      {value && <span className="text-[14px] text-slate-400">{value}</span>}
      {onClick && <ChevronLeft size={18} className="text-slate-300 dark:text-slate-600" />}
    </Tag>
  )
}

function ToggleRow({ icon, tint, label, hint, checked, onChange }: { icon: ReactNode; tint: string; label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-14 items-center gap-3 px-3 py-2">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: tint }}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium">{label}</span>
        {hint && <span className="block text-[12px] leading-5 text-slate-400">{hint}</span>}
      </span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
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
    try {
      await store.setOpeningBalance(typeof value === 'number' ? value : value.value)
      ui.toast('موجودی اولیه ذخیره شد')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا در ذخیره')
    }
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
          className="w-full bg-transparent text-center text-[30px] font-extrabold text-brand outline-none dark:text-brand-light"
        />
        <p className="min-h-5 text-[13px] text-slate-500">{parsed.ok ? amountInWords(parsed.value) : 'تومان'}</p>
      </div>
      {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}
    </Sheet>
  )
}
