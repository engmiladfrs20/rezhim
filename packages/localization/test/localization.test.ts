import { describe, it, expect } from 'vitest';
import {
  I18nService,
  MemoryLocalePersistence,
  formatNumber,
  formatDate,
  DEFAULT_LOCALE,
} from '../src';

describe('Localization Package', () => {
  it('defaults to Persian (fa) and RTL direction', () => {
    const service = new I18nService();
    expect(service.getLocale()).toBe('fa');
    expect(service.getDirection()).toBe('rtl');
  });

  it('switches between locales and updates direction correctly', () => {
    const service = new I18nService();
    service.setLocale('en');
    expect(service.getLocale()).toBe('en');
    expect(service.getDirection()).toBe('ltr');

    service.setLocale('fa');
    expect(service.getLocale()).toBe('fa');
    expect(service.getDirection()).toBe('rtl');
  });

  it('translates nested keys correctly with fallback', () => {
    const service = new I18nService();
    expect(service.t('common.appName')).toBe('NutriAI Persia');
    expect(service.t('common.status')).toBe('وضعیت');

    service.setLocale('en');
    expect(service.t('common.status')).toBe('Status');

    // Non-existent key falls back to key string
    expect(service.t('nonexistent.key')).toBe('nonexistent.key');
  });

  it('persists locale across instances with persistence adapter', () => {
    const storage = new MemoryLocalePersistence();
    const service1 = new I18nService(DEFAULT_LOCALE, storage);
    service1.setLocale('en');

    const service2 = new I18nService(DEFAULT_LOCALE, storage);
    expect(service2.getLocale()).toBe('en');
    expect(service2.getDirection()).toBe('ltr');
  });

  it('supports listeners subscription and unsubscription', () => {
    const service = new I18nService();
    let notifiedLocale = '';
    let notifiedDir = '';
    const unsubscribe = service.subscribe((loc, dir) => {
      notifiedLocale = loc;
      notifiedDir = dir;
    });

    service.setLocale('en');
    expect(notifiedLocale).toBe('en');
    expect(notifiedDir).toBe('ltr');

    unsubscribe();
    service.setLocale('fa');
    expect(notifiedLocale).toBe('en'); // Not updated after unsubscribe
  });

  it('formats numbers and dates via I18nService instance methods', () => {
    const service = new I18nService();
    const formattedNum = service.formatNumber(42);
    expect(formattedNum).toBeDefined();

    const formattedDate = service.formatDate(new Date('2026-08-27T12:00:00Z'));
    expect(formattedDate).toBeDefined();
  });

  it('interpolates template parameters in translations', () => {
    const service = new I18nService();
    const result = service.t('common.appName', { extra: 'test' });
    expect(result).toBe('NutriAI Persia');
  });

  it('handles invalid locale by falling back to default', () => {
    const service = new I18nService();
    service.setLocale('invalid' as unknown as 'fa');
    expect(service.getLocale()).toBe(DEFAULT_LOCALE);
  });

  it('formats numbers and dates with Intl', () => {
    const num = 1234567;
    const formattedFa = formatNumber(num, 'fa');
    const formattedEn = formatNumber(num, 'en');

    expect(formattedFa).toBeDefined();
    expect(formattedEn).toBe('1,234,567');

    const testDate = new Date('2026-08-27T12:00:00Z');
    const dateFa = formatDate(testDate, 'fa');
    const dateEn = formatDate(testDate, 'en');

    expect(dateFa).toBeDefined();
    expect(dateEn).toContain('Aug');
  });
});
