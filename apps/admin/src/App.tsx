import { useState } from 'react';
import type { FC } from 'react';
import { i18n, type SupportedLocale } from '@nutriai/localization';
import { Shield, Lock, Server } from 'lucide-react';

export const App: FC = () => {
  const [locale, setLocale] = useState<SupportedLocale>(i18n.getLocale());

  const toggleLocale = (target: SupportedLocale) => {
    i18n.setLocale(target);
    setLocale(target);
  };

  return (
    <main id="admin-app-root" className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      <header
        id="admin-header"
        className="w-full bg-slate-800 border-b border-slate-700 px-6 py-4 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold">
            <Shield className="w-4 h-4 text-white" />
          </div>
          <h1 className="text-base font-semibold">{i18n.t('apps.admin.title')}</h1>
        </div>

        <div className="flex gap-2 text-xs">
          <button
            id="admin-btn-fa"
            type="button"
            onClick={() => toggleLocale('fa')}
            className={`px-2.5 py-1 rounded ${
              locale === 'fa' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            فارسی
          </button>
          <button
            id="admin-btn-en"
            type="button"
            onClick={() => toggleLocale('en')}
            className={`px-2.5 py-1 rounded ${
              locale === 'en' ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300'
            }`}
          >
            EN
          </button>
        </div>
      </header>

      <div className="flex-1 max-w-4xl mx-auto w-full p-8 flex flex-col justify-center items-center text-center space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-indigo-400">
          <Lock className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-slate-100">{i18n.t('apps.admin.protectedArea')}</h2>
          <p className="text-sm text-slate-400 max-w-md">{i18n.t('apps.admin.description')}</p>
        </div>

        <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-4 text-xs text-slate-400 flex items-center gap-3">
          <Server className="w-4 h-4 text-indigo-400" />
          <span>پوسته پایه مدیریت برای فاز ۱ تفکیک و پیاده‌سازی شده است.</span>
        </div>
      </div>
    </main>
  );
};

export default App;
