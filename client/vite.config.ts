import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative } from 'node:path'

/** ساخت sw.js با فهرست همهٔ فایل‌های خروجی (برای کار آفلاین PWA) */
function serviceWorker(): Plugin {
  let outDir = 'dist'
  return {
    name: 'dk-service-worker',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir
    },
    closeBundle() {
      const files: string[] = []
      const walk = (d: string) => {
        for (const f of readdirSync(d)) {
          const p = join(d, f)
          if (statSync(p).isDirectory()) walk(p)
          else files.push('/' + relative(outDir, p).split('\\').join('/'))
        }
      }
      walk(outDir)
      const assets = files.filter((f) => f !== '/sw.js' && !f.endsWith('.svg') && f !== '/index.html').sort()
      assets.unshift('/index.html')
      const hash = createHash('sha256')
      for (const f of assets) hash.update(f).update(readFileSync(join(outDir, f)))
      const sw = readFileSync('sw-template.js', 'utf8')
        .replace('__VERSION__', hash.digest('hex').slice(0, 12))
        .replace('__ASSETS__', JSON.stringify(assets))
      writeFileSync(join(outDir, 'sw.js'), sw)
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), serviceWorker()],
  // در حالت توسعه، درخواست‌های API به سرور محلی (بدون HTTPS، فقط localhost) فرستاده می‌شوند
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8443' } },
})
