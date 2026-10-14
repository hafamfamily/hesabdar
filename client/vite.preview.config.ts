import { defineConfig, mergeConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import base from './vite.config'

/** ساخت یک فایل HTML مستقل (فونت و کد درون‌خطی) برای پیش‌نمایش آنلاین */
export default mergeConfig(
  base,
  defineConfig({
    plugins: [viteSingleFile()],
    build: { outDir: 'dist-preview', assetsInlineLimit: 100_000_000 },
  }),
)
