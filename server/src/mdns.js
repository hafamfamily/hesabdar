// @ts-check
import makeMdns from 'multicast-dns'
import { lanAddresses } from './net.js'

/**
 * انتشار نام ثابت (مثلاً dakhlkharj.local) در شبکهٔ محلی با mDNS/Bonjour.
 * آیفون این نام را بدون تنظیم اضافه پیدا می‌کند؛ پس اگر IP لپ‌تاپ عوض شود، آدرس برنامه ثابت می‌ماند.
 * @param {string} hostname
 * @param {(msg: string) => void} log
 */
export function startMdns(hostname, log = () => {}) {
  const name = hostname.toLowerCase()
  /** @type {{ ok: boolean, error?: string }} */
  const state = { ok: false }
  let mdns
  try {
    mdns = makeMdns({ reuseAddr: true, loopback: true })
  } catch (e) {
    state.error = /** @type {Error} */ (e).message
    return { state, stop: () => {} }
  }
  mdns.on('ready', () => {
    state.ok = true
    log(`mDNS: announcing ${hostname}`)
  })
  mdns.on('error', (/** @type {Error} */ e) => {
    state.ok = false
    state.error = e.message
    log(`mDNS error (${hostname}): ${e.message}`)
  })
  mdns.on('query', (/** @type {any} */ q) => {
    const answers = answersFor(name, q.questions ?? [], lanAddresses().map((a) => a.address))
    if (answers.length) mdns.respond({ answers })
  })
  return {
    state,
    stop: () => {
      try {
        mdns.destroy()
      } catch {
        /* نادیده */
      }
    },
  }
}

/**
 * پاسخ‌های A برای پرسش‌هایی که نام ما را می‌خواهند
 * @param {string} name نام با حروف کوچک
 * @param {{name: string, type: string}[]} questions
 * @param {string[]} addresses
 */
export function answersFor(name, questions, addresses) {
  const asked = questions.some((x) => String(x.name).toLowerCase() === name && (x.type === 'A' || x.type === 'ANY'))
  return asked ? addresses.map((data) => ({ name, type: 'A', ttl: 120, flush: true, data })) : []
}
