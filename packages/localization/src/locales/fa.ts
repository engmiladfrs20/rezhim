export const fa = {
  common: {
    appName: 'NutriAI Persia',
    tagline: 'پلتفرم هوشمند پایش و تغذیه ایرانی',
    phase1Notice: 'پایه فنی و معماری فاز ۱ آماده است.',
    language: 'زبان',
    persian: 'فارسی',
    english: 'English',
    status: 'وضعیت',
    ready: 'آماده',
    version: 'نسخه',
    direction: 'جهت متن',
    rtl: 'راست به چپ (RTL)',
    ltr: 'چپ به راست (LTR)',
    activeLocale: 'زبان فعال',
  },
  apps: {
    web: {
      title: 'سامانه تحت وب NutriAI Persia',
      description:
        'پایگاه کاربری واکنش‌گرا و دسترس‌پذیر با پشتیبانی کامل از خط و چیدمان فارسی و انگلیسی',
      systemHealth: 'وضعیت سرویس API',
      checkingHealth: 'در حال بررسی سلامت سرویس...',
      storageFoundation: 'معماری فضای ذخیره‌سازی Backblaze B2',
      architectureNote: 'معماری ماژولار و مبتنی بر Monorepo و Cloudflare Workers',
    },
    admin: {
      title: 'پنل مدیریت NutriAI Persia',
      description: 'پوسته پایه مدیریت سیستم با ساختار مجزا و امن',
      protectedArea: 'بخش محافظت‌شده مدیریت',
      systemStatus: 'پایش زیرساخت',
    },
    mobile: {
      title: 'اپلیکیشن موبایل NutriAI Persia',
      description: 'پوسته پایه موبایل مبتنی بر React Native و Expo با پشتیبانی RTL',
    },
  },
  health: {
    ok: 'سالم و فعال',
    degraded: 'مختل',
    error: 'خطا در برقراری ارتباط',
    service: 'سرویس',
  },
} as const;
