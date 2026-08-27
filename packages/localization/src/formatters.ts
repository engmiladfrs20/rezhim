import type { SupportedLocale } from '@nutriai/types';

export function formatNumber(
  value: number,
  locale: SupportedLocale = 'fa',
  options?: Intl.NumberFormatOptions,
): string {
  const intlLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
  return new Intl.NumberFormat(intlLocale, options).format(value);
}

export function formatDate(
  date: Date,
  locale: SupportedLocale = 'fa',
  options?: Intl.DateTimeFormatOptions,
): string {
  const intlLocale = locale === 'fa' ? 'fa-IR' : 'en-US';
  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...options,
  };
  return new Intl.DateTimeFormat(intlLocale, defaultOptions).format(date);
}
