import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // در حالت توسعه، درخواست‌های API به سرور محلی (بدون HTTPS، فقط localhost) فرستاده می‌شوند
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:8443' } },
})
