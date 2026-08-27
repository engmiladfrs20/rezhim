import type { SupportedLocale, Direction, I18nAdapter } from '@nutriai/types';
import { fa } from './locales/fa';
import { en } from './locales/en';
import { formatNumber, formatDate } from './formatters';
import type { TranslationKey } from './types';

export const SUPPORTED_LOCALES: readonly SupportedLocale[] = ['fa', 'en'] as const;
export const DEFAULT_LOCALE: SupportedLocale = 'fa';

export const LOCALE_DIRECTIONS: Record<SupportedLocale, Direction> = {
  fa: 'rtl',
  en: 'ltr',
};

const dictionaries = {
  fa,
  en,
};

export interface LocalePersistence {
  get(): SupportedLocale | null;
  set(locale: SupportedLocale): void;
}

export class MemoryLocalePersistence implements LocalePersistence {
  private current: SupportedLocale | null = null;
  get(): SupportedLocale | null {
    return this.current;
  }
  set(locale: SupportedLocale): void {
    this.current = locale;
  }
}

export class I18nService implements I18nAdapter {
  private currentLocale: SupportedLocale;
  private persistence?: LocalePersistence | undefined;
  private listeners = new Set<(locale: SupportedLocale, direction: Direction) => void>();

  constructor(initialLocale: SupportedLocale = DEFAULT_LOCALE, persistence?: LocalePersistence) {
    if (persistence !== undefined) {
      this.persistence = persistence;
    }
    const stored = persistence?.get();
    this.currentLocale = stored && SUPPORTED_LOCALES.includes(stored) ? stored : initialLocale;
  }

  public getLocale(): SupportedLocale {
    return this.currentLocale;
  }

  public getDirection(): Direction {
    return LOCALE_DIRECTIONS[this.currentLocale];
  }

  public setLocale(locale: SupportedLocale): void {
    if (!SUPPORTED_LOCALES.includes(locale)) {
      locale = DEFAULT_LOCALE;
    }
    if (this.currentLocale === locale) return;

    this.currentLocale = locale;
    if (this.persistence) {
      this.persistence.set(locale);
    }

    const dir = this.getDirection();
    this.listeners.forEach((listener) => listener(locale, dir));
  }

  public subscribe(listener: (locale: SupportedLocale, direction: Direction) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  public t(key: TranslationKey | string, params?: Record<string, string | number>): string {
    const keys = key.split('.');
    let current: unknown = dictionaries[this.currentLocale];

    for (const segment of keys) {
      if (current && typeof current === 'object' && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        // Fallback to DEFAULT_LOCALE
        current = dictionaries[DEFAULT_LOCALE];
        for (const fallbackSegment of keys) {
          if (current && typeof current === 'object' && fallbackSegment in current) {
            current = (current as Record<string, unknown>)[fallbackSegment];
          } else {
            return key; // return raw key if missing in both
          }
        }
        break;
      }
    }

    if (typeof current !== 'string') {
      return key;
    }

    let result = current;
    if (params) {
      for (const [paramKey, paramValue] of Object.entries(params)) {
        result = result.replace(new RegExp(`{{${paramKey}}}`, 'g'), String(paramValue));
      }
    }

    return result;
  }

  public formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return formatNumber(value, this.currentLocale, options);
  }

  public formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return formatDate(date, this.currentLocale, options);
  }
}

export const i18n = new I18nService();
