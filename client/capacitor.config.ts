import type { CapacitorConfig } from '@capacitor/cli'

/**
 * پیکربندی نسخهٔ اندروید (Capacitor).
 * appId پس از انتشار در فروشگاه قابل تغییر نیست؛ پیش از انتشار نهایی، شناسهٔ واقعی را جایگزین کنید.
 */
const config: CapacitorConfig = {
  appId: 'ir.dakhlokharj.app',
  appName: 'دخل‌وخرج',
  webDir: 'dist',
  android: {
    // اجازهٔ محتوای HTTP یا اشکال‌زدایی وب‌ویو در نسخهٔ فروشگاهی داده نمی‌شود
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_notify',
      iconColor: '#0F766E',
    },
  },
}

export default config
