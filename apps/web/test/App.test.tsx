import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../src/auth/AuthProvider';
import App from '../src/App';
import type { PublicUser, ApiResponse } from '@nutriai/types';

const mockUser: PublicUser = {
  id: 'usr-12345678-abcd',
  email: 'webuser@example.com',
  display_name: 'Web Tester',
  role: 'user',
  status: 'active',
  locale: 'fa',
  email_verified_at: null,
  last_login_at: '2026-08-29T10:00:00.000Z',
  created_at: '2026-08-29T09:00:00.000Z',
  updated_at: '2026-08-29T09:00:00.000Z',
};

function renderApp(initialUser: PublicUser | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if (initialUser) {
    queryClient.setQueryData(['auth', 'me'], initialUser);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('Web App - Authentication, Profile, Session Restoration, & Localization', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders login screen when unauthenticated and switches to registration screen', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderApp();

    expect(await screen.findByText(/Sign in to NutriAI/i)).toBeInTheDocument();

    const switchBtn = screen.getByRole('button', { name: /Create One/i });
    fireEvent.click(switchBtn);

    expect(await screen.findByRole('heading', { name: /Create Account/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();
  });

  it('switches the unauthenticated login screen between Persian RTL and English LTR', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      if (String(url).includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderApp();

    const faButton = await screen.findByRole('button', { name: 'فارسی' });
    fireEvent.click(faButton);
    expect(screen.getByRole('heading', { name: /ورود به NutriAI/i })).toBeInTheDocument();
    expect(faButton.closest('[dir]')).toHaveAttribute('dir', 'rtl');
    expect(screen.getByRole('button', { name: 'ورود امن' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'EN' }));
    expect(screen.getByRole('heading', { name: /Sign in to NutriAI/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Secure Login' })).toBeInTheDocument();
  });

  it('handles user login submission and displays error on failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      if (urlStr.includes('/api/v1/auth/login')) {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Invalid email or password' } }),
          { status: 401 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    renderApp();

    const emailInput = await screen.findByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Master Password/i);

    fireEvent.change(emailInput, { target: { value: 'wrong@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'WrongPassword123!' } });

    const form = emailInput.closest('form')!;
    fireEvent.submit(form);

    expect(await screen.findByText(/Invalid email or password/i)).toBeInTheDocument();
  });

  it('handles user registration and includes credentials: include', async () => {
    const fetchCalls: Array<{ url: string; init?: RequestInit | undefined }> = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      fetchCalls.push({ url: String(url), init });
      const urlStr = String(url);

      if (urlStr.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      }
      if (urlStr.includes('/api/v1/auth/register')) {
        const response: ApiResponse<{ user: PublicUser }> = {
          success: true,
          data: { user: mockUser },
        };
        return new Response(JSON.stringify(response), { status: 201 });
      }
      if (urlStr.includes('/api/v1/auth/login')) {
        return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ success: true }), { status: 200 });
    });

    renderApp();

    // Switch to register view
    fireEvent.click(await screen.findByRole('button', { name: /Create One/i }));

    const nameInput = await screen.findByLabelText(/Display Name/i);
    const emailInput = screen.getByLabelText(/Email Address/i);
    const passwordInput = screen.getByLabelText(/Master Password/i);

    fireEvent.change(nameInput, { target: { value: 'New Registrant' } });
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'SecurePassword123!' } });

    const form = nameInput.closest('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      const regCall = fetchCalls.find((c) => c.url.includes('/api/v1/auth/register'));
      expect(regCall).toBeDefined();
      expect(regCall?.init?.credentials).toBe('include');
    });
  });

  it('restores cookie session on load and displays user profile and main UI', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/me')) {
        expect(init?.credentials).toBe('include');
        return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    });

    renderApp();

    expect(await screen.findByDisplayValue('Web Tester')).toBeInTheDocument();
    expect(screen.getByText('webuser@example.com')).toBeInTheDocument();
    expect(screen.getAllByText(/NutriAI/i).length).toBeGreaterThan(0);
  });

  it('checks API health from the UI dashboard', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes('/health')) {
        return new Response(
          JSON.stringify({
            status: 'ok',
            service: 'nutriai-api',
            version: '1.0.0',
            timestamp: '2026-08-29T12:00:00Z',
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
        status: 200,
      });
    });

    renderApp(mockUser);

    const healthBtn = await screen.findByRole('button', { name: /تست GET \/health|health/i });
    fireEvent.click(healthBtn);

    await waitFor(() => {
      expect(screen.getByText('OK')).toBeInTheDocument();
    });
  });

  it('edits user profile (display name and locale) using PATCH /api/v1/users/me with credentials: include', async () => {
    let patchCalled = false;
    let patchInit: RequestInit | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me') && init?.method === 'PATCH') {
        patchCalled = true;
        patchInit = init;
        return new Response(
          JSON.stringify({
            success: true,
            data: { user: { ...mockUser, display_name: 'Updated Name', locale: 'en' } },
          }),
          { status: 200 },
        );
      }
      if (urlStr.includes('/api/v1/auth/me')) {
        return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ status: 'ok' }), { status: 200 });
    });

    renderApp(mockUser);

    const nameInput = await screen.findByDisplayValue('Web Tester');
    fireEvent.change(nameInput, { target: { value: 'Updated Name' } });

    const saveBtn = screen.getByRole('button', { name: /Save Changes|ذخیره تغییرات/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(patchCalled).toBe(true);
      expect(patchInit?.credentials).toBe('include');
      expect(JSON.parse(String(patchInit?.body))).toEqual({
        display_name: 'Updated Name',
        locale: 'fa',
      });
    });
  });

  it('displays error when profile update fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/users/me') && init?.method === 'PATCH') {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Invalid display name' } }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
        status: 200,
      });
    });

    renderApp(mockUser);

    const saveBtn = await screen.findByRole('button', { name: /Save Changes|ذخیره تغییرات/i });
    fireEvent.click(saveBtn);

    expect(await screen.findByText(/Invalid display name/i)).toBeInTheDocument();
  });

  it('changes password with POST /api/v1/auth/change-password and credentials: include', async () => {
    let changePwCalled = false;
    let changePwInit: RequestInit | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/change-password') && init?.method === 'POST') {
        changePwCalled = true;
        changePwInit = init;
        return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
        status: 200,
      });
    });

    renderApp(mockUser);

    const currentPwInput = await screen.findByLabelText(/Current Password|رمز عبور فعلی/i);
    const newPwInput = screen.getByLabelText(/New Password|رمز عبور جدید/i);

    fireEvent.change(currentPwInput, { target: { value: 'OldPassword123!' } });
    fireEvent.change(newPwInput, { target: { value: 'BrandNewPassword456!' } });

    const submitBtn = screen.getByRole('button', { name: /Change Password|تغییر رمز عبور/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(changePwCalled).toBe(true);
      expect(changePwInit?.credentials).toBe('include');
      expect(JSON.parse(String(changePwInit?.body))).toEqual({
        current_password: 'OldPassword123!',
        new_password: 'BrandNewPassword456!',
      });
    });
  });

  it('displays error when password change fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/change-password') && init?.method === 'POST') {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Incorrect current password' } }),
          { status: 401 },
        );
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
        status: 200,
      });
    });

    renderApp(mockUser);

    const currentPwInput = await screen.findByLabelText(/Current Password|رمز عبور فعلی/i);
    const newPwInput = screen.getByLabelText(/New Password|رمز عبور جدید/i);

    fireEvent.change(currentPwInput, { target: { value: 'WrongCurrentPassword' } });
    fireEvent.change(newPwInput, { target: { value: 'BrandNewPassword456!' } });

    const submitBtn = screen.getByRole('button', { name: /Change Password|تغییر رمز عبور/i });
    fireEvent.click(submitBtn);

    expect(await screen.findByText(/Incorrect current password/i)).toBeInTheDocument();
  });

  it('logs out and clears session with credentials: include', async () => {
    let logoutCalled = false;
    let logoutInit: RequestInit | undefined;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
      const urlStr = String(url);
      if (urlStr.includes('/api/v1/auth/logout') && init?.method === 'POST') {
        logoutCalled = true;
        logoutInit = init;
        return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
      }
      return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
        status: 200,
      });
    });

    renderApp(mockUser);

    const logoutBtn = await screen.findByRole('button', { name: /Logout|خروج/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(logoutCalled).toBe(true);
      expect(logoutInit?.credentials).toBe('include');
    });
  });

  it('toggles Persian/English and synchronizes html dir and lang attributes', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
        status: 200,
      });
    });

    renderApp(mockUser);

    // Switch to English
    const enBtn = await screen.findByRole('button', { name: /English/i });
    fireEvent.click(enBtn);

    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.dir).toBe('ltr');

    // Switch to Persian
    const faBtn = screen.getByRole('button', { name: /فارسی/i });
    fireEvent.click(faBtn);

    expect(document.documentElement.lang).toBe('fa');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('throws error when useAuth is used outside of AuthProvider', () => {
    const TestComponent = () => {
      useAuth();
      return <div>Test</div>;
    };

    expect(() => render(<TestComponent />)).toThrow('useAuth must be used within an AuthProvider');
  });
});
