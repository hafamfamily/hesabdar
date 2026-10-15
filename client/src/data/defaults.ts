import type { Category } from './types'

export const CATEGORY_COLORS = [
  '#0F766E', '#F59E0B', '#6366F1', '#EC4899', '#0EA5E9',
  '#8B5CF6', '#14B8A6', '#F97316', '#84CC16', '#64748B',
  '#EF4444', '#10B981',
]

/** دسته‌های پیش‌فرض — همه قابل ویرایش، بایگانی یا حذف هستند */
export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'exp-food', type: 'expense', name: 'خوراک', icon: 'utensils', color: '#F59E0B', order: 1 },
  { id: 'exp-home', type: 'expense', name: 'خرید منزل', icon: 'basket', color: '#0EA5E9', order: 2 },
  { id: 'exp-rent', type: 'expense', name: 'مسکن و اجاره', icon: 'home', color: '#0F766E', order: 3 },
  { id: 'exp-transport', type: 'expense', name: 'حمل‌ونقل', icon: 'car', color: '#6366F1', order: 4 },
  { id: 'exp-bills', type: 'expense', name: 'قبوض', icon: 'receipt', color: '#64748B', order: 5 },
  { id: 'exp-phone', type: 'expense', name: 'موبایل و اینترنت', icon: 'phone', color: '#0EA5E9', order: 6 },
  { id: 'exp-debt', type: 'expense', name: 'اقساط و بدهی', icon: 'landmark', color: '#EF4444', order: 7 },
  { id: 'exp-health', type: 'expense', name: 'درمان', icon: 'heart', color: '#EC4899', order: 8 },
  { id: 'exp-edu', type: 'expense', name: 'آموزش', icon: 'graduation', color: '#8B5CF6', order: 9 },
  { id: 'exp-clothes', type: 'expense', name: 'پوشاک', icon: 'shirt', color: '#14B8A6', order: 10 },
  { id: 'exp-fun', type: 'expense', name: 'تفریح', icon: 'party', color: '#F97316', order: 11 },
  { id: 'exp-gift', type: 'expense', name: 'هدیه و خیریه', icon: 'gift', color: '#84CC16', order: 12 },
  { id: 'exp-other', type: 'expense', name: 'سایر', icon: 'dots', color: '#94A3B8', order: 99 },
  { id: 'inc-salary', type: 'income', name: 'حقوق', icon: 'briefcase', color: '#10B981', order: 1 },
  { id: 'inc-bonus', type: 'income', name: 'پاداش و عیدی', icon: 'sparkles', color: '#F59E0B', order: 2 },
  { id: 'inc-side', type: 'income', name: 'درآمد جانبی', icon: 'coins', color: '#0F766E', order: 3 },
  { id: 'inc-interest', type: 'income', name: 'سود سپرده', icon: 'trend', color: '#6366F1', order: 4 },
  { id: 'inc-debt', type: 'income', name: 'دریافت طلب', icon: 'handcoins', color: '#14B8A6', order: 5 },
  { id: 'inc-gift', type: 'income', name: 'هدیه', icon: 'gift', color: '#84CC16', order: 6 },
  { id: 'inc-other', type: 'income', name: 'سایر', icon: 'dots', color: '#94A3B8', order: 99 },
]
