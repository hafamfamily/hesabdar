// @ts-check
import { networkInterfaces } from 'node:os'

/** نشانی IPv4 خالص از قالب‌هایی مثل ::ffff:192.168.1.5 */
export function normalizeIp(/** @type {string | undefined} */ ip) {
  if (!ip) return ''
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip
}

export function isLoopback(/** @type {string | undefined} */ raw) {
  const ip = normalizeIp(raw)
  return ip === '::1' || ip.startsWith('127.')
}

/**
 * آیا نشانی متعلق به شبکهٔ خصوصی/محلی است؟ (RFC 1918، loopback، link-local، IPv6 محلی)
 */
export function isPrivateIp(/** @type {string | undefined} */ raw) {
  const ip = normalizeIp(raw).toLowerCase()
  if (!ip) return false
  if (isLoopback(ip)) return true
  const m = ip.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])]
    return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  }
  return /^fe[89ab][0-9a-f]:/.test(ip) || /^f[cd][0-9a-f]{2}:/.test(ip)
}

/** نشانی‌های IPv4 شبکهٔ محلی این رایانه (برای نمایش به کاربر و پاسخ mDNS) */
export function lanAddresses() {
  /** @type {{name: string, address: string}[]} */
  const out = []
  for (const [name, list] of Object.entries(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal && isPrivateIp(a.address) && !a.address.startsWith('169.254.')) out.push({ name, address: a.address })
    }
  }
  // کارت‌های مجازی (VirtualBox، Hyper-V، WSL) در انتها
  return out.sort((x, y) => Number(/virtual|vethernet|wsl|vbox|docker/i.test(x.name)) - Number(/virtual|vethernet|wsl|vbox|docker/i.test(y.name)))
}
