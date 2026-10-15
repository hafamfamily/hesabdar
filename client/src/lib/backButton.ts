/**
 * دکمهٔ «بازگشت» اندروید:
 *  ۱) اگر پنجره‌ای (برگه یا تأیید) باز است، آن را می‌بندد
 *  ۲) اگر در صفحه‌ای غیر از خانه هستیم، به خانه برمی‌گردد
 *  ۳) در صفحهٔ خانه، برنامه به پس‌زمینه می‌رود (بسته نمی‌شود تا داده‌ای در حال ذخیره از دست نرود)
 */
export async function setupAndroidBackButton() {
  const { App } = await import('@capacitor/app')
  await App.addListener('backButton', () => {
    const dialogs = document.querySelectorAll('[role="dialog"], [role="alertdialog"]')
    if (dialogs.length) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      return
    }
    const h = location.hash.replace(/^#\/?/, '')
    if (h && h !== 'home') {
      location.hash = 'home'
      return
    }
    App.minimizeApp()
  })
}
