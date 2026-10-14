// @ts-check
/**
 * اعتبارسنجی داده‌های دریافتی پیش از ذخیره (دفاع لایهٔ دوم؛ برنامه هم قبل از ارسال بررسی می‌کند).
 * خطا = رشتهٔ فارسی؛ معتبر = null
 */

const MAX_AMOUNT = 1e15
const isObj = (/** @type {unknown} */ v) => typeof v === 'object' && v !== null && !Array.isArray(v)
const isStr = (/** @type {unknown} */ v, max = 200) => typeof v === 'string' && v.length <= max
const isAmount = (/** @type {unknown} */ v, allowZero = false) =>
  typeof v === 'number' && Number.isSafeInteger(v) && (allowZero ? v >= 0 : v > 0) && v <= MAX_AMOUNT

export function isIsoDate(/** @type {unknown} */ s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}
const isTimestamp = (/** @type {unknown} */ s) => typeof s === 'string' && s.length <= 40 && !Number.isNaN(Date.parse(s))
export const isId = (/** @type {unknown} */ s) => typeof s === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(s)

/** @param {any} t */
function transaction(t) {
  if (t.type !== 'income' && t.type !== 'expense') return 'نوع تراکنش نامعتبر است'
  if (!isAmount(t.amount)) return 'مبلغ نامعتبر است'
  if (!isIsoDate(t.date)) return 'تاریخ نامعتبر است'
  if (!isId(t.categoryId)) return 'دسته‌بندی نامعتبر است'
  if (!isStr(t.note, 200)) return 'توضیحات نامعتبر است'
  if (!isTimestamp(t.createdAt) || !isTimestamp(t.updatedAt)) return 'زمان ثبت نامعتبر است'
  return null
}

/** @param {any} c */
function category(c) {
  if (c.type !== 'income' && c.type !== 'expense') return 'نوع دسته نامعتبر است'
  if (!isStr(c.name, 24) || !c.name.trim()) return 'نام دسته نامعتبر است'
  if (!isStr(c.icon, 32) || !/^#[0-9A-Fa-f]{6}$/.test(c.color)) return 'ظاهر دسته نامعتبر است'
  if (typeof c.order !== 'number' || !Number.isFinite(c.order)) return 'ترتیب دسته نامعتبر است'
  if (c.archived !== undefined && typeof c.archived !== 'boolean') return 'وضعیت دسته نامعتبر است'
  return null
}

/** @param {any} d */
function debt(d) {
  if (d.direction !== 'borrowed' && d.direction !== 'lent') return 'جهت بدهی نامعتبر است'
  if (d.kind !== 'personal' && d.kind !== 'loan') return 'نوع بدهی نامعتبر است'
  if (!isStr(d.counterparty, 40) || !d.counterparty.trim()) return 'نام طرف حساب نامعتبر است'
  if (d.principal !== undefined && !isAmount(d.principal, true)) return 'مبلغ اصل نامعتبر است'
  if (!isIsoDate(d.startDate) || !isStr(d.note, 200)) return 'اطلاعات بدهی نامعتبر است'
  if (d.disbursement !== undefined && !(isObj(d.disbursement) && isAmount(d.disbursement.amount) && isIsoDate(d.disbursement.date)))
    return 'مبلغ ورودی به موجودی نامعتبر است'
  if (!isObj(d.reminder) || typeof d.reminder.enabled !== 'boolean' || ![0, 1, 3, 7].includes(d.reminder.daysBefore)) return 'یادآوری نامعتبر است'
  if (!Array.isArray(d.installments) || d.installments.length < 1 || d.installments.length > 360) return 'تعداد اقساط نامعتبر است'
  for (const i of d.installments) {
    if (!isObj(i) || !isId(i.id) || !Number.isInteger(i.index) || !isAmount(i.amount)) return 'قسط نامعتبر است'
    if (i.dueDate !== undefined && !isIsoDate(i.dueDate)) return 'سررسید قسط نامعتبر است'
    if (i.paidDate !== undefined && !isIsoDate(i.paidDate)) return 'تاریخ پرداخت قسط نامعتبر است'
    if (i.transactionId !== undefined && !isId(i.transactionId)) return 'پیوند قسط نامعتبر است'
  }
  if (!isTimestamp(d.createdAt) || !isTimestamp(d.updatedAt)) return 'زمان ثبت نامعتبر است'
  return null
}

/** @param {any} s */
function settings(s) {
  if (!isAmount(s.openingBalance, true)) return 'موجودی اولیه نامعتبر است'
  if (!isObj(s.reminders) || !isObj(s.fonts)) return 'تنظیمات نامعتبر است'
  return null
}

const VALIDATORS = { transactions: transaction, categories: category, debts: debt, settings }

/**
 * @param {string} collection
 * @param {string} id
 * @param {unknown} data
 */
export function validateRecord(collection, id, data) {
  const v = VALIDATORS[/** @type {keyof typeof VALIDATORS} */ (collection)]
  if (!v) return 'نوع داده نامعتبر است'
  if (!isId(id)) return 'شناسه نامعتبر است'
  if (!isObj(data)) return 'داده نامعتبر است'
  if (collection === 'settings' && id !== 'settings') return 'شناسهٔ تنظیمات نامعتبر است'
  if (collection !== 'settings' && /** @type {any} */ (data).id !== id) return 'شناسه با داده هم‌خوانی ندارد'
  if (JSON.stringify(data).length > 256_000) return 'حجم داده بیش از حد است'
  return v(/** @type {any} */ (data))
}
