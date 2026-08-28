import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../src/App';
import { i18n } from '@nutriai/localization';

describe('Web Application Shell (apps/web)', () => {
  beforeEach(() => {
    i18n.setLocale('fa');
    vi.restoreAllMocks();
  });

  it('renders application title and locale switch buttons', () => {
    render(<App />);
    expect(screen.getAllByText(/NutriAI Persia/i)[0]).toBeDefined();
  });

  it('toggles locale and affects direction correctly', async () => {
    render(<App />);

    // We are initially 'fa' and RTL
    expect(document.documentElement.dir).toBe('rtl');

    // Click english button
    const enButton = screen.getByRole('button', { name: /English/i });
    fireEvent.click(enButton);

    expect(i18n.getLocale()).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    // Click farsi button
    const faButton = screen.getByRole('button', { name: /فارسی/i });
    fireEvent.click(faButton);

    expect(i18n.getLocale()).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('handles health check success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'ok',
        service: 'nutriai-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      }),
    });

    render(<App />);
    const checkBtn = screen.getByText(/تست GET \/health/i);

    fireEvent.click(checkBtn);

    // Should display loading state briefly (or disabled)
    expect(checkBtn.hasAttribute('disabled')).toBe(true);

    // After success, UI should reflect OK
    await waitFor(() => {
      expect(screen.getByText('OK')).toBeDefined();
    });
  });

  it('handles health check failures gracefully (degraded)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
    });

    render(<App />);
    const checkBtn = screen.getByText(/تست GET \/health/i);
    fireEvent.click(checkBtn);

    // After fail, UI should reflect DEGRADED
    await waitFor(() => {
      expect(screen.getByText('DEGRADED')).toBeDefined();
    });
  });

  it('handles network error fallback rendering', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network failure'));

    render(<App />);
    const checkBtn = screen.getByText(/تست GET \/health/i);
    fireEvent.click(checkBtn);

    await waitFor(() => {
      expect(screen.getByText(/Local Mock Mode/i)).toBeDefined();
    });
  });
});
