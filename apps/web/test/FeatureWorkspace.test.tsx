import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { FeatureWorkspace } from '../src/features/FeatureWorkspace';

describe('FeatureWorkspace', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('exposes user and admin Worker capability groups', () => {
    render(<FeatureWorkspace isAdmin />);
    expect(screen.getByRole('tab', { name: /غذا و جست/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /مدیریت/ })).toBeInTheDocument();
    expect(screen.getByText('فهرست غذاهای فعال')).toBeInTheDocument();
  });

  it('executes a selected API endpoint with the authenticated browser session', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { items: [] } }), { status: 200 }),
      );
    render(<FeatureWorkspace isAdmin={false} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'اجرا' })[0]!);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    expect(fetchSpy.mock.calls[0]?.[1]).toMatchObject({ credentials: 'include', method: 'GET' });
    expect(await screen.findByText(/items/)).toBeInTheDocument();
  });

  it('shows a helpful validation error for malformed JSON payloads', async () => {
    render(<FeatureWorkspace isAdmin={false} />);
    fireEvent.click(screen.getByRole('tab', { name: /تغذیه/ }));
    const textarea = screen.getAllByLabelText('بدنه JSON')[0]!;
    fireEvent.change(textarea, { target: { value: '{bad json' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'اجرا' })[0]!);
    expect(await screen.findByRole('alert')).toHaveTextContent(/JSON|property/i);
  });
});
