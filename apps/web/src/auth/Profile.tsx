import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { useAuth } from './AuthProvider';
import { i18n } from '@nutriai/localization';
import { User, Lock, Save, CheckCircle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787';

export const Profile: FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [locale, setLocale] = useState<'fa' | 'en'>(user?.locale || 'fa');
  const [profileMessage, setProfileMessage] = useState('');
  const [profileError, setProfileError] = useState('');

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');

  useEffect(() => {
    if (user) {
      setDisplayName(user.display_name);
      setLocale(user.locale);
    }
  }, [user]);

  const updateProfileMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/users/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ display_name: displayName, locale }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: { message?: string } };
        throw new Error(d.error?.message || 'Profile update failed');
      }
    },
    onSuccess: () => {
      setProfileMessage(i18n.t('auth.success') || 'Profile updated successfully');
      setProfileError('');
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
    },
    onError: (err: unknown) => {
      setProfileError(err instanceof Error ? err.message : 'Profile update failed');
      setProfileMessage('');
    },
  });

  const changePwMut = useMutation({
    mutationFn: async () => {
      const res = await fetch(`${API_URL}/api/v1/auth/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!res.ok) {
        const d = (await res.json()) as { error?: { message?: string } };
        throw new Error(d.error?.message || 'Password change failed');
      }
    },
    onSuccess: () => {
      setPwMessage(i18n.t('auth.success') || 'Password changed successfully');
      setPwError('');
      setCurrentPassword('');
      setNewPassword('');
    },
    onError: (err: unknown) => {
      setPwError(err instanceof Error ? err.message : 'Password change failed');
      setPwMessage('');
    },
  });

  if (!user) return null;

  return (
    <div className="w-full max-w-2xl mx-auto space-y-6">
      {/* Profile Edit Card */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/60 shadow-xl text-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <User className="w-6 h-6 text-indigo-400" />
          {i18n.t('auth.profile') || 'User Profile'}
        </h2>

        {profileMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">{profileMessage}</span>
          </div>
        )}

        {profileError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
            {profileError}
          </div>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            updateProfileMut.mutate();
          }}
        >
          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">{i18n.t('auth.email') || 'Email'}</span>
            <div className="px-4 py-2 bg-slate-900 rounded-lg text-slate-300 border border-slate-700/50">
              {user.email}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="displayNameInput" className="text-slate-400 text-sm">
              {i18n.t('auth.displayName') || 'Display Name'}
            </label>
            <input
              id="displayNameInput"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
              minLength={2}
              maxLength={50}
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="localeSelect" className="text-slate-400 text-sm">
              {i18n.t('common.language') || 'Language'}
            </label>
            <select
              id="localeSelect"
              value={locale}
              onChange={(e) => setLocale(e.target.value as 'fa' | 'en')}
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="fa">فارسی (FA)</option>
              <option value="en">English (EN)</option>
            </select>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={updateProfileMut.isPending}
              className="flex items-center justify-center gap-2 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {updateProfileMut.isPending ? '...' : i18n.t('auth.saveChanges') || 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Password Change Card */}
      <div className="bg-slate-800 rounded-2xl p-6 border border-slate-700/60 shadow-xl text-slate-100">
        <h2 className="text-xl font-bold flex items-center gap-2 mb-6">
          <Lock className="w-6 h-6 text-indigo-400" />
          {i18n.t('auth.changePassword') || 'Change Password'}
        </h2>

        {pwMessage && (
          <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-sm">{pwMessage}</span>
          </div>
        )}

        {pwError && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm">
            {pwError}
          </div>
        )}

        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            changePwMut.mutate();
          }}
        >
          <div className="flex flex-col gap-1">
            <label htmlFor="currentPasswordInput" className="text-slate-400 text-sm">
              {i18n.t('auth.currentPassword') || 'Current Password'}
            </label>
            <input
              id="currentPasswordInput"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="newPasswordInput" className="text-slate-400 text-sm">
              {i18n.t('auth.newPassword') || 'New Password'}
            </label>
            <input
              id="newPasswordInput"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={12}
              maxLength={128}
              className="px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-slate-100 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={changePwMut.isPending}
              className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {changePwMut.isPending ? '...' : i18n.t('auth.changePassword') || 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
