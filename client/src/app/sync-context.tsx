import { useLiveQuery } from 'dexie-react-hooks'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { db } from '../data/store'
import { syncOnce, SyncHttpError, type SyncSummary } from '../data/sync'
import type { Pairing } from '../lib/server'

/**
 * کنترل همگام‌سازی خودکار.
 * فقط وقتی برنامه باز است اجرا می‌شود (Safari همگام‌سازی پس‌زمینه را تضمین نمی‌کند):
 *  هنگام باز شدن، بازگشت به برنامه، وصل شدن شبکه، چند ثانیه پس از هر تغییر، جابه‌جایی بین صفحه‌ها، و هر ۳۰ ثانیه.
 */

export type SyncState = 'unpaired' | 'idle' | 'syncing' | 'offline' | 'auth' | 'error'

interface SyncCtx {
  state: SyncState
  pending: number
  conflicts: number
  invalid: number
  lastSync?: string
  lastError?: string
  syncNow(): Promise<SyncSummary | undefined>
}

const Ctx = createContext<SyncCtx | null>(null)

export function SyncProvider({ children }: { children: ReactNode }) {
  const pairing = useLiveQuery(async () => (await db.kv.get('server-pairing'))?.value as Pairing | undefined, [], null)
  const pending = useLiveQuery(() => db.outbox.where('conflict').equals(0).count(), [], 0)
  const conflicts = useLiveQuery(() => db.conflicts.count(), [], 0)
  const invalid = useLiveQuery(() => db.outbox.filter((m) => !!m.error).count(), [], 0)
  const lastSync = useLiveQuery(async () => (await db.kv.get('last-sync'))?.value as string | undefined, [], undefined)
  const [state, setState] = useState<SyncState>('idle')
  const [lastError, setLastError] = useState<string>()
  const running = useRef(false)
  const again = useRef(false)

  const run = useCallback(async (): Promise<SyncSummary | undefined> => {
    if (!pairing) return undefined
    if (running.current) {
      again.current = true
      return undefined
    }
    running.current = true
    setState('syncing')
    const doSync = () => syncOnce(db, { token: pairing.token })
    try {
      let summary: SyncSummary | undefined
      do {
        again.current = false
        // جلوگیری از اجرای هم‌زمان در چند تب
        summary = navigator.locks ? await navigator.locks.request('dk-sync', doSync) : await doSync()
      } while (again.current)
      setState('idle')
      setLastError(undefined)
      return summary
    } catch (e) {
      const err = e instanceof SyncHttpError ? e : undefined
      setState(err?.status === 0 ? 'offline' : err?.status === 401 ? 'auth' : 'error')
      setLastError(e instanceof Error ? e.message : String(e))
      throw e
    } finally {
      running.current = false
    }
  }, [pairing])

  const quiet = useCallback(() => run().catch(() => undefined), [run])

  // شروع، بازگشت به برنامه، وصل شدن شبکه، و تناوبی
  useEffect(() => {
    if (!pairing) return
    quiet()
    const onVisible = () => document.visibilityState === 'visible' && quiet()
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', quiet)
    const timer = setInterval(() => document.visibilityState === 'visible' && quiet(), 30_000)
    // جابه‌جایی بین صفحه‌های برنامه هم (حداکثر هر ۱۰ ثانیه یک بار) تغییرات تازه را می‌گیرد
    let lastNav = 0
    const onNav = () => {
      if (Date.now() - lastNav < 10_000) return
      lastNav = Date.now()
      quiet()
    }
    window.addEventListener('hashchange', onNav)
    return () => {
      window.removeEventListener('hashchange', onNav)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', quiet)
      clearInterval(timer)
    }
  }, [pairing, quiet])

  // چند ثانیه پس از هر تغییر محلی
  useEffect(() => {
    if (!pairing || pending === 0) return
    const t = setTimeout(quiet, 2000)
    return () => clearTimeout(t)
  }, [pairing, pending, quiet])

  const value = useMemo<SyncCtx>(
    () => ({
      state: pairing ? state : 'unpaired',
      pending,
      conflicts,
      invalid,
      lastSync,
      lastError,
      syncNow: run,
    }),
    [pairing, state, pending, conflicts, invalid, lastSync, lastError, run],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useSync(): SyncCtx {
  const s = useContext(Ctx)
  if (!s) throw new Error('useSync must be used inside SyncProvider')
  return s
}
