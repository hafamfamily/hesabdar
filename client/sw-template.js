/* Service Worker «دخل‌وخرج من» — در زمان build ساخته می‌شود (vite.config.ts).
 * هدف: باز شدن برنامه بدون اینترنت و وقتی لپ‌تاپ خاموش است.
 *  - همهٔ فایل‌های برنامه هنگام نصب ذخیره می‌شوند (cache-first؛ نام فایل‌ها هش دارند)
 *  - درخواست‌های /api هرگز ذخیره نمی‌شوند (داده‌ها در IndexedDB هستند)
 *  - با هر نسخهٔ جدید، کش قبلی پاک و نسخهٔ جدید از دفعهٔ بعد باز می‌شود
 */
const VERSION = '__VERSION__'
const ASSETS = __ASSETS__
const CACHE = `dk-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('dk-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('/index.html').then((hit) => hit || fetch(req)))
    return
  }
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req)))
})
