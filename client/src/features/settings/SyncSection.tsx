import { AlertTriangle, CloudOff, Database, History, Loader2, RefreshCw } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { useSync } from '../../app/sync-context'
import { useUI } from '../../app/ui-context'
import { Sheet } from '../../components/Sheet'
import { Badge, Button } from '../../components/ui'
import type { ConflictEntry } from '../../data/db'
import { db, useCategoryMap } from '../../data/store'
import { readLocal, resolveKeepBoth, resolveKeepLocal, resolveKeepServer } from '../../data/sync'
import type { Category, Debt, Transaction } from '../../data/types'
import { toFaDigits } from '../../lib/digits'
import { formatDateTime, formatJLong } from '../../lib/jalali'
import { formatNumber } from '../../lib/money'

type RowFn = (p: { icon: ReactNode; tint: string; label: string; value?: ReactNode; onClick?: () => void }) => ReactNode

/** ردیف‌های همگام‌سازی در تنظیمات */
export function SyncSection({ Row }: { Row: RowFn }) {
  const sync = useSync()
  const ui = useUI()
  const [conflictsOpen, setConflictsOpen] = useState(false)
  const paired = sync.state !== 'unpaired'

  const now = async () => {
    try {
      const r = await sync.syncNow()
      if (!r) return
      ui.toast(r.conflicts ? `${toFaDigits(r.conflicts)} تعارض پیدا شد؛ لطفاً بررسی کنید` : 'همگام‌سازی انجام شد', r.conflicts ? 'info' : 'success')
    } catch (e) {
      ui.toast(e instanceof Error ? e.message : 'همگام‌سازی انجام نشد', 'error')
    }
  }

  return (
    <>
      <Row icon={<History size={18} />} tint="#64748B" label="آخرین همگام‌سازی" value={sync.lastSync ? formatDateTime(sync.lastSync) : '—'} />
      <Row icon={<Database size={18} />} tint="#F59E0B" label="تغییرات همگام‌نشده" value={toFaDigits(sync.pending)} />
      {sync.conflicts > 0 && (
        <Row icon={<AlertTriangle size={18} />} tint="#EF4444" label="تعارض‌ها (نیاز به تصمیم شما)" value={<Badge tone="amber">{toFaDigits(sync.conflicts)}</Badge>} onClick={() => setConflictsOpen(true)} />
      )}
      {sync.invalid > 0 && (
        <p className="px-4 py-2 text-[12px] leading-6 text-red-600">{toFaDigits(sync.invalid)} مورد توسط سرور پذیرفته نشد (دادهٔ نامعتبر). لطفاً آن مورد را ویرایش کنید.</p>
      )}
      {sync.state === 'offline' && paired && (
        <p className="flex items-center gap-1.5 px-4 py-2 text-[12px] text-slate-400"><CloudOff size={14} /> سرور در دسترس نیست؛ تغییرات روی همین دستگاه محفوظ‌اند و بعداً ارسال می‌شوند.</p>
      )}
      {sync.state === 'auth' && <p className="px-4 py-2 text-[12px] text-amber-600">کلید این دستگاه معتبر نیست (ممکن است ابطال شده باشد). اتصال را قطع و دوباره برقرار کنید.</p>}
      <div className="p-3">
        <Button variant="secondary" className="w-full" disabled={!paired || sync.state === 'syncing'} onClick={now}>
          {sync.state === 'syncing' ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />} همگام‌سازی اکنون
        </Button>
        {!paired && <p className="mt-2 text-center text-[12px] text-slate-400">برای همگام‌سازی، ابتدا این دستگاه را به سرور لپ‌تاپ وصل کنید.</p>}
      </div>
      {conflictsOpen && <ConflictsSheet onClose={() => setConflictsOpen(false)} />}
    </>
  )
}

const LABEL: Record<ConflictEntry['collection'], string> = { transactions: 'تراکنش', categories: 'دسته‌بندی', debts: 'بدهی/طلب', settings: 'تنظیمات' }

