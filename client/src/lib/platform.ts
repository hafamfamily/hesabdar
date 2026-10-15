import { Capacitor } from '@capacitor/core'

/**
 * آیا برنامه داخل اپ اندروید (Capacitor) اجرا می‌شود؟
 * نسخهٔ اندروید مستقل است: سرور لپ‌تاپ و همگام‌سازی ندارد، پشتیبان از طریق اشتراک‌گذاری ذخیره می‌شود
 * و یادآوری اقساط با اعلان واقعی اندروید (زمان‌بندی‌شده، حتی وقتی برنامه بسته است) انجام می‌شود.
 */
export const isNative = Capacitor.isNativePlatform()
export const platform = Capacitor.getPlatform() // 'android' | 'ios' | 'web'
