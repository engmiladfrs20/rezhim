import { useEffect, useState } from 'react';
import type { FC } from 'react';
import {
  Activity,
  ChevronDown,
  CircleHelp,
  LogOut,
  Settings2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useAuth } from './auth/AuthProvider';
import { LoginScreen } from './auth/LoginScreen';
import { RegisterScreen } from './auth/RegisterScreen';
import { Profile } from './auth/Profile';
import { DailyDashboard } from './dashboard/DailyDashboard';
import { UserDashboard } from './dashboard/UserDashboard';
import { FeatureWorkspace } from './features/FeatureWorkspace';
import { i18n, type Direction, type SupportedLocale } from '@nutriai/localization';
import type { HealthCheckResponse } from '@nutriai/types';

export const App: FC = () => {
  const { user, logout, isLoading: authLoading } = useAuth();
  const [locale, setLocale] = useState<SupportedLocale>(i18n.getLocale());
  const [direction, setDirection] = useState<Direction>(i18n.getDirection());
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [authLocale, setAuthLocale] = useState<SupportedLocale>('en');
  const [healthStatus, setHealthStatus] = useState<HealthCheckResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = direction;
    return i18n.subscribe((nextLocale, nextDirection) => {
      setLocale(nextLocale);
      setDirection(nextDirection);
      document.documentElement.lang = nextLocale;
      document.documentElement.dir = nextDirection;
    });
  }, [locale, direction]);

  const toggleLocale = (nextLocale: SupportedLocale) => {
    i18n.setLocale(nextLocale);
    setLocale(nextLocale);
    setDirection(i18n.getDirection());
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const base =
        import.meta.env.VITE_API_BASE_URL ||
        (import.meta.env.DEV
          ? 'http://localhost:8787'
          : 'https://nutriai-api-production.rezhimvip.workers.dev');
      const response = await fetch(`${base}/health`);
      setHealthStatus(response.ok ? ((await response.json()) as HealthCheckResponse) : null);
    } catch {
      setHealthStatus(null);
    } finally {
      setHealthLoading(false);
    }
  };

  if (authLoading)
    return (
      <div className="grid min-h-screen place-items-center bg-slate-950">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-emerald-400 border-t-transparent" />
      </div>
    );
  if (!user)
    return authView === 'login' ? (
      <LoginScreen
        initialLocale={authLocale}
        onSwap={(nextLocale) => {
          setAuthLocale(nextLocale);
          setAuthView('register');
        }}
      />
    ) : (
      <RegisterScreen
        initialLocale={authLocale}
        onSwap={(nextLocale) => {
          setAuthLocale(nextLocale);
          setAuthView('login');
        }}
      />
    );

  return (
    <main id="app-root" className="min-h-screen bg-[#f5f7fb] text-slate-900">
      <header
        id="main-header"
        className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl sm:px-8"
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-sm font-black text-white shadow-lg shadow-emerald-200">
              NA
            </div>
            <div>
              <p className="text-base font-black tracking-tight text-slate-900">NutriAI Persia</p>
              <p className="hidden text-[11px] text-slate-500 sm:block">
                دستیار شخصی سلامت و تغذیه
              </p>
            </div>
          </div>
          <nav aria-label="Language selection" className="flex items-center gap-2">
            <div
              id="locale-switch-group"
              className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold"
            >
              <button
                id="btn-lang-fa"
                type="button"
                onClick={() => toggleLocale('fa')}
                className={`rounded-lg px-3 py-1.5 transition ${locale === 'fa' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
              >
                فارسی
              </button>
              <button
                id="btn-lang-en"
                type="button"
                onClick={() => toggleLocale('en')}
                className={`rounded-lg px-3 py-1.5 transition ${locale === 'en' ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500'}`}
              >
                English
              </button>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">خروج</span>
            </button>
          </nav>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex items-center justify-between gap-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">
            <Sparkles className="h-3.5 w-3.5" /> برنامهٔ شخصی تو، همین‌جا
          </div>
          <p className="hidden text-xs text-slate-400 sm:block">
            نسخهٔ وب پیش‌رونده · {direction.toUpperCase()}
          </p>
        </div>
        <UserDashboard
          user={user}
          locale={locale}
          onOpenSettings={() =>
            document.getElementById('account-settings')?.scrollIntoView({ behavior: 'smooth' })
          }
        />
        <details
          open
          className="group rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-50 text-sky-600">
                <Activity className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-900">ردگیری روزانه</h2>
                <p className="mt-1 text-xs text-slate-500">
                  آب، وزن و روزه‌ات را در یک نگاه ثبت کن.
                </p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-100 p-5 sm:p-6">
            <DailyDashboard />
          </div>
        </details>
        <details
          id="account-settings"
          className="group rounded-[1.75rem] border border-slate-200 bg-white shadow-sm"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-violet-50 text-violet-600">
                <Settings2 className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black text-slate-900">تنظیمات حساب</h2>
                <p className="mt-1 text-xs text-slate-500">پروفایل، رمز عبور و زبان برنامه</p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <div className="border-t border-slate-100 p-5 sm:p-6">
            <Profile />
          </div>
        </details>
        <details className="group rounded-[1.75rem] border border-slate-200 bg-slate-900 shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 text-white sm:p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-black">ابزار فنی و مدیریت</h2>
                <p className="mt-1 text-xs text-slate-400">
                  برای بررسی API و قابلیت‌های مدیریتی؛ مناسب تیم محصول
                </p>
              </div>
            </div>
            <ChevronDown className="h-5 w-5 text-slate-400 transition group-open:rotate-180" />
          </summary>
          <div className="space-y-5 border-t border-white/10 p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/5 p-4">
              <div>
                <p className="text-sm font-bold text-white">وضعیت اتصال سرویس</p>
                <p className="mt-1 text-xs text-slate-400">این بخش برای کاربر عادی ضروری نیست.</p>
              </div>
              <button
                id="btn-check-health"
                type="button"
                onClick={() => void checkHealth()}
                disabled={healthLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-60"
              >
                {healthLoading ? 'در حال بررسی…' : 'تست GET /health'}
              </button>
              {healthStatus && (
                <span className="rounded-lg bg-emerald-400/15 px-3 py-2 text-xs font-bold text-emerald-300">
                  {healthStatus.status === 'ok' ? 'OK' : healthStatus.status.toUpperCase()}
                </span>
              )}
            </div>
            <FeatureWorkspace isAdmin={user.role === 'admin'} />
          </div>
        </details>
        <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
          <CircleHelp className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            NutriAI برای کمک به برنامه‌ریزی روزانه است؛ اگر بیماری زمینه‌ای، بارداری یا داروی خاص
            دارید قبل از تغییر رژیم با متخصص تغذیه مشورت کنید.
          </p>
        </section>
      </div>
      <footer
        id="main-footer"
        className="border-t border-slate-200 bg-white px-4 py-6 text-center text-xs text-slate-400"
      >
        NutriAI Persia · دستیار سلامت شخصی · ۲۰۲۶
      </footer>
    </main>
  );
};

export default App;
