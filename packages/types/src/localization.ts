export type SupportedLocale = 'fa' | 'en';
export type Direction = 'rtl' | 'ltr';

export interface LocaleConfig {
  locale: SupportedLocale;
  direction: Direction;
  displayName: string;
  nativeName: string;
}

export interface I18nAdapter {
  getLocale(): SupportedLocale;
  setLocale(locale: SupportedLocale): void;
  getDirection(): Direction;
  t(key: string, params?: Record<string, string | number>): string;
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string;
}
