import { isNative } from './platform'

/**
 * ذخیرهٔ فایل روی دستگاه.
 * در آیفون (به‌ویژه برنامهٔ نصب‌شده روی صفحهٔ اصلی) پنجرهٔ اشتراک‌گذاری مطمئن‌تر است:
 * از آنجا «Save to Files» را بزنید. در رایانه، فایل مستقیم دانلود می‌شود.
 */
export async function saveFile(name: string, content: string, mime: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (isNative) return saveFileNative(name, content)
  const blob = new Blob([content], { type: mime })
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  if (isIOS && typeof File !== 'undefined' && navigator.canShare) {
    const file = new File([blob], name, { type: mime })
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: name })
        return 'shared'
      } catch (e) {
        if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
        // در صورت خطای دیگر، دانلود معمولی امتحان می‌شود
      }
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return 'downloaded'
}

/** تاریخ امروز برای نام فایل، مثل 1405-07-23 */
export function fileStamp(jy: number, jm: number, jd: number) {
  return `${jy}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`
}

/** اندروید: فایل در حافظهٔ موقت برنامه نوشته و پنجرهٔ اشتراک‌گذاری باز می‌شود (ذخیره در Drive، فایل‌ها، تلگرام و…) */
async function saveFileNative(name: string, content: string): Promise<'shared' | 'cancelled'> {
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
  const safe = name.replace(/[^A-Za-z0-9._-]/g, '_')
  const { uri } = await Filesystem.writeFile({ path: safe, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 })
  try {
    await Share.share({ title: safe, files: [uri], dialogTitle: 'ذخیره یا ارسال فایل' })
    return 'shared'
  } catch (e) {
    if (String((e as Error)?.message ?? e).toLowerCase().includes('cancel')) return 'cancelled'
    throw e
  }
}
