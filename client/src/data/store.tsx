import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { applyFonts, CUSTOM_FAMILY, isCustomFontLoaded, loadFontData } from '../lib/fonts'
import { AppDB } from './db'
import * as repo from './repo'
import type { BackupFile } from '../lib/backup'
import type { Category, Debt, DebtInput, FontSettings, ReminderSettings, Settings, ThemePref, Transaction, TxInput } from './types'

/**
 * لایهٔ داده — مرحلهٔ دوم.
 * منبع حقیقت روی دستگاه، پایگاه IndexedDB است. صفحات داده را به‌صورت زنده (liveQuery) می‌خوانند؛
 * پس هر تغییر بلافاصله در همهٔ صفحات و حتی تب‌های دیگر دیده می‌شود.
 * همهٔ نوشتن‌ها از repo.ts عبور می‌کنند (اعتبارسنجی + تراکنش اتمی).
 */

export const db = new AppDB()

interface Store {
  transactions: Transaction[]
  categories: Category[]
  debts: Debt[]
  settings: Settings
  persisted?: boolean
  addTransaction(input: TxInput): Promise<Transaction>
  updateTransaction(id: string, input: TxInput): Promise<void>
  deleteTransaction(id: string): Promise<void>
  saveCategory(cat: Omit<Category, 'id' | 'order'> & { id?: string }): Promise<void>
  /** حذف دسته؛ اگر تراکنشی از آن استفاده می‌کند، باید moveTo داده شود */
  deleteCategory(id: string, moveTo?: string): Promise<void>
  addDebt(input: DebtInput): Promise<Debt>
  updateDebt(id: string, patch: repo.DebtPatch): Promise<void>
  deleteDebt(id: string): Promise<void>
  /**
   * ثبت پرداخت قسط. اگر مبلغ کمتر از قسط باشد، باقی‌مانده به‌صورت قسط جدید با همان سررسید باقی می‌ماند.
   * اگر recordAsTx باشد، پرداخت در گزارش هزینه/درآمد هم ثبت می‌شود (و فقط از همان راه روی موجودی اثر می‌گذارد).
   */
  markInstallmentPaid(debtId: string, installmentId: string, opts: repo.PayOptions): Promise<void>
  /** لغو پرداخت قسط؛ تراکنش مرتبط (اگر باشد) هم حذف می‌شود */
  markInstallmentUnpaid(debtId: string, installmentId: string): Promise<void>
  setOpeningBalance(v: number): Promise<void>
  setReminders(patch: Partial<ReminderSettings>): Promise<void>
  setTheme(t: ThemePref): void
  setFonts(patch: Partial<FontSettings>): Promise<void>
  saveCustomFont(name: string, data: ArrayBuffer): Promise<void>
  loadSampleData(): Promise<void>
  exportBackup(appVersion: string): Promise<BackupFile>
  restoreBackup(b: BackupFile): Promise<void>
  wipeAll(): Promise<void>
}

const Ctx = createContext<Store | null>(null)

/** تم در localStorage هم نگه داشته می‌شود تا پیش از بارگذاری پایگاه داده (بدون چشمک) اعمال شود */
function readTheme(): ThemePref {
  try {
    const v = localStorage.getItem('dk-theme')
    if (v === 'light' || v === 'dark' || v === 'system') return v
  } catch {
    /* حافظهٔ مرورگر در دسترس نیست */
  }
  return 'system'
}

type Boot = { state: 'loading' } | { state: 'ready' } | { state: 'error'; message: string }

