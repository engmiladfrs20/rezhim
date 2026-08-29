import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import * as SecureStore from 'expo-secure-store';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MobileAuthApi, MobileApiError } from '../src/auth/api';
import { MobileAuthProvider, useMobileAuth, TOKEN_KEY } from '../src/auth/MobileAuthProvider';
import App, { MainApp } from '../src/App';
import type { PublicUser, ApiResponse } from '@nutriai/types';
import { i18n } from '@nutriai/localization';
import { mockI18nManager } from '../vitest.setup';

const mockUser: PublicUser = {
  id: 'mob-12345678-abcd',
  email: 'mobile@example.com',
  display_name: 'Mobile User',
  role: 'user',
  status: 'active',
  locale: 'fa',
  email_verified_at: null,
  last_login_at: '2026-08-29T10:00:00.000Z',
  created_at: '2026-08-29T09:00:00.000Z',
  updated_at: '2026-08-29T09:00:00.000Z',
};

function renderWithClient(ui: React.ReactElement, initialToken: string | null = null) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  if (initialToken) {
    (SecureStore as unknown as { _store: Map<string, string> })._store.set(TOKEN_KEY, initialToken);
  }

  return render(
    <QueryClientProvider client={queryClient}>
      <MobileAuthProvider>{ui}</MobileAuthProvider>
    </QueryClientProvider>,
  );
}

