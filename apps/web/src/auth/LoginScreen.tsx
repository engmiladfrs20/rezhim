import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginDto } from '@nutriai/schemas';
import { useAuth } from './AuthProvider';
import { Activity } from 'lucide-react';

export const LoginScreen = ({ onSwap }: { onSwap: () => void }) => {
  const { login } = useAuth();

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
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-sm mb-4">
            <Activity className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900">Sign in to NutriAI</h2>
          <p className="text-slate-500 text-sm mt-1">
            Provide your credentials to access your nutrition platform.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {errors.root && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm border border-red-100 flex items-center">
              {errors.root.message}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="loginEmail" className="text-sm font-medium text-slate-700">
              Email Address
            </label>
            <input
              id="loginEmail"
              type="email"
              {...register('email')}
              dir="ltr"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
            {errors.email && <p className="text-red-500 text-xs">{errors.email.message}</p>}
          </div>

          <div className="space-y-1.5">
            <label htmlFor="loginPassword" className="text-sm font-medium text-slate-700">
              Master Password
            </label>
            <input
              id="loginPassword"
              type="password"
              {...register('password')}
              dir="ltr"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all"
            />
            {errors.password && <p className="text-red-500 text-xs">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={!isValid || isSubmitting}
            className="w-full bg-emerald-600 text-white font-medium rounded-lg px-4 py-2.5 hover:bg-emerald-700 disabled:opacity-50 transition-colors mt-2"
          >
            {isSubmitting ? 'Authenticating...' : 'Secure Login'}
          </button>

          <div className="text-center pt-2 text-sm text-slate-600">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwap}
              className="text-emerald-600 hover:underline font-semibold"
            >
              Create One
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
