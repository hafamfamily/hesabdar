import { Download, FileSpreadsheet, HardDriveDownload, Loader2, Upload } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useSync } from '../../app/sync-context'
import { useUI } from '../../app/ui-context'
import { Badge } from '../../components/ui'
import { useStore } from '../../data/store'
import { parseBackup, summarizeBackup } from '../../lib/backup'
import { transactionsCsv } from '../../lib/csv'
import { toFaDigits } from '../../lib/digits'
import { fileStamp, saveFile } from '../../lib/download'
import { formatDateTime, toJ, todayIso } from '../../lib/jalali'
import { serverBackupNow, serverStatus } from '../../lib/server'

type RowFn = (p: { icon: ReactNode; tint: string; label: string; value?: ReactNode; onClick?: () => void }) => ReactNode

const stamp = () => {
  const { jy, jm, jd } = toJ(todayIso())
  return fileStamp(jy, jm, jd)
}

/** پشتیبان‌گیری، بازیابی و خروجی CSV */
export function DataSection({ Row, appVersion }: { Row: RowFn; appVersion: string }) {
  const store = useStore()
  const ui = useUI()
  const sync = useSync()
  const fileRef = useRef<HTMLInputElement>(null)
  const [serverBusy, setServerBusy] = useState(false)
  const [lastServerBackup, setLastServerBackup] = useState<string | null | undefined>()

  const backup = async () => {
    const b = await store.exportBackup(appVersion)
    const r = await saveFile(`dakhl-o-kharj-backup-${stamp()}.json`, JSON.stringify(b, null, 1), 'application/json')
    if (r !== 'cancelled') ui.toast(r === 'shared' ? 'در پنجرهٔ باز شده «Save to Files» را بزنید' : 'فایل پشتیبان ذخیره شد')
  }

  const restore = async (file?: File) => {
    if (fileRef.current) fileRef.current.value = ''
    if (!file) return
    if (file.size > 50 * 1024 * 1024) return ui.toast('فایل بیش از حد بزرگ است', 'error')
    const check = parseBackup(await file.text())
    if (!check.ok) return ui.toast(check.error, 'error')
    const s = summarizeBackup(check.backup)
    const ok = await ui.confirm({
      title: 'جایگزینی داده‌ها',
      message: `همهٔ داده‌های فعلی این دستگاه با این پشتیبان (${formatDateTime(s.exportedAt)}) جایگزین می‌شود: ${toFaDigits(s.transactions)} تراکنش، ${toFaDigits(s.debts)} بدهی/طلب و ${toFaDigits(s.categories)} دسته.${sync.state !== 'unpaired' ? ' این تغییر به سرور و دستگاه‌های دیگر هم منتقل می‌شود.' : ''} پیشنهاد می‌شود اول از وضعیت فعلی پشتیبان بگیرید.`,
      confirmLabel: 'بازیابی',
      danger: true,
    })
    if (!ok) return
    try {
      await store.restoreBackup(check.backup)
      ui.toast('اطلاعات از فایل پشتیبان بازیابی شد')
    } catch (e) {
      ui.toast(e instanceof Error ? `بازیابی انجام نشد: ${e.message}` : 'بازیابی انجام نشد', 'error')
    }
  }

  const csv = async () => {
    const r = await saveFile(`dakhl-o-kharj-${stamp()}.csv`, transactionsCsv(store.transactions, store.categories), 'text/csv;charset=utf-8')
    if (r !== 'cancelled') ui.toast(`${toFaDigits(store.transactions.length)} تراکنش در فایل CSV ذخیره شد`)
  }

  const serverBackup = async () => {
    setServerBusy(true)
    try {
      const r = await serverBackupNow()
      setLastServerBackup(r.at)
      ui.toast('پشتیبان روی لپ‌تاپ ذخیره شد')
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'خطا', 'error')
    } finally {
      setServerBusy(false)
    }
  }

  const paired = sync.state !== 'unpaired'
  useEffect(() => {
    if (!paired) return
    serverStatus()
      .then((s) => setLastServerBackup(s.lastBackup?.at ?? null))
      .catch(() => undefined)
  }, [paired])

  return (
    <>
      <Row icon={<Download size={18} />} tint="#10B981" label="تهیهٔ نسخهٔ پشتیبان (JSON)" onClick={backup} />
      <Row icon={<Upload size={18} />} tint="#F97316" label="بازیابی از فایل پشتیبان" onClick={() => fileRef.current?.click()} />
      <input id="restorefile" ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => restore(e.target.files?.[0])} />
      <Row icon={<FileSpreadsheet size={18} />} tint="#0F766E" label="خروجی Excel / CSV (همهٔ تراکنش‌ها)" onClick={csv} />
      {paired && (
        <Row
          icon={serverBusy ? <Loader2 size={18} className="animate-spin" /> : <HardDriveDownload size={18} />}
          tint="#6366F1"
          label="پشتیبان روی لپ‌تاپ (اکنون)"
          value={lastServerBackup ? <span className="text-[12px]">{formatDateTime(lastServerBackup)}</span> : <Badge>—</Badge>}
          onClick={serverBusy ? undefined : serverBackup}
        />
      )}
    </>
  )
}
