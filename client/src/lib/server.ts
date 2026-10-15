import { db } from '../data/store'
import { resetSyncState } from '../data/sync'

/**
 * ارتباط با سرور لپ‌تاپ.
 * برنامه از خود سرور بارگذاری می‌شود، پس نشانی API همان مبدأ صفحه است (بدون CORS).
 * توکن دستگاه فقط در IndexedDB همین دستگاه نگه داشته می‌شود و در کد برنامه نیست.
 */

export interface Pairing {
  token: string
  deviceId: string
  deviceName: string
  pairedAt: string
}

export interface Health {
  ok: boolean
  version: string
  needsSetup: boolean
}

export interface DeviceInfo {
  id: string
  name: string
  createdAt: string
  lastSeenAt?: string
}

export class ServerError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

const TIMEOUT = 5000

async function call<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT)
  let res: Response
  try {
    res = await fetch(`/api${path}`, {
      ...init,
      signal: ctrl.signal,
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...(init.token ? { authorization: `Bearer ${init.token}` } : {}) },
    })
  } catch {
    throw new ServerError('سرور در دسترس نیست', 0)
  } finally {
    clearTimeout(timer)
  }
  const body = await res.json().catch(() => null)
  if (!res.ok) throw new ServerError(body?.error ?? 'خطای سرور', res.status)
  return body as T
}

export async function getPairing(): Promise<Pairing | undefined> {
  return (await db.kv.get('server-pairing'))?.value as Pairing | undefined
}

export async function health(): Promise<Health> {
  const h = await call<Health & { app?: string }>('/health')
  if (h.app !== 'dakhl-o-kharj') throw new ServerError('سرور در دسترس نیست', 0)
  return h
}

export function setupPassword(password: string) {
  return call<{ ok: true }>('/auth/setup', { method: 'POST', body: JSON.stringify({ password }) })
}

export async function pair(password: string, deviceName: string): Promise<Pairing> {
  if ((await db.kv.get('has-sample-data'))?.value)
    throw new ServerError('روی این دستگاه دادهٔ نمونه هست. ابتدا از «تنظیمات ← حذف همهٔ داده‌های این دستگاه» آن را پاک کنید تا به داده‌های واقعی اضافه نشود.', 400)
  const r = await call<{ token: string; deviceId: string; name: string }>('/auth/pair', {
    method: 'POST',
    body: JSON.stringify({ password, deviceName }),
  })
  const p: Pairing = { token: r.token, deviceId: r.deviceId, deviceName: r.name, pairedAt: new Date().toISOString() }
  await resetSyncState(db)
  await db.kv.put({ key: 'server-pairing', value: p })
  return p
}

export async function unpair(): Promise<void> {
  const p = await getPairing()
  if (p) await call(`/devices/${p.deviceId}`, { method: 'DELETE', token: p.token }).catch(() => undefined)
  await db.kv.delete('server-pairing')
}

export async function listDevices(): Promise<{ devices: DeviceInfo[]; current: string }> {
  const p = await getPairing()
  if (!p) throw new ServerError('این دستگاه جفت نشده است', 401)
  return call('/devices', { token: p.token })
}

export async function revokeDevice(id: string): Promise<void> {
  const p = await getPairing()
  if (!p) throw new ServerError('این دستگاه جفت نشده است', 401)
  await call(`/devices/${id}`, { method: 'DELETE', token: p.token })
}

/** آیا صفحه روی خود لپ‌تاپ باز شده است؟ (تعیین گذرواژه فقط از لپ‌تاپ مجاز است) */
export const isOnServerMachine = () => ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)

/** نام پیشنهادی دستگاه */
export function guessDeviceName(): string {
  const ua = navigator.userAgent
  if (/iPhone/.test(ua)) return 'آیفون'
  if (/iPad/.test(ua)) return 'آیپد'
  if (/Android/.test(ua)) return 'گوشی اندروید'
  if (/Windows/.test(ua)) return 'لپ‌تاپ ویندوز'
  return 'دستگاه'
}

export interface ServerStatus {
  rev: number
  counts: Record<string, number>
  lastBackup?: { at: string; file: string } | null
  backupDir?: string
}

export async function serverStatus(): Promise<ServerStatus> {
  const p = await getPairing()
  if (!p) throw new ServerError('این دستگاه جفت نشده است', 401)
  return call('/status', { token: p.token })
}

/** پشتیبان‌گیری فوری از پایگاه دادهٔ سرور در پوشهٔ پشتیبان لپ‌تاپ */
export async function serverBackupNow(): Promise<{ at: string; file: string }> {
  const p = await getPairing()
  if (!p) throw new ServerError('این دستگاه جفت نشده است', 401)
  return call('/backup', { method: 'POST', token: p.token })
}
