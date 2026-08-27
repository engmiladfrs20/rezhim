import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../src/App';

describe('Admin Application Shell (apps/admin)', () => {
  it('renders admin title and language switcher', () => {
    render(<App />);
    expect(screen.getByText(/NutriAI Persia/i)).toBeDefined();
    const faBtn = screen.getByRole('button', { name: /فارسی/i });
    const enBtn = screen.getByRole('button', { name: /EN/i });
    expect(faBtn).toBeDefined();
    expect(enBtn).toBeDefined();

    fireEvent.click(enBtn);
    expect(enBtn.className).toContain('bg-indigo-600');

    fireEvent.click(faBtn);
    expect(faBtn.className).toContain('bg-indigo-600');
  });
});