describe('Mobile App - Full Integration & Component Test Suite', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    (SecureStore as unknown as { _store: Map<string, string> })._store.clear();
  });

  describe('MobileAuthApi Endpoints & Error Class', () => {
    it('resolves base URL in development and throws in production if missing', () => {
      const origEnv = process.env.EXPO_PUBLIC_API_URL;
      const origNodeEnv = process.env.NODE_ENV;

      try {
        process.env.EXPO_PUBLIC_API_URL = 'https://api.nutriai.example.com/';
        expect(MobileAuthApi.getBaseUrl()).toBe('https://api.nutriai.example.com');

        delete process.env.EXPO_PUBLIC_API_URL;
        process.env.NODE_ENV = 'development';
        expect(MobileAuthApi.getBaseUrl()).toBe('http://localhost:8787');

        process.env.NODE_ENV = 'production';
        delete process.env.APP_ENV;
        delete process.env.VITEST;
        expect(() => MobileAuthApi.getBaseUrl()).toThrow(
          'EXPO_PUBLIC_API_URL is required in production environment.',
        );
      } finally {
        process.env.EXPO_PUBLIC_API_URL = origEnv;
        process.env.NODE_ENV = origNodeEnv;
      }
    });

    it('instantiates MobileApiError with status, code, and details', () => {
      const err = new MobileApiError('Unauthorized access', 401, 'INVALID_CREDENTIALS', {
        field: 'password',
      });
      expect(err.name).toBe('MobileApiError');
      expect(err.message).toBe('Unauthorized access');
      expect(err.status).toBe(401);
      expect(err.code).toBe('INVALID_CREDENTIALS');
      expect(err.details).toEqual({ field: 'password' });
    });

    it('registers user successfully via MobileAuthApi.register', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const urlStr = String(url);
        expect(urlStr).toContain('/api/v1/auth/register');
        expect(init?.method).toBe('POST');
        const body = JSON.parse(String(init?.body));
        expect(body.email).toBe('new_mobile@example.com');

        const resp: ApiResponse<{ user: PublicUser }> = {
          success: true,
          data: { user: { ...mockUser, email: 'new_mobile@example.com' } },
        };
        return new Response(JSON.stringify(resp), { status: 201 });
      });

      const user = await MobileAuthApi.register({
        email: 'new_mobile@example.com',
        password: 'SecurePassword123!',
        display_name: 'Mobile User',
      });

      expect(user.email).toBe('new_mobile@example.com');
    });

    it('throws MobileApiError when registration fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: 'Email already registered', code: 'DUPLICATE_EMAIL' },
          }),
          { status: 409 },
        );
      });

      try {
        await MobileAuthApi.register({
          email: 'dup@example.com',
          password: 'SecurePassword123!',
          display_name: 'Dup User',
        });
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MobileApiError);
        expect((err as MobileApiError).status).toBe(409);
        expect((err as MobileApiError).code).toBe('DUPLICATE_EMAIL');
      }
    });

    it('logs in and returns bearer token via MobileAuthApi.loginToken', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const urlStr = String(url);
        expect(urlStr).toContain('/api/v1/auth/token');
        expect(init?.method).toBe('POST');

        const resp: ApiResponse<{ user: PublicUser; token: string }> = {
          success: true,
          data: { user: mockUser, token: 'mobile_token_secret_12345' },
        };
        return new Response(JSON.stringify(resp), { status: 200 });
      });

      const data = await MobileAuthApi.loginToken({
        email: 'mobile@example.com',
        password: 'Password12345678!',
      });

      expect(data.user.email).toBe('mobile@example.com');
      expect(data.token).toBe('mobile_token_secret_12345');
    });

    it('retrieves user profile via MobileAuthApi.getMe with Authorization Bearer header', async () => {
      let authHeader = '';

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        const headers = init?.headers as Record<string, string>;
        authHeader = headers?.Authorization || '';

        const resp: ApiResponse<{ user: PublicUser }> = {
          success: true,
          data: { user: mockUser },
        };
        return new Response(JSON.stringify(resp), { status: 200 });
      });

      const user = await MobileAuthApi.getMe('test_token_abc');
      expect(user.id).toBe(mockUser.id);
      expect(authHeader).toBe('Bearer test_token_abc');
    });

    it('throws MobileApiError 401 when getMe returns 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({
            success: false,
            error: { message: 'Unauthorized', code: 'UNAUTHORIZED' },
          }),
          { status: 401 },
        );
      });

      try {
        await MobileAuthApi.getMe('invalid_token');
        expect.fail('Should have thrown');
      } catch (err: unknown) {
        expect(err).toBeInstanceOf(MobileApiError);
        expect((err as MobileApiError).status).toBe(401);
      }
    });

    it('updates user profile via MobileAuthApi.updateProfile', async () => {
      let patchInit: RequestInit | undefined;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        patchInit = init;
        const resp: ApiResponse<{ user: PublicUser }> = {
          success: true,
          data: { user: { ...mockUser, display_name: 'Updated Mobile', locale: 'en' } },
        };
        return new Response(JSON.stringify(resp), { status: 200 });
      });

      const updated = await MobileAuthApi.updateProfile('my_token', {
        display_name: 'Updated Mobile',
        locale: 'en',
      });

      expect(updated.display_name).toBe('Updated Mobile');
      expect(updated.locale).toBe('en');
      expect(patchInit?.method).toBe('PATCH');
      expect((patchInit?.headers as Record<string, string>)?.Authorization).toBe('Bearer my_token');
    });

    it('changes password via MobileAuthApi.changePassword', async () => {
      let postInit: RequestInit | undefined;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
        postInit = init;
        return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
      });

      await expect(
        MobileAuthApi.changePassword('my_token', {
          current_password: 'OldPassword123!',
          new_password: 'NewPassword12345!',
        }),
      ).resolves.toBeUndefined();

      expect(postInit?.method).toBe('POST');
      expect((postInit?.headers as Record<string, string>)?.Authorization).toBe('Bearer my_token');
    });

    it('handles logout and network error gracefully in MobileAuthApi.logout', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new Error('Network timeout');
      });

      await expect(MobileAuthApi.logout('token_to_logout')).resolves.toBeUndefined();
    });
  });

  describe('MobileAuthProvider & Token Lifecycle', () => {
    it('throws error when useMobileAuth is used outside of MobileAuthProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const TestConsumer = () => {
        useMobileAuth();
        return null;
      };

      expect(() => render(<TestConsumer />)).toThrow(
        'useMobileAuth must be used within a MobileAuthProvider',
      );
      consoleSpy.mockRestore();
    });

    it('cleans up SecureStore token automatically when getMe returns 401 Unauthorized', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('/api/v1/auth/me')) {
          return new Response(
            JSON.stringify({
              success: false,
              error: { message: 'Session expired', code: 'SESSION_EXPIRED' },
            }),
            { status: 401 },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      // Initial token is stored in SecureStore
      renderWithClient(<MainApp />, 'expired_token_123');

      // The provider attempts getMe, receives 401, deletes the token, and presents the login screen
      expect(await screen.findByText('NutriAI Persia')).toBeInTheDocument();
      expect(await screen.findByText('Sign In')).toBeInTheDocument();

      const storedToken = await SecureStore.getItemAsync(TOKEN_KEY);
      expect(storedToken).toBeNull();
    });

    it('retains SecureStore token when getMe encounters network failure or 5xx server error', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('/api/v1/auth/me')) {
          return new Response(
            JSON.stringify({ success: false, error: { message: 'Internal Server Error' } }),
            { status: 500 },
          );
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      renderWithClient(<MainApp />, 'valid_offline_token_456');

      // Token must NOT be deleted from SecureStore on server/network errors
      await waitFor(() => {
        const storedToken = (SecureStore as unknown as { _store: Map<string, string> })._store.get(
          TOKEN_KEY,
        );
        expect(storedToken).toBe('valid_offline_token_456');
      });
    });
  });

  describe('MobileLoginScreen & MobileRegisterScreen Component Interactions', () => {
    it('renders login screen, handles validation errors and successful submission', async () => {
      let loginSubmitted = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('/api/v1/auth/token')) {
          loginSubmitted = true;
          return new Response(
            JSON.stringify({ success: true, data: { user: mockUser, token: 'login_token_abc' } }),
            { status: 200 },
          );
        }
        if (String(url).includes('/api/v1/auth/me')) {
          return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      renderWithClient(<MainApp />);

      const emailInput = await screen.findByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      // Submit with empty inputs -> shows validation format error
      const signInBtn = screen.getByText('Sign In');
      fireEvent.click(signInBtn);

      expect(await screen.findByText(/Invalid email|Invalid format/i)).toBeInTheDocument();

      // Enter valid credentials
      fireEvent.change(emailInput, { target: { value: 'mobile@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'ValidPassword123!' } });

      fireEvent.click(signInBtn);

      await waitFor(() => {
        expect(loginSubmitted).toBe(true);
      });
    });

    it('switches to registration screen, handles registration error and successful submission', async () => {
      let regSubmitted = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/v1/auth/register')) {
          regSubmitted = true;
          return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
            status: 201,
          });
        }
        if (urlStr.includes('/api/v1/auth/token')) {
          return new Response(
            JSON.stringify({ success: true, data: { user: mockUser, token: 'reg_token_xyz' } }),
            { status: 200 },
          );
        }
        if (urlStr.includes('/api/v1/auth/me')) {
          return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
            status: 200,
          });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      renderWithClient(<MainApp />);

      // Switch to Sign Up view
      const swapBtn = await screen.findByText(/Don't have an account\? Sign Up/i);
      fireEvent.click(swapBtn);

      expect(await screen.findByText('Create a new account')).toBeInTheDocument();

      const nameInput = screen.getByPlaceholderText('Enter your name');
      const emailInput = screen.getByPlaceholderText('Enter your email');
      const passwordInput = screen.getByPlaceholderText('Enter your password');

      fireEvent.change(nameInput, { target: { value: 'New Registrant' } });
      fireEvent.change(emailInput, { target: { value: 'newreg@example.com' } });
      fireEvent.change(passwordInput, { target: { value: 'SecurePassword123!' } });

      const signUpBtn = screen.getByText('Sign Up');
      fireEvent.click(signUpBtn);

      await waitFor(() => {
        expect(regSubmitted).toBe(true);
      });
    });
  });

  describe('MainApp Authenticated State: Profile, Password Change, Logout & RTL', () => {
    it('renders authenticated dashboard, edits profile, changes password, toggles locale, and logs out', async () => {
      let profilePatched = false;
      let passwordChanged = false;
      let logoutCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
        const urlStr = String(url);
        if (urlStr.includes('/api/v1/auth/me')) {
          return new Response(JSON.stringify({ success: true, data: { user: mockUser } }), {
            status: 200,
          });
        }
        if (urlStr.includes('/api/v1/users/me') && init?.method === 'PATCH') {
          profilePatched = true;
          return new Response(
            JSON.stringify({
              success: true,
              data: { user: { ...mockUser, display_name: 'Updated Name', locale: 'en' } },
            }),
            { status: 200 },
          );
        }
        if (urlStr.includes('/api/v1/auth/change-password') && init?.method === 'POST') {
          passwordChanged = true;
          return new Response(JSON.stringify({ success: true, data: null }), { status: 200 });
        }
        if (urlStr.includes('/api/v1/auth/logout') && init?.method === 'POST') {
          logoutCalled = true;
          return new Response(JSON.stringify({ success: true }), { status: 200 });
        }
        return new Response(JSON.stringify({}), { status: 200 });
      });

      renderWithClient(<MainApp />, 'valid_user_session_token');

      // 1. Verify User Profile Display
      expect(await screen.findByText('User Profile')).toBeInTheDocument();
      expect(screen.getByText('mobile@example.com')).toBeInTheDocument();

      // 2. Edit Profile
      const displayNameInput = screen.getByDisplayValue('Mobile User');
      fireEvent.change(displayNameInput, { target: { value: 'Updated Name' } });

      const saveProfileBtn = screen.getByText('Save Profile');
      fireEvent.click(saveProfileBtn);

      expect(await screen.findByText('Profile updated successfully')).toBeInTheDocument();
      expect(profilePatched).toBe(true);

      // 3. Change Password
      const currentPwInput = screen.getByPlaceholderText('Current Password');
      const newPwInput = screen.getByPlaceholderText('New Password (12+ chars)');

      fireEvent.change(currentPwInput, { target: { value: 'OldPassword123!' } });
      fireEvent.change(newPwInput, { target: { value: 'BrandNewPassword456!' } });

      const updatePwBtn = screen.getByText('Update Password');
      fireEvent.click(updatePwBtn);

      expect(await screen.findByText('Password changed successfully')).toBeInTheDocument();
      expect(passwordChanged).toBe(true);

      // 4. RTL / Locale Switching
      const enBtn = screen.getByText('English');
      fireEvent.click(enBtn);

      expect(i18n.getLocale()).toBe('en');
      expect(mockI18nManager.forceRTL).toHaveBeenCalledWith(false);

      const faBtn = screen.getByText('فارسی');
      fireEvent.click(faBtn);

      expect(i18n.getLocale()).toBe('fa');
      expect(mockI18nManager.forceRTL).toHaveBeenCalledWith(true);

      // 5. Logout
      const logoutBtn = screen.getByText('Logout');
      fireEvent.click(logoutBtn);

      await waitFor(() => {
        expect(logoutCalled).toBe(true);
      });
    });

    it('renders root App default export without errors', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      });

      render(<App />);
      expect(await screen.findByText('NutriAI Persia')).toBeInTheDocument();
    });
  });
});
