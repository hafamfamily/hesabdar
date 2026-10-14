import { CheckCircle2, KeyRound, Laptop, Link2, Link2Off, Loader2, Server, ShieldCheck, Smartphone, Trash2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useUI } from '../../app/ui-context'
import { Sheet } from '../../components/Sheet'
import { Badge, Button, cx } from '../../components/ui'
import { formatRelativeDay, todayIso } from '../../lib/jalali'
import {
  type DeviceInfo, getPairing, guessDeviceName, health, isOnServerMachine, listDevices, pair, type Pairing, revokeDevice, ServerError,
  setupPassword, unpair,
} from '../../lib/server'

type Status = { kind: 'checking' } | { kind: 'offline' } | { kind: 'online'; needsSetup: boolean; version: string }

const FIELD = 'h-12 w-full rounded-2xl bg-white px-4 ring-1 ring-slate-200 outline-none focus:ring-2 focus:ring-brand dark:bg-night-card dark:ring-white/5'

/** بخش «سرور لپ‌تاپ» در تنظیمات: وضعیت، تعیین گذرواژه (فقط روی لپ‌تاپ)، جفت کردن و مدیریت دستگاه‌ها */
export function ServerSection({ Row }: { Row: (p: { icon: ReactNode; tint: string; label: string; value?: ReactNode; onClick?: () => void }) => ReactNode }) {
  const ui = useUI()
  const [status, setStatus] = useState<Status>({ kind: 'checking' })
  const [pairing, setPairing] = useState<Pairing | undefined>()
  const [sheet, setSheet] = useState<'setup' | 'pair' | 'devices' | null>(null)

  const refresh = useCallback(async () => {
    setStatus({ kind: 'checking' })
    setPairing(await getPairing())
    try {
      const h = await health()
      setStatus({ kind: 'online', needsSetup: h.needsSetup, version: h.version })
    } catch {
      setStatus({ kind: 'offline' })
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const statusValue =
    status.kind === 'checking' ? (
      <Loader2 size={16} className="animate-spin text-slate-400" />
    ) : status.kind === 'offline' ? (
      <Badge>در دسترس نیست</Badge>
    ) : status.needsSetup ? (
      <Badge tone="amber">نیاز به راه‌اندازی</Badge>
    ) : (
      <Badge tone="brand">متصل</Badge>
    )

  const doUnpair = async () => {
    const ok = await ui.confirm({ title: 'قطع اتصال این دستگاه', message: 'داده‌های روی این دستگاه باقی می‌مانند. برای اتصال دوباره به گذرواژهٔ سرور نیاز دارید.', confirmLabel: 'قطع اتصال', danger: true })
    if (!ok) return
    await unpair()
    setPairing(undefined)
    ui.toast('اتصال این دستگاه قطع شد')
  }

  return (
    <>
      <Row icon={<Server size={18} />} tint="#0EA5E9" label="وضعیت سرور لپ‌تاپ" value={statusValue} onClick={refresh} />
      {status.kind === 'offline' && (
        <p className="px-4 pb-3 text-[12px] leading-6 text-slate-400">
          لپ‌تاپ خاموش است، سرور اجرا نشده یا این دستگاه به Wi-Fi خانه وصل نیست. ثبت اطلاعات روی همین دستگاه بدون مشکل ادامه دارد.
        </p>
      )}
      {status.kind === 'online' && status.needsSetup && isOnServerMachine() && (
        <Row icon={<KeyRound size={18} />} tint="#F59E0B" label="تعیین گذرواژهٔ سرور" onClick={() => setSheet('setup')} />
      )}
      {status.kind === 'online' && status.needsSetup && !isOnServerMachine() && (
        <p className="px-4 pb-3 text-[12px] leading-6 text-amber-600">ابتدا روی خود لپ‌تاپ، برنامه را باز کنید و گذرواژهٔ سرور را تعیین کنید.</p>
      )}
      {pairing ? (
        <>
          <Row
            icon={<Link2 size={18} />}
            tint="#10B981"
            label={`این دستگاه: ${pairing.deviceName}`}
            value={<span className="text-[12px]">از {formatRelativeDay(pairing.pairedAt.slice(0, 10), todayIso())}</span>}
          />
          <Row icon={<ShieldCheck size={18} />} tint="#6366F1" label="دستگاه‌های متصل" onClick={() => setSheet('devices')} />
          <Row icon={<Link2Off size={18} />} tint="#94A3B8" label="قطع اتصال این دستگاه" onClick={doUnpair} />
        </>
      ) : (
        status.kind === 'online' &&
        !status.needsSetup && <Row icon={<Link2 size={18} />} tint="#10B981" label="اتصال این دستگاه به سرور" onClick={() => setSheet('pair')} />
      )}

      {sheet === 'setup' && (
        <SetupSheet
          onClose={() => setSheet(null)}
          onDone={() => {
            setSheet('pair')
            refresh()
          }}
        />
      )}
      {sheet === 'pair' && (
        <PairSheet
          onClose={() => setSheet(null)}
          onDone={(p) => {
            setPairing(p)
            setSheet(null)
          }}
        />
      )}
      {sheet === 'devices' && <DevicesSheet onClose={() => setSheet(null)} />}
    </>
  )
}

function SetupSheet({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const ui = useUI()
  const [p1, setP1] = useState('')
  const [p2, setP2] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if ([...p1].length < 8) return setError('گذرواژه باید حداقل ۸ نویسه باشد')
    if (p1 !== p2) return setError('دو گذرواژه یکسان نیستند')
    setBusy(true)
    try {
      await setupPassword(p1)
      ui.toast('گذرواژهٔ سرور تعیین شد')
      onDone()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title="گذرواژهٔ سرور" footer={<Button className="w-full" disabled={busy} onClick={save}>ذخیره</Button>}>
      <p className="mb-4 text-[14px] leading-7 text-slate-500 dark:text-slate-400">
        این گذرواژه فقط یک بار، هنگام اتصال هر دستگاه (مثلاً آیفون) پرسیده می‌شود. آن را جایی امن یادداشت کنید.
      </p>
      <div className="space-y-3">
        <input type="password" autoComplete="new-password" placeholder="گذرواژه (حداقل ۸ نویسه)" value={p1} onChange={(e) => setP1(e.target.value)} className={FIELD} />
        <input type="password" autoComplete="new-password" placeholder="تکرار گذرواژه" value={p2} onChange={(e) => setP2(e.target.value)} className={FIELD} />
      </div>
      {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}
    </Sheet>
  )
}

function PairSheet({ onClose, onDone }: { onClose: () => void; onDone: (p: Pairing) => void }) {
  const ui = useUI()
  const [password, setPassword] = useState('')
  const [name, setName] = useState(guessDeviceName())
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = async () => {
    setBusy(true)
    setError(null)
    try {
      const p = await pair(password, name)
      ui.toast('این دستگاه به سرور متصل شد')
      onDone(p)
    } catch (e) {
      setError(e instanceof ServerError || e instanceof Error ? e.message : 'خطا')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet open onClose={onClose} title="اتصال به سرور لپ‌تاپ" footer={<Button className="w-full" disabled={busy || !password} onClick={go}>اتصال</Button>}>
      <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-500">نام این دستگاه</span>
          <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} className={FIELD} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[13px] font-semibold text-slate-500">گذرواژهٔ سرور</span>
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={FIELD} />
        </label>
      </div>
      {error && <p className="mt-3 text-[14px] text-red-600">{error}</p>}
      <p className="mt-4 text-[12px] leading-6 text-slate-400">گذرواژه روی این دستگاه ذخیره نمی‌شود؛ فقط یک کلید مخصوص این دستگاه نگه داشته می‌شود که از تنظیمات قابل ابطال است.</p>
    </Sheet>
  )
}

function DevicesSheet({ onClose }: { onClose: () => void }) {
  const ui = useUI()
  const [data, setData] = useState<{ devices: DeviceInfo[]; current: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    listDevices()
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'خطا'))
  }, [])
  useEffect(load, [load])

  const revoke = async (d: DeviceInfo) => {
    const ok = await ui.confirm({ title: `ابطال «${d.name}»`, message: 'این دستگاه دیگر نمی‌تواند با سرور همگام شود، مگر دوباره جفت شود.', confirmLabel: 'ابطال', danger: true })
    if (!ok) return
    await revokeDevice(d.id)
    ui.toast('دستگاه ابطال شد')
    load()
  }

  return (
    <Sheet open onClose={onClose} title="دستگاه‌های متصل">
      {error && <p className="flex items-center gap-2 text-[14px] text-red-600"><XCircle size={16} /> {error}</p>}
      {!data && !error && <Loader2 className="mx-auto animate-spin text-slate-400" />}
      {data && (
        <ul className="divide-y divide-slate-100 rounded-3xl bg-white px-3 shadow-card dark:divide-night-line dark:bg-night-card dark:shadow-none">
          {data.devices.map((d) => {
            const Icon = /لپ‌تاپ|ویندوز/.test(d.name) ? Laptop : Smartphone
            const current = d.id === data.current
            return (
              <li key={d.id} className="flex items-center gap-3 py-3">
                <Icon size={20} className="text-slate-400" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {d.name} {current && <CheckCircle2 size={14} className="inline text-brand" />}
                  </span>
                  <span className={cx('block text-[12px] text-slate-400')}>
                    {current ? 'همین دستگاه' : d.lastSeenAt ? `آخرین ارتباط: ${formatRelativeDay(d.lastSeenAt.slice(0, 10), todayIso())}` : 'هنوز ارتباطی نداشته'}
                  </span>
                </span>
                {!current && (
                  <button type="button" onClick={() => revoke(d)} aria-label={`ابطال ${d.name}`} className="grid size-9 place-items-center rounded-full text-red-500 hover:bg-red-50 dark:hover:bg-white/5">
                    <Trash2 size={16} />
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Sheet>
  )
}
