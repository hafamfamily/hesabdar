import { CheckCircle2, AlertCircle, Info } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import type { Transaction } from '../data/types'
import { Button } from '../components/ui'
import { TransactionForm } from '../features/transactions/TransactionForm'

type ToastKind = 'success' | 'error' | 'info'
interface ConfirmOpts {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

interface UI {
  toast(message: string, kind?: ToastKind): void
  confirm(opts: ConfirmOpts): Promise<boolean>
  openTxForm(tx?: Transaction): void
}

const Ctx = createContext<UI | null>(null)

export function UIProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ id: number; message: string; kind: ToastKind } | null>(null)
  const [confirmState, setConfirmState] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const [form, setForm] = useState<{ open: boolean; tx?: Transaction; key: number }>({ open: false, key: 0 })
  const timer = useRef<number | undefined>(undefined)

  const showToast = useCallback((message: string, kind: ToastKind = 'success') => {
    window.clearTimeout(timer.current)
    setToast({ id: Date.now(), message, kind })
    timer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  // شبکهٔ ایمنی: هر خطای پیش‌بینی‌نشده در ذخیره‌سازی به کاربر نمایش داده شود، نه اینکه بی‌صدا گم شود
  useEffect(() => {
    const on = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : 'خطای ناشناخته'
      showToast(msg, 'error')
    }
    window.addEventListener('unhandledrejection', on)
    return () => window.removeEventListener('unhandledrejection', on)
  }, [showToast])

  const confirm = useCallback(
    (opts: ConfirmOpts) => new Promise<boolean>((resolve) => setConfirmState({ ...opts, resolve })),
    [],
  )

  const openTxForm = useCallback((tx?: Transaction) => setForm((f) => ({ open: true, tx, key: f.key + 1 })), [])
  const closeForm = useCallback(() => setForm((f) => ({ ...f, open: false })), [])

  const close = (v: boolean) => {
    confirmState?.resolve(v)
    setConfirmState(null)
  }

  // کلید Escape (و دکمهٔ بازگشت اندروید) پنجرهٔ تأیید را می‌بندد
  useEffect(() => {
    if (!confirmState) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopImmediatePropagation()
      confirmState.resolve(false)
      setConfirmState(null)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [confirmState])

  const ToastIcon = toast?.kind === 'error' ? AlertCircle : toast?.kind === 'info' ? Info : CheckCircle2

  return (
    <Ctx.Provider value={{ toast: showToast, confirm, openTxForm }}>
      {children}

      <TransactionForm key={form.key} open={form.open} tx={form.tx} onClose={closeForm} />

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),12px)] z-[70] flex justify-center px-4">
          <div
            key={toast.id}
            role="status"
            className="flex animate-pop items-center gap-2 rounded-2xl bg-ink px-4 py-3 text-[14px] font-medium text-white shadow-xl dark:bg-slate-800"
          >
            <ToastIcon size={18} className={toast.kind === 'error' ? 'text-expense' : toast.kind === 'info' ? 'text-sky-300' : 'text-income'} />
            {toast.message}
          </div>
        </div>
      )}

      {confirmState && (
        <div className="fixed inset-0 z-[60] grid place-items-center p-6" role="alertdialog" aria-modal="true">
          <div className="absolute inset-0 animate-fade-in bg-slate-900/50" onClick={() => close(false)} />
          <div className="relative w-full max-w-xs animate-pop rounded-3xl bg-white p-5 text-center dark:bg-night-card">
            <h3 className="text-[17px] font-bold">{confirmState.title}</h3>
            {confirmState.message && <p className="mt-2 text-[14px] leading-6 text-slate-500 dark:text-slate-400">{confirmState.message}</p>}
            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => close(false)}>
                انصراف
              </Button>
              <Button
                variant={confirmState.danger ? 'danger' : 'primary'}
                className={confirmState.danger ? '!bg-red-500 !text-white' : ''}
                onClick={() => close(true)}
              >
                {confirmState.confirmLabel ?? 'تأیید'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  )
}

export function useUI(): UI {
  const u = useContext(Ctx)
  if (!u) throw new Error('useUI must be used inside UIProvider')
  return u
}
