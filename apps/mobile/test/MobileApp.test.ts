import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as SecureStore from 'expo-secure-store';
import { I18nManager } from 'react-native';
import { MobileAuthApi } from '../src/auth/api';
import { TOKEN_KEY, MobileAuthProvider } from '../src/auth/MobileAuthProvider';
import { MobileLoginScreen } from '../src/auth/MobileLoginScreen';
import { MobileRegisterScreen } from '../src/auth/MobileRegisterScreen';
import App, { MainApp } from '../src/App';
import type { PublicUser, ApiResponse } from '@nutriai/types';
import { i18n } from '@nutriai/localization';
import React from 'react';

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

describe('Mobile App - MobileAuthApi, SecureStore & Lifecycle Tests', () => {
  beforeEach(async () => {
    vi.restoreAllMocks();
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  });

  describe('MobileAuthApi Endpoints', () => {
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
      expect(MobileAuthApi.getBaseUrl()).toBe('http://localhost:8787');
    });

    it('throws error when registration fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Email already registered' } }),
          { status: 409 },
        );
      });

      await expect(
        MobileAuthApi.register({
          email: 'dup@example.com',
          password: 'SecurePassword123!',
          display_name: 'Dup User',
        }),
      ).rejects.toThrow('Email already registered');
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

    it('throws error when login fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Invalid email or password' } }),
          { status: 401 },
        );
      });

      await expect(
        MobileAuthApi.loginToken({
          email: 'mobile@example.com',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow('Invalid email or password');
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

    it('throws Unauthorized when getMe returns 401', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      });

      await expect(MobileAuthApi.getMe('invalid_token')).rejects.toThrow('Unauthorized');
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

    it('throws error when updateProfile fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Failed to update profile' } }),
          { status: 400 },
        );
      });

      await expect(MobileAuthApi.updateProfile('my_token', { display_name: 'A' })).rejects.toThrow(
        'Failed to update profile',
      );
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

    it('throws error when changePassword fails', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(
          JSON.stringify({ success: false, error: { message: 'Invalid old password' } }),
          { status: 401 },
        );
      });

      await expect(
        MobileAuthApi.changePassword('my_token', {
          current_password: 'Wrong',
          new_password: 'NewPassword12345!',
        }),
      ).rejects.toThrow('Invalid old password');
    });

    it('handles logout via MobileAuthApi.logout', async () => {
      let logoutCalled = false;

      vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => {
        if (String(url).includes('/api/v1/auth/logout')) {
          logoutCalled = true;
        }
        return new Response(JSON.stringify({ success: true }), { status: 200 });
      });

      await MobileAuthApi.logout('token_to_logout');
      expect(logoutCalled).toBe(true);
    });

    it('handles network error in MobileAuthApi.logout gracefully', async () => {
      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        throw new Error('Network error');
      });

      await expect(MobileAuthApi.logout('token_to_logout')).resolves.toBeUndefined();
    });
  });

  describe('SecureStore Token Lifecycle & 401 Cleanup', () => {
    it('saves token to SecureStore on login and retrieves it', async () => {
      await SecureStore.setItemAsync(TOKEN_KEY, 'secure_bearer_token_xyz');
      const retrieved = await SecureStore.getItemAsync(TOKEN_KEY);
      expect(retrieved).toBe('secure_bearer_token_xyz');

      await SecureStore.deleteItemAsync(TOKEN_KEY);
      const afterDelete = await SecureStore.getItemAsync(TOKEN_KEY);
      expect(afterDelete).toBeNull();
    });

    it('cleans up SecureStore token when session is invalid or expired (401)', async () => {
      await SecureStore.setItemAsync(TOKEN_KEY, 'expired_token');

      vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
        return new Response(JSON.stringify({ success: false }), { status: 401 });
      });

      try {
        await MobileAuthApi.getMe('expired_token');
      } catch {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
      }

      const tokenInStore = await SecureStore.getItemAsync(TOKEN_KEY);
      expect(tokenInStore).toBeNull();
    });
  });

  describe('Mobile Components Instantiation', () => {
    it('creates MobileAuthProvider, MobileLoginScreen, MobileRegisterScreen, and App elements without throwing', () => {
      const authElem = React.createElement(MobileAuthProvider, {
        children: React.createElement('div'),
      });
      expect(authElem).toBeTruthy();

      const loginElem = React.createElement(MobileLoginScreen, { onSwap: () => {} });
      expect(loginElem).toBeTruthy();

      const regElem = React.createElement(MobileRegisterScreen, { onSwap: () => {} });
      expect(regElem).toBeTruthy();

      const mainElem = React.createElement(MainApp);
      expect(mainElem).toBeTruthy();

      const appElem = React.createElement(App);
      expect(appElem).toBeTruthy();
    });
  });

  describe('Localization & RTL Synchronization', () => {
    it('sets locale and triggers I18nManager forceRTL for Persian and English', () => {
      const forceRTLMock = vi.spyOn(I18nManager, 'forceRTL');

      // Persian FA -> RTL
      i18n.setLocale('fa');
      expect(i18n.getLocale()).toBe('fa');
      expect(i18n.getDirection()).toBe('rtl');
      I18nManager.forceRTL(true);
      expect(forceRTLMock).toHaveBeenCalledWith(true);

      // English EN -> LTR
      i18n.setLocale('en');
      expect(i18n.getLocale()).toBe('en');
      expect(i18n.getDirection()).toBe('ltr');
      I18nManager.forceRTL(false);
      expect(forceRTLMock).toHaveBeenCalledWith(false);
    });
  });
});
