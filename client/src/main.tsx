import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// اعمال تم پیش از نخستین رندر (بدون اسکریپت درون‌خطی، سازگار با CSP سرور)
try {
  const t = localStorage.getItem('dk-theme') || 'system'
  if (t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)) document.documentElement.classList.add('dark')
} catch {
  /* نادیده */
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service Worker برای باز شدن برنامه بدون اینترنت (فقط نسخهٔ ساخته‌شده، روی HTTPS یا localhost، و نه داخل قاب پیش‌نمایش)
if (import.meta.env.PROD && 'serviceWorker' in navigator && window.isSecureContext && window.top === window.self) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  })
}
