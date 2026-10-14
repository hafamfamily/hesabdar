// @ts-check
import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { isPrivateIp } from './net.js'

/**
 * سرور HTTP کوچک فقط برای راه‌اندازی آیفون: نمایش آدرس برنامه و دریافت «گواهی ریشه» (فایل عمومی، بدون کلید خصوصی).
 * هیچ داده یا API از این درگاه سرو نمی‌شود.
 * @param {object} o
 * @param {number} o.port
 * @param {string} o.caPath   مسیر rootCA.pem (عمومی)
 * @param {() => string[]} o.appUrls
 */
export function startSetupServer({ port, caPath, appUrls }) {
  const server = createServer((req, res) => {
    if (!isPrivateIp(req.socket.remoteAddress)) {
      res.writeHead(403).end()
      return
    }
    const headers = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" }
    if (req.url === '/ca.crt') {
      if (!existsSync(caPath)) {
        res.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' }).end('گواهی ریشه پیدا نشد؛ اسکریپت setup-https را اجرا کنید.')
        return
      }
      res.writeHead(200, { ...headers, 'Content-Type': 'application/x-x509-ca-cert', 'Content-Disposition': 'attachment; filename="DakhlKharj-CA.crt"' })
      res.end(readFileSync(caPath))
      return
    }
    if (req.url !== '/' && req.url !== '/index.html') {
      res.writeHead(404, headers).end()
      return
    }
    const links = appUrls().map((u) => `<li><a href="${u}">${u}</a></li>`).join('')
    res.writeHead(200, { ...headers, 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>راه‌اندازی دخل‌وخرج</title>
<body style="font-family:system-ui,sans-serif;max-width:34rem;margin:auto;padding:1.5rem;line-height:1.9;color:#0F172A;background:#F8FAFC">
<h1 style="color:#0F766E">راه‌اندازی آیفون</h1>
<ol>
<li><a href="/ca.crt" style="font-weight:bold">دریافت گواهی امنیتی</a> و در پیام Safari «Allow» را بزنید.</li>
<li>Settings ← General ← VPN &amp; Device Management ← پروفایل DakhlKharj (mkcert) ← Install</li>
<li>Settings ← General ← About ← Certificate Trust Settings ← کلید mkcert را روشن کنید.</li>
<li>سپس برنامه را از یکی از این آدرس‌ها باز کنید (اولی پیشنهاد می‌شود):<ul>${links}</ul></li>
<li>در Safari دکمهٔ Share ← Add to Home Screen.</li>
</ol>
<p style="font-size:.85rem;color:#64748B">این صفحه فقط برای راه‌اندازی است و هیچ اطلاعات مالی از آن قابل دسترسی نیست.</p>
</body></html>`)
  })
  server.listen(port, '0.0.0.0')
  return server
}
