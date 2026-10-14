// @ts-check
import { existsSync, readFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * @typedef {object} Config
 * @property {string} dataDir   پوشهٔ داده (پایگاه داده، گواهی‌ها)
 * @property {number} port      درگاه برنامه (HTTPS)
 * @property {number} setupPort درگاه HTTP فقط برای دریافت گواهی ریشه روی آیفون
 * @property {string} hostname  نام شبکه‌ای ثابت (mDNS)، مثلاً dakhlkharj.local
 * @property {boolean} mdns     انتشار نام در شبکه
 * @property {boolean} allowAnyNetwork اجازهٔ دسترسی از خارج شبکهٔ خصوصی (پیش‌فرض: خیر)
 * @property {string} clientDir پوشهٔ فایل‌های ساخته‌شدهٔ برنامه
 */

function defaultDataDir() {
  if (platform() === 'win32' && existsSync('D:\\')) return 'D:\\DakhlKharj\\data'
  if (platform() === 'win32') return join(homedir(), 'Documents', 'DakhlKharj', 'data')
  return join(homedir(), 'DakhlKharj', 'data')
}

/** تنظیمات از config.json در ریشهٔ پروژه، سپس متغیرهای محیطی */
export function loadConfig(overrides = {}) {
  const file = join(ROOT, 'config.json')
  /** @type {Partial<Config>} */
  let fromFile = {}
  if (existsSync(file)) {
    try {
      fromFile = JSON.parse(readFileSync(file, 'utf8'))
    } catch (e) {
      throw new Error(`فایل config.json خراب است: ${/** @type {Error} */ (e).message}`)
    }
  }
  const env = process.env
  /** @type {Config} */
  const cfg = {
    dataDir: defaultDataDir(),
    port: 8443,
    setupPort: 8080,
    hostname: 'dakhlkharj.local',
    mdns: true,
    allowAnyNetwork: false,
    clientDir: join(ROOT, 'client', 'dist'),
    ...fromFile,
    ...(env.DAKHL_DATA_DIR ? { dataDir: env.DAKHL_DATA_DIR } : {}),
    ...(env.DAKHL_PORT ? { port: Number(env.DAKHL_PORT) } : {}),
    ...overrides,
  }
  cfg.dataDir = resolve(cfg.dataDir)
  cfg.clientDir = resolve(cfg.clientDir)
  // پوشهٔ داده نباید داخل پوشهٔ فایل‌های عمومی برنامه باشد
  if (cfg.dataDir.startsWith(cfg.clientDir)) throw new Error('پوشهٔ داده نمی‌تواند داخل پوشهٔ برنامه باشد')
  if (!/^[a-z0-9-]+\.local$/i.test(cfg.hostname)) throw new Error('hostname باید به شکل name.local باشد')
  return cfg
}
