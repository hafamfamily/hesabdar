import type { Category, Transaction } from '../data/types'
import { formatJNumeric } from './jalali'

/**
 * خروجی CSV سازگار با Excel:
 *  - UTF-8 با BOM تا Excel متن فارسی را درست نشان دهد
 *  - جداکنندهٔ کاما و پایان خط CRLF
 *  - مبلغ با ارقام لاتین و بدون جداکننده تا Excel آن را عدد بشناسد
 *  - جلوگیری از اجرای فرمول (CSV injection): مقادیری که با = + - @ شروع می‌شوند با ' آغاز می‌شوند
 */
export function csvCell(v: string | number): string {
  let s = String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function transactionsCsv(txs: Transaction[], categories: Category[]): string {
  const cat = new Map(categories.map((c) => [c.id, c.name]))
  const header = ['تاریخ (شمسی)', 'تاریخ (میلادی)', 'نوع', 'دسته‌بندی', 'مبلغ (تومان)', 'توضیحات']
  const rows = [...txs]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((t) => [
      formatJNumeric(t.date).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))),
      t.date,
      t.type === 'income' ? 'درآمد' : 'هزینه',
      cat.get(t.categoryId) ?? 'نامشخص',
      t.amount,
      t.note,
    ])
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}