export function StoreProvider({ children }: { children: ReactNode }) {
  const [boot, setBoot] = useState<Boot>({ state: 'loading' })
  const [theme, setThemeState] = useState<ThemePref>(readTheme)
  const [persisted, setPersisted] = useState<boolean | undefined>()
  const [fontReady, setFontReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        await db.open()
        await repo.ensureSeeded(db)
        const font = await repo.getCustomFont(db)
        if (font) {
          try {
            await loadFontData(font.data)
          } catch {
            /* فایل فونت خراب است؛ از فونت پیش‌فرض استفاده می‌شود */
          }
        }
        if (cancelled) return
        setFontReady(true)
        setBoot({ state: 'ready' })
        setPersisted(await repo.requestPersistence())
      } catch (e) {
        if (!cancelled) setBoot({ state: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const ready = boot.state === 'ready'
  const transactions = useLiveQuery<Transaction[] | undefined>(() => (ready ? db.transactions.toArray() : Promise.resolve(undefined)), [ready])
  const categories = useLiveQuery<Category[] | undefined>(() => (ready ? db.categories.toArray() : Promise.resolve(undefined)), [ready])
  const debts = useLiveQuery<Debt[] | undefined>(() => (ready ? db.debts.toArray() : Promise.resolve(undefined)), [ready])
  const stored = useLiveQuery<repo.StoredSettings | undefined>(() => (ready ? repo.getSettings(db) : Promise.resolve(undefined)), [ready])

  const settings: Settings | undefined = useMemo(() => (stored ? { ...stored, theme } : undefined), [stored, theme])

  // اعمال فونت
  useEffect(() => {
    if (settings && fontReady) applyFonts(settings.fonts, isCustomFontLoaded())
  }, [settings, fontReady])

  // اعمال تم
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      // اگر میزبان (مثلاً قاب پیش‌نمایش) تم را با data-theme تعیین کرده باشد، در حالت «خودکار» از آن پیروی می‌شود
      const hostTheme = document.documentElement.getAttribute('data-theme')
      const systemDark = hostTheme ? hostTheme === 'dark' : mq.matches
      const dark = theme === 'dark' || (theme === 'system' && systemDark)
      document.documentElement.classList.toggle('dark', dark)
      document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute('content', dark ? '#0B1120' : '#F8FAFC'))
    }
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [theme])

  const setTheme = useCallback((t: ThemePref) => {
    try {
      localStorage.setItem('dk-theme', t)
    } catch {
      /* نادیده */
    }
    setThemeState(t)
  }, [])

  const value = useMemo<Store | null>(() => {
    if (!transactions || !categories || !debts || !settings) return null
    return {
      transactions,
      categories,
      debts,
      settings,
      persisted,
      addTransaction: (i) => repo.addTransaction(db, i),
      updateTransaction: (id, i) => repo.updateTransaction(db, id, i),
      deleteTransaction: (id) => repo.deleteTransaction(db, id),
      saveCategory: (c) => repo.saveCategory(db, c),
      deleteCategory: (id, moveTo) => repo.deleteCategory(db, id, moveTo),
      addDebt: (i) => repo.addDebt(db, i),
      updateDebt: (id, p) => repo.updateDebt(db, id, p),
      deleteDebt: (id) => repo.deleteDebt(db, id),
      markInstallmentPaid: (d, i, o) => repo.markInstallmentPaid(db, d, i, o),
      markInstallmentUnpaid: (d, i) => repo.markInstallmentUnpaid(db, d, i),
      setOpeningBalance: (v) => {
        if (!Number.isSafeInteger(v) || v < 0) return Promise.reject(new Error('موجودی اولیه نامعتبر است'))
        return repo.patchSettings(db, { openingBalance: v })
      },
      setReminders: (p) => repo.patchSettings(db, { reminders: { ...settings.reminders, ...p } }),
      setTheme,
      setFonts: (p) => repo.patchSettings(db, { fonts: { ...settings.fonts, ...p } }),
      saveCustomFont: (name, data) => repo.saveCustomFont(db, name, data),
      loadSampleData: () => repo.loadSampleData(db),
      exportBackup: (v) => repo.exportBackup(db, v),
      restoreBackup: (b) => repo.restoreBackup(db, b),
      wipeAll: async () => {
        await repo.wipeAll(db)
        for (const f of [...document.fonts]) if (f.family.replace(/"/g, '') === CUSTOM_FAMILY) document.fonts.delete(f)
      },
    }
  }, [transactions, categories, debts, settings, persisted, setTheme])

  if (boot.state === 'error') return <BootError message={boot.message} />
  if (!value) return <Splash />
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center">
      <div className="size-10 animate-pulse rounded-2xl bg-brand/30" aria-label="در حال بارگذاری" />
    </div>
  )
}

function BootError({ message }: { message: string }) {
  return (
    <div className="mx-auto grid min-h-dvh max-w-sm place-items-center p-6 text-center">
      <div>
        <h1 className="font-title text-[22px]">حافظهٔ دستگاه در دسترس نیست</h1>
        <p className="mt-3 text-[14px] leading-7 text-slate-500">
          برنامه نتوانست پایگاه دادهٔ محلی را باز کند. اگر از حالت خصوصی (Private) مرورگر استفاده می‌کنید، آن را خاموش کنید و دوباره امتحان کنید.
        </p>
        <p dir="ltr" className="mt-3 break-all text-[11px] text-slate-400">
          {message}
        </p>
        <button type="button" onClick={() => location.reload()} className="mt-5 h-11 rounded-2xl bg-brand px-6 font-semibold text-white">
          تلاش دوباره
        </button>
      </div>
    </div>
  )
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore must be used inside StoreProvider')
  return s
}

/** دسته‌بندی‌های فعال یک نوع، مرتب‌شده */
export function useCategories(type?: Category['type'], includeArchived = false) {
  const { categories } = useStore()
  return useMemo(
    () =>
      categories
        .filter((c) => (!type || c.type === type) && (includeArchived || !c.archived))
        .sort((a, b) => a.order - b.order),
    [categories, type, includeArchived],
  )
}

export function useCategoryMap() {
  const { categories } = useStore()
  return useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
}
