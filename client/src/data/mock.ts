import { addDays, todayIso } from '../lib/jalali'
import type { Debt, Transaction, TxType } from './types'
import { buildInstallments, equalSchedule, rowsToInstallments } from '../lib/debts'
import { fromJ, shiftJMonth, toJ } from '../lib/jalali'

/** داده‌های نمونه برای پیش‌نمایش مرحلهٔ اول (قطعی/تکرارپذیر) */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296
    return seed / 4294967296
  }
}

const EXPENSE_TEMPLATES: [string, number, number, string[]][] = [
  ['exp-food', 80_000, 650_000, ['نان و لبنیات', 'ناهار بیرون', 'میوه', 'سوپرمارکت', '']],
  ['exp-home', 150_000, 2_400_000, ['خرید هفتگی', 'شوینده‌ها', 'لوازم آشپزخانه']],
  ['exp-transport', 40_000, 450_000, ['تاکسی اینترنتی', 'بنزین', 'مترو', '']],
  ['exp-bills', 120_000, 1_200_000, ['قبض برق', 'قبض گاز', 'اینترنت', 'شارژ موبایل']],
  ['exp-health', 200_000, 3_500_000, ['داروخانه', 'ویزیت پزشک']],
  ['exp-edu', 300_000, 2_000_000, ['کتاب', 'دورهٔ آنلاین']],
  ['exp-clothes', 400_000, 4_000_000, ['کفش', 'پیراهن']],
  ['exp-fun', 150_000, 1_800_000, ['سینما', 'کافه', 'رستوران']],
]

export function buildMockTransactions(today = todayIso()): Transaction[] {
  const r = rng(1405)
  const out: Transaction[] = []
  let n = 0
  const push = (type: TxType, date: string, categoryId: string, amount: number, note: string) => {
    n++
    const ts = `${date}T${String(8 + (n % 12)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}:00.000Z`
    out.push({ id: `mock-${n}`, type, amount, date, categoryId, note, createdAt: ts, updatedAt: ts })
  }
  const round = (v: number) => Math.round(v / 10_000) * 10_000

  for (let d = 95; d >= 0; d--) {
    const date = addDays(today, -d)
    const count = Math.floor(r() * 3)
    for (let i = 0; i < count; i++) {
      const [cat, min, max, notes] = EXPENSE_TEMPLATES[Math.floor(r() * EXPENSE_TEMPLATES.length)]
      push('expense', date, cat, round(min + r() * (max - min)), notes[Math.floor(r() * notes.length)])
    }
    if (d % 30 === 3) push('income', date, 'inc-salary', 48_000_000, 'حقوق ماهانه')
    if (d % 23 === 5) push('income', date, 'inc-side', round(3_000_000 + r() * 6_000_000), 'پروژهٔ جانبی')
    if (d === 40) push('income', date, 'inc-gift', 2_000_000, 'هدیهٔ تولد')
  }
  return out
}


export function buildMockDebts(today = todayIso()): Debt[] {
  const { jy, jm } = toJ(today)
  const ts = `${today}T08:00:00.000Z`
  const at = (back: number, day: number) => {
    const m = shiftJMonth(jy, jm, -back)
    return fromJ(m.jy, m.jm, day)
  }
  // وام قرض‌الحسنه با دو قسط اول متفاوت
  const qardRows = equalSchedule(24, 2_500_000, at(-1, 10))
  qardRows[0].amount = 3_000_000
  qardRows[1].amount = 3_000_000
  // طلب از علی: قسط اول در همین برنامه دریافت شده
  const aliRows = equalSchedule(4, 5_000_000, at(1, 15))
  aliRows[0] = { ...aliRows[0], paid: true, paidDate: at(1, 15) }

  return [
    {
      id: 'mock-debt-1',
      direction: 'borrowed',
      kind: 'loan',
      counterparty: 'وام بانک ملت',
      principal: 150_000_000,
      startDate: at(14, 5),
      note: 'وام خرید خودرو (۱۳ قسط پیش از شروع برنامه پرداخت شده)',
      installments: buildInstallments({ count: 36, installmentAmount: 5_400_000, firstDueDate: at(13, 5), alreadyPaid: 13 }),
      reminder: { enabled: true, daysBefore: 3 },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'mock-debt-4',
      direction: 'borrowed',
      kind: 'loan',
      counterparty: 'قرض‌الحسنه رسالت',
      principal: 60_000_000,
      startDate: at(0, 2),
      note: '',
      disbursement: { amount: 60_000_000, date: at(0, 2) },
      installments: rowsToInstallments(qardRows),
      reminder: { enabled: true, daysBefore: 3 },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'mock-debt-2',
      direction: 'lent',
      kind: 'personal',
      counterparty: 'علی',
      principal: 20_000_000,
      startDate: at(2, 10),
      note: 'قرض برای تعمیر ماشین',
      disbursement: { amount: 20_000_000, date: at(2, 10) },
      installments: rowsToInstallments(aliRows),
      reminder: { enabled: true, daysBefore: 1 },
      createdAt: ts,
      updatedAt: ts,
    },
    {
      id: 'mock-debt-3',
      direction: 'borrowed',
      kind: 'personal',
      counterparty: 'برادرم',
      principal: 8_000_000,
      startDate: at(0, 1),
      note: '',
      disbursement: { amount: 8_000_000, date: at(0, 1) },
      installments: rowsToInstallments([{ amount: 8_000_000, paid: false }]),
      reminder: { enabled: false, daysBefore: 3 },
      createdAt: ts,
      updatedAt: ts,
    },
  ]
}
