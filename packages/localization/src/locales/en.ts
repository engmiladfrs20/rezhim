import type { TranslationDictionary } from '../types';

export const en: TranslationDictionary = {
  common: {
    appName: 'NutriAI Persia',
    tagline: 'Intelligent Nutrition & Monitoring Platform',
    phase1Notice: 'Phase 1 technical & architectural foundation ready.',
    language: 'Language',
    persian: 'فارسی',
    english: 'English',
    status: 'Status',
    ready: 'Ready',
    version: 'Version',
    direction: 'Text Direction',
    rtl: 'Right-to-Left (RTL)',
    ltr: 'Left-to-Right (LTR)',
    activeLocale: 'Active Locale',
  },
  apps: {
    web: {
      title: 'NutriAI Persia Web App',
      description:
        'Responsive, accessible user shell with complete Persian and English RTL/LTR support',
      systemHealth: 'API Service Health',
      checkingHealth: 'Checking service health...',
      storageFoundation: 'Backblaze B2 Storage Architecture',
      architectureNote: 'Modular architecture powered by Monorepo & Cloudflare Workers',
    },
    admin: {
      title: 'NutriAI Persia Admin Portal',
      description: 'Foundation admin shell with isolated, secure layout placeholder',
      protectedArea: 'Protected Management Area',
      systemStatus: 'Infrastructure Monitoring',
    },
    mobile: {
      title: 'NutriAI Persia Mobile App',
      description: 'Foundation mobile shell based on React Native and Expo with RTL support',
    },
  },
  health: {
    ok: 'Healthy & Operational',
    degraded: 'Degraded',
    error: 'Connection Error',
    service: 'Service',
  },
};
