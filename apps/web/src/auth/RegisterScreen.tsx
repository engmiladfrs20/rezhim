import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { registerSchema, type RegisterDto } from '@nutriai/schemas';
import { i18n, type SupportedLocale } from '@nutriai/localization';
import { useAuth } from './AuthProvider';
import { Activity } from 'lucide-react';

export const RegisterScreen = ({
  onSwap,
  initialLocale = 'en',
}: {
  onSwap: (locale: SupportedLocale) => void;
  initialLocale?: SupportedLocale;
}) => {
  const { register: registerAuth } = useAuth();
  const [locale, setLocale] = useState<SupportedLocale>(initialLocale);

  const copy =
    locale === 'fa'
      ? {
          title: 'ساخت حساب کاربری',
          subtitle: 'برای دریافت برنامه تغذیه شخصی‌سازی‌شده به NutriAI بپیوندید.',
          displayName: 'نام نمایشی',
          email: 'ایمیل',
          password: 'رمز عبور (حداقل ۱۲ کاراکتر)',
          requirements: 'نام، ایمیل معتبر و رمز عبور حداقل ۱۲ کاراکتری را وارد کنید.',
          submit: 'ساخت حساب',
          submitting: 'در حال ثبت‌نام...',
          prompt: 'قبلاً حساب دارید؟',
          login: 'ورود',
          direction: 'rtl' as const,
        }
      : {
          title: 'Create Account',
          subtitle: 'Join NutriAI to get personalized nutrition plans.',
          displayName: 'Display Name',
          email: 'Email Address',
          password: 'Master Password (12+ chars)',
          requirements:
            'Enter a display name, a valid email, and a password of at least 12 characters.',
          submit: 'Create Account',
          submitting: 'Registering...',
          prompt: 'Already have an account?',
          login: 'Log in',
          direction: 'ltr' as const,
        };

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    setError,
  } = useForm<RegisterDto>({
    resolver: zodResolver(registerSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: RegisterDto) => {
    try {
      await registerAuth(data);
    } catch (err: unknown) {
      setError('root', { message: err instanceof Error ? err.message : 'Registration failed' });
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4"
      dir={copy.direction}
    >
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex justify-end gap-2 text-xs" aria-label="Registration language">
          <button
            type="button"
            onClick={() => {
              setLocale('fa');
              i18n.setLocale('fa');
            }}
            aria-pressed={locale === 'fa'}
            className={`px-2.5 py-1 rounded ${
              locale === 'fa' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            فارسی
          </button>
          <button
            type="button"
            onClick={() => {
              setLocale('en');
              i18n.setLocale('en');
            }}
            aria-pressed={locale === 'en'}
            className={`px-2.5 py-1 rounded ${
              locale === 'en' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            EN
          </button>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-sm mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">{copy.title}</h2>
          <p className="text-slate-500 text-sm mt-1">{copy.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div
              role="alert"
              aria-live="polite"
              className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100 flex items-center"
            >
              {errors.root.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="regDisplayName" className="text-sm font-medium text-slate-700">
              {copy.displayName}
            </label>
            <input
              id="regDisplayName"
              type="text"
              {...register('display_name')}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
            {errors.display_name && (
              <p className="text-red-500 text-xs">{errors.display_name.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="regEmail" className="text-sm font-medium text-slate-700">
              {copy.email}
            </label>
            <input
              id="regEmail"
              type="email"
              {...register('email')}
              dir="ltr"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
            {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="regPassword" className="text-sm font-medium text-slate-700">
              {copy.password}
            </label>
            <input
              id="regPassword"
              type="password"
              {...register('password')}
              autoComplete="new-password"
              dir="ltr"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
            {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
            <p className="text-slate-500 text-xs" role="note">
              {copy.requirements}
            </p>
          </div>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-emerald-600 text-white font-medium rounded-lg px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-50 transition-colors mt-2"
          >
            {isSubmitting ? copy.submitting : copy.submit}
          </button>

          <div className="text-center pt-2 text-sm text-slate-600">
            {copy.prompt}{' '}
            <button
              type="button"
              onClick={() => onSwap(locale)}
              className="text-emerald-600 hover:underline font-semibold"
            >
              {copy.login}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
