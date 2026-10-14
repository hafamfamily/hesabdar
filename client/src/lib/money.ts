import { toEnDigits, toFaDigits } from './digits'

/** جداسازی سه‌رقمی با ارقام فارسی، مثلاً ۱۲٬۵۰۰٬۰۰۰ */
export function formatNumber(n: number): string {
  const sign = n < 0 ? '−' : ''
  const grouped = Math.abs(Math.trunc(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '٬')
  return sign + toFaDigits(grouped)
}

export function formatToman(n: number): string {
  return `${formatNumber(n)} تومان`
}

/** نمایش فشرده برای محور نمودارها: ۱٫۲ م، ۸۵۰ ه */
export function formatCompact(n: number): string {
  const abs = Math.abs(n)
  const fmt = (v: number) => toFaDigits(String(Math.round(v * 10) / 10).replace('.', '٫'))
  if (abs >= 1_000_000_000) return `${fmt(n / 1_000_000_000)} میلیارد`
  if (abs >= 1_000_000) return `${fmt(n / 1_000_000)} م`
  if (abs >= 1_000) return `${fmt(n / 1_000)} ه`
  return toFaDigits(String(n))
}

export const MAX_AMOUNT = 1_000_000_000_000_000 // سقف معقول برای جلوگیری از خطای تایپی (یک میلیون میلیارد تومان)

export type ParseResult = { ok: true; value: number } | { ok: false; error: string }

/** ورودی کاربر (ارقام فارسی/عربی/لاتین، با یا بدون جداکننده) را به عدد صحیح تبدیل می‌کند. */
export function parseAmount(raw: string): ParseResult {
  const cleaned = toEnDigits(raw).replace(/[\s,٬،_]/g, '')
  if (cleaned === '') return { ok: false, error: 'مبلغ را وارد کنید' }
  if (!/^\d+$/.test(cleaned)) return { ok: false, error: 'مبلغ فقط باید شامل عدد باشد' }
  const value = Number(cleaned)
  if (!Number.isSafeInteger(value) || value > MAX_AMOUNT) return { ok: false, error: 'مبلغ بیش از حد بزرگ است' }
  if (value <= 0) return { ok: false, error: 'مبلغ باید بیشتر از صفر باشد' }
  return { ok: true, value }
}

/** مقدار ورودی را حین تایپ قالب‌بندی می‌کند (فقط ارقام نگه داشته می‌شوند). */
export function formatAmountInput(raw: string): string {
  const digits = toEnDigits(raw).replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 16)
  if (!digits) return ''
  return formatNumber(Number(digits))
}

/** مبلغ به حروف تقریبی برای جلوگیری از اشتباه در تعداد صفرها: «۱۲ میلیون و ۵۰۰ هزار تومان» */
export function amountInWords(n: number): string {
  if (!n || n <= 0) return ''
  const units: [number, string][] = [
    [1_000_000_000_000, 'هزار میلیارد'],
    [1_000_000_000, 'میلیارد'],
    [1_000_000, 'میلیون'],
    [1_000, 'هزار'],
    [1, ''],
  ]
  const parts: string[] = []
  let rest = n
  for (const [size, label] of units) {
    const q = Math.floor(rest / size)
    if (q > 0) {
      parts.push(label ? `${formatNumber(q)} ${label}` : formatNumber(q))
      rest -= q * size
    }
  }
  return `${parts.join(' و ')} تومان`
}
