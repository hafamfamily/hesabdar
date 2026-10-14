import type { BodyFont, FontSettings, TitleFont } from '../data/types'

/**
 * فونت‌های همراه برنامه (همه با مجوز آزاد SIL OFL و داخل برنامه، بدون دانلود از اینترنت).
 * فونت‌های سری B (نازنین، میترا، تیتر، یکان) مجوز انتشار آزاد ندارند؛
 * کاربر می‌تواند فایل فونتی را که خودش دارد از دستگاه بارگذاری کند.
 */
export const CUSTOM_FAMILY = 'DK User Font'

export const BODY_FONTS: { id: Exclude<BodyFont, 'custom'>; name: string; family: string; note: string }[] = [
  { id: 'estedad', name: 'استعداد', family: '"Estedad Variable"', note: 'مدرن و خوش‌خوان' },
  { id: 'vazirmatn', name: 'وزیرمتن', family: '"Vazirmatn Variable"', note: 'ساده، شبیه یکان' },
  { id: 'naskh', name: 'نسخ', family: '"Noto Naskh Arabic Variable"', note: 'کلاسیک، شبیه نازنین و میترا' },
]

export const TITLE_FONTS: { id: Exclude<TitleFont, 'custom'>; name: string; family?: string; weight: number; note: string }[] = [
  { id: 'lalezar', name: 'لاله‌زار', family: '"Lalezar"', weight: 400, note: 'تیتر پررنگ، شبیه تیتر' },
  { id: 'naskh', name: 'نسخ', family: '"Noto Naskh Arabic Variable"', weight: 700, note: 'رسمی و کلاسیک' },
  { id: 'same', name: 'همان فونت متن', weight: 800, note: '' },
]

const FALLBACK = 'ui-sans-serif, system-ui, sans-serif'

/** اعمال فونت‌ها با متغیرهای CSS روی ریشهٔ سند */
export function applyFonts(f: FontSettings, customLoaded: boolean) {
  const root = document.documentElement.style
  const body = f.body === 'custom' && customLoaded ? `"${CUSTOM_FAMILY}"` : (BODY_FONTS.find((b) => b.id === f.body) ?? BODY_FONTS[0]).family
  root.setProperty('--app-font', `${body}, "Vazirmatn Variable", ${FALLBACK}`)
  if (f.title === 'custom' && customLoaded) {
    root.setProperty('--app-title-font', `"${CUSTOM_FAMILY}", ${body}, ${FALLBACK}`)
    root.setProperty('--app-title-weight', '700')
  } else {
    const t = TITLE_FONTS.find((x) => x.id === f.title) ?? TITLE_FONTS[0]
    root.setProperty('--app-title-font', `${t.family ?? body}, ${body}, ${FALLBACK}`)
    root.setProperty('--app-title-weight', String(t.weight))
  }
}

/** بارگذاری فایل فونت کاربر (TTF/OTF/WOFF/WOFF2)؛ محتوای فایل را برای ذخیره برمی‌گرداند */
export async function loadCustomFont(file: File): Promise<ArrayBuffer> {
  if (file.size > 15 * 1024 * 1024) throw new Error('حجم فایل فونت بیش از حد است')
  if (!/\.(ttf|otf|woff2?)$/i.test(file.name)) throw new Error('فقط فایل‌های TTF، OTF، WOFF یا WOFF2 پذیرفته می‌شوند')
  const data = await file.arrayBuffer()
  await loadFontData(data.slice(0))
  return data
}

/** ثبت فونت از داده‌های باینری با FontFace API */
export async function loadFontData(data: ArrayBuffer): Promise<void> {
  const face = new FontFace(CUSTOM_FAMILY, data)
  try {
    await face.load()
  } catch {
    throw new Error('این فایل فونت معتبر نیست یا توسط مرورگر پشتیبانی نمی‌شود')
  }
  for (const f of [...document.fonts]) if (f.family.replace(/"/g, '') === CUSTOM_FAMILY) document.fonts.delete(f)
  document.fonts.add(face)
}

export function isCustomFontLoaded(): boolean {
  return [...document.fonts].some((f) => f.family.replace(/"/g, '') === CUSTOM_FAMILY && f.status === 'loaded')
}
