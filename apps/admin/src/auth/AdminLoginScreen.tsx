import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@nutriai/schemas';
import { i18n, type SupportedLocale } from '@nutriai/localization';
import { useAdminAuth } from './AdminAuthProvider';
import { Server } from 'lucide-react';

export const AdminLoginScreen = () => {
  const { login } = useAdminAuth();
  const [locale, setLocale] = useState<SupportedLocale>('en');

  const copy =
    locale === 'fa'
      ? {
          title: 'پنل مدیریت NutriAI Persia',
          subtitle: 'دسترسی فقط برای مدیران مجاز است.',
          email: 'ایمیل مدیر',
          password: 'رمز عبور',
          submit: 'ورود مدیر',
          submitting: 'در حال احراز هویت...',
          direction: 'rtl' as const,
        }
      : {
          title: 'NutriAI Persia Admin Portal',
          subtitle: 'Authorized administrator access only.',
          email: 'Administrator Email',
          password: 'Password',
          submit: 'Sign In as Admin',
          submitting: 'Authenticating...',
          direction: 'ltr' as const,
        };

  const {
    register,
    handleSubmit,
    formState: { errors, isValid, isSubmitting },
    setError,
  } = useForm<LoginDto>({
    resolver: zodResolver(loginSchema),
    mode: 'onChange',
  });

  const onSubmit = async (data: LoginDto) => {
    try {
      await login(data);
    } catch (err: unknown) {
      setError('root', { message: err instanceof Error ? err.message : 'Login failed' });
    }
  };

  return (
    <div
      className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4"
      dir={copy.direction}
    >
      <div className="w-full max-w-md bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl p-8 space-y-6">
        <div className="flex justify-end gap-2 text-xs" aria-label="Login language">
          <button
            type="button"
            onClick={() => {
              setLocale('fa');
              i18n.setLocale('fa');
            }}
            aria-pressed={locale === 'fa'}
            className={`px-2.5 py-1 rounded ${
              locale === 'fa' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
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
              locale === 'en' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            EN
          </button>
        </div>
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-indigo-500 text-white flex items-center justify-center font-bold text-xl shadow-lg mb-4">
            <Server className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-white">{copy.title}</h2>
          <p className="text-slate-400 text-sm mt-1">{copy.subtitle}</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="bg-red-500/10 text-red-400 p-3 rounded-lg text-sm border border-red-500/20 flex items-center">
              {errors.root.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="adminEmail" className="text-sm font-medium text-slate-300">
              {copy.email}
            </label>
            <input
              id="adminEmail"
              type="email"
              {...register('email')}
              dir="ltr"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
            />
            {errors.email && <p className="text-red-400 text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="adminPassword" className="text-sm font-medium text-slate-300">
              {copy.password}
            </label>
            <input
              id="adminPassword"
              type="password"
              {...register('password')}
              dir="ltr"
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 outline-none transition-all"
            />
            {errors.password && <p className="text-red-400 text-xs">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-indigo-600 text-white font-medium rounded-lg px-4 py-2.5 hover:bg-indigo-700 disabled:opacity-50 transition-colors mt-4"
          >
            {isSubmitting ? copy.submitting : copy.submit}
          </button>
        </form>
      </div>
    </div>
  );
};
