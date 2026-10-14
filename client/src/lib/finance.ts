import type { Category, Transaction, TxType } from '../data/types'
import { addDays, diffDays, type DateRange, inRange, jMonthRange, shiftJMonth, toJ } from './jalali'

export interface Totals {
  income: number
  expense: number
  net: number
}

export function totals(txs: Transaction[]): Totals {
  let income = 0
  let expense = 0
  for (const t of txs) {
    if (t.type === 'income') income += t.amount
    else expense += t.amount
  }
  return { income, expense, net: income - expense }
}

/** مانده فعلی = موجودی اولیه + مجموع درآمدها − مجموع هزینه‌ها */
export function currentBalance(openingBalance: number, txs: Transaction[]): number {
  const t = totals(txs)
  return openingBalance + t.income - t.expense
}

export function filterRange(txs: Transaction[], r: DateRange): Transaction[] {
  return txs.filter((t) => inRange(t.date, r))
}

/** مرتب‌سازی نزولی بر اساس تاریخ، سپس زمان ثبت */
export function sortByDateDesc(txs: Transaction[]): Transaction[] {
  return [...txs].sort((a, b) =>
    a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date),
  )
}

export interface CategoryShare {
  category: Category
  amount: number
  share: number // ۰ تا ۱
  count: number
}

export function byCategory(txs: Transaction[], categories: Category[], type: TxType): CategoryShare[] {
  const map = new Map<string, { amount: number; count: number }>()
  let sum = 0
  for (const t of txs) {
    if (t.type !== type) continue
    const cur = map.get(t.categoryId) ?? { amount: 0, count: 0 }
    cur.amount += t.amount
    cur.count += 1
    map.set(t.categoryId, cur)
    sum += t.amount
  }
  const catById = new Map(categories.map((c) => [c.id, c]))
  return [...map.entries()]
    .map(([id, v]) => ({
      category: catById.get(id) ?? { id, type, name: 'نامشخص', icon: 'dots', color: '#94A3B8', order: 999 },
      amount: v.amount,
      count: v.count,
      share: sum ? v.amount / sum : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
}

export interface SeriesPoint {
  key: string
  label: string
  income: number
  expense: number
}

/** سری روزانه برای یک بازه (برای نمودار میله‌ای) */
export function dailySeries(txs: Transaction[], r: DateRange, label: (iso: string) => string): SeriesPoint[] {
  const n = diffDays(r.start, r.end) + 1
  const points: SeriesPoint[] = []
  const idx = new Map<string, SeriesPoint>()
  for (let i = 0; i < n; i++) {
    const iso = addDays(r.start, i)
    const p = { key: iso, label: label(iso), income: 0, expense: 0 }
    points.push(p)
    idx.set(iso, p)
  }
  for (const t of txs) {
    const p = idx.get(t.date)
    if (p) p[t.type] += t.amount
  }
  return points
}

/** سری ماهانهٔ شمسی برای چند ماه منتهی به ماه داده‌شده */
export function monthlySeries(
  txs: Transaction[],
  endJy: number,
  endJm: number,
  count: number,
  label: (jy: number, jm: number) => string,
): SeriesPoint[] {
  const points: SeriesPoint[] = []
  for (let i = count - 1; i >= 0; i--) {
    const { jy, jm } = shiftJMonth(endJy, endJm, -i)
    const t = totals(filterRange(txs, jMonthRange(jy, jm)))
    points.push({ key: `${jy}-${jm}`, label: label(jy, jm), income: t.income, expense: t.expense })
  }
  return points
}

export function currentJMonth(iso: string) {
  const { jy, jm } = toJ(iso)
  return { jy, jm, range: jMonthRange(jy, jm) }
}
