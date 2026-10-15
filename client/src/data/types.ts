import type { IsoDate } from '../lib/jalali'

export type TxType = 'income' | 'expense'

export interface Category {
  id: string
  type: TxType
  name: string
  icon: string // کلید آیکون در CATEGORY_ICONS
  color: string
  order: number
  archived?: boolean
}

export interface Transaction {
  /** شناسهٔ یکتای پایدار (UUID v4) که روی دستگاه ساخته می‌شود و هرگز تغییر نمی‌کند */
  id: string
  type: TxType
  /** مبلغ به تومان، عدد صحیح مثبت */
  amount: number
  /** تاریخ تراکنش: YYYY-MM-DD میلادی */
  date: IsoDate
  categoryId: string
  note: string
  /** زمان‌ها با قالب ISO 8601 (UTC) */
  createdAt: string
  updatedAt: string
}

export type ThemePref = 'system' | 'light' | 'dark'

export type BodyFont = 'estedad' | 'vazirmatn' | 'naskh' | 'custom'
export type TitleFont = 'same' | 'lalezar' | 'naskh' | 'custom'

export interface FontSettings {
  body: BodyFont
  title: TitleFont
  /** نام فایل فونت دلخواهی که کاربر از دستگاه خودش بارگذاری کرده */
  customName?: string
}

export interface Settings {
  openingBalance: number
  theme: ThemePref
  reminders: ReminderSettings
  fonts: FontSettings
}

export type TxInput = Pick<Transaction, 'type' | 'amount' | 'date' | 'categoryId' | 'note'>

/** جهت بدهی: «borrowed» = من بدهکارم (قرض/وام گرفتم)، «lent» = من طلبکارم (قرض دادم) */
export type DebtDirection = 'borrowed' | 'lent'
export type DebtKind = 'personal' | 'loan'

export interface Installment {
  id: string
  /** شمارهٔ قسط از ۱ (بر اساس ترتیب سررسید) */
  index: number
  /** تاریخ سررسید؛ خالی = بدون سررسید مشخص */
  dueDate?: IsoDate
  amount: number
  /** تاریخ پرداخت/دریافت؛ خالی = پرداخت‌نشده */
  paidDate?: IsoDate
  /** قسطی که پیش از شروع استفاده از برنامه پرداخت شده و روی موجودی اثر ندارد */
  paidBefore?: boolean
  /** اگر پرداخت به‌صورت تراکنش هزینه/درآمد هم ثبت شده باشد */
  transactionId?: string
}

/** مبلغ قرض/وامی که واقعاً دریافت یا پرداخت شده و روی موجودی اثر می‌گذارد */
export interface Disbursement {
  amount: number
  date: IsoDate
}

export interface Debt {
  id: string
  direction: DebtDirection
  kind: DebtKind
  /** نام شخص یا بانک */
  counterparty: string
  /** مبلغ اصل قرض/وام */
  principal?: number
  startDate: IsoDate
  note: string
  /** در صورت وجود: مبلغ وارد موجودی شده (بدهی: افزایش، طلب: کاهش) — این مبلغ درآمد یا هزینه حساب نمی‌شود */
  disbursement?: Disbursement
  installments: Installment[]
  reminder: { enabled: boolean; daysBefore: number }
  createdAt: string
  updatedAt: string
}

/** ردیف جدول اقساط پیش از ذخیره/در حال ویرایش */
export interface ScheduleRow {
  id?: string
  dueDate?: IsoDate
  amount: number
  paid: boolean
  paidDate?: IsoDate
  paidBefore?: boolean
  transactionId?: string
}

export interface DebtInput {
  direction: DebtDirection
  kind: DebtKind
  counterparty: string
  principal?: number
  startDate: IsoDate
  note: string
  disbursement?: Disbursement
  schedule: ScheduleRow[]
  reminder: { enabled: boolean; daysBefore: number }
}

export interface ReminderSettings {
  /** کاربر یادآوری اقساط را فعال کرده است */
  enabled: boolean
  /** اجازهٔ اعلان سیستمی (در صورت پشتیبانی دستگاه) */
  systemNotifications: boolean
}