function ConflictsSheet({ onClose }: { onClose: () => void }) {
  const ui = useUI()
  const sync = useSync()
  const cats = useCategoryMap()
  const items = useLiveQuery(async () => {
    const list = await db.conflicts.toArray()
    return Promise.all(list.map(async (c) => ({ c, local: (await readLocal(db, c.collection, c.id)) ?? null })))
  }, [])

  const act = async (fn: (d: typeof db, k: string) => Promise<void>, key: string, msg: string) => {
    await fn(db, key)
    ui.toast(msg)
    sync.syncNow().catch(() => undefined)
  }

  return (
    <Sheet open onClose={onClose} title="تعارض‌ها">
      <p className="mb-4 text-[13px] leading-6 text-slate-500 dark:text-slate-400">
        این موارد هم‌زمان روی این دستگاه و دستگاه دیگری تغییر کرده‌اند. هر دو نسخه نگه داشته شده‌اند؛ انتخاب کنید کدام بماند.
      </p>
      {items?.length === 0 && <p className="py-6 text-center text-slate-400">تعارضی وجود ندارد.</p>}
      <div className="space-y-4">
        {items?.map(({ c, local }) => (
          <div key={c.key} className="rounded-3xl bg-white p-4 shadow-card dark:bg-night-card dark:shadow-none">
            <p className="mb-3 font-title text-[16px]">{LABEL[c.collection]}</p>
            <div className="grid grid-cols-2 gap-2 text-[13px]">
              <Version title="این دستگاه" collection={c.collection} data={local} cats={cats} />
              <Version title="دستگاه دیگر" collection={c.collection} data={c.server && !c.server.deleted ? c.server.data : null} cats={cats} />
            </div>
            <div className="mt-3 grid gap-2">
              <Button className="h-11 text-[14px]" onClick={() => act(resolveKeepLocal, c.key, 'نسخهٔ این دستگاه نگه داشته شد')}>نگه داشتن نسخهٔ این دستگاه</Button>
              <Button variant="secondary" className="h-11 text-[14px]" onClick={() => act(resolveKeepServer, c.key, 'نسخهٔ دستگاه دیگر پذیرفته شد')}>نگه داشتن نسخهٔ دستگاه دیگر</Button>
              {c.collection === 'transactions' && local !== null && c.server && !c.server.deleted && (
                <Button variant="ghost" className="h-11 text-[14px]" onClick={() => act(resolveKeepBoth, c.key, 'هر دو نسخه به‌صورت دو تراکنش نگه داشته شد')}>نگه داشتن هر دو (دو تراکنش جدا)</Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  )
}

function Version({ title, collection, data, cats }: { title: string; collection: ConflictEntry['collection']; data: unknown; cats: Map<string, Category> }) {
  const lines: string[] = (() => {
    if (data === null || data === undefined) return ['حذف شده']
    if (collection === 'transactions') {
      const t = data as Transaction
      return [`${formatNumber(t.amount)} تومان`, t.type === 'income' ? 'درآمد' : 'هزینه', formatJLong(t.date), cats.get(t.categoryId)?.name ?? '', t.note]
    }
    if (collection === 'debts') {
      const d = data as Debt
      const remaining = d.installments.filter((i) => !i.paidDate).reduce((s, i) => s + i.amount, 0)
      return [d.counterparty, `مانده: ${formatNumber(remaining)}`, `${toFaDigits(d.installments.filter((i) => i.paidDate).length)} از ${toFaDigits(d.installments.length)} قسط`]
    }
    if (collection === 'categories') return [(data as Category).name, (data as Category).archived ? 'بایگانی' : '']
    return [`موجودی اولیه: ${formatNumber((data as { openingBalance: number }).openingBalance)}`]
  })()
  return (
    <div className="rounded-2xl bg-slate-50 p-3 dark:bg-white/5">
      <p className="mb-1 text-[11px] font-semibold text-slate-400">{title}</p>
      {lines.filter(Boolean).map((l, i) => (
        <p key={i} className={i === 0 ? 'font-bold' : 'text-slate-500 dark:text-slate-400'}>{l}</p>
      ))}
    </div>
  )
}
