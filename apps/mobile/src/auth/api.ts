import type { PublicUser, ApiResponse } from '@nutriai/types';
import type { LoginDto, RegisterDto } from '@nutriai/schemas';

const API_URL = 'http://localhost:8787';

export class MobileAuthApi {
  static getBaseUrl(): string {
    return API_URL;
  }

  static async register(data: RegisterDto): Promise<PublicUser> {
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || 'Registration failed');
    }

    const payload = (await res.json()) as ApiResponse<{ user: PublicUser }>;
    return payload.data.user;
  }

  static async loginToken(data: LoginDto): Promise<{ user: PublicUser; token: string }> {
    const res = await fetch(`${API_URL}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || 'Invalid email or password');
    }

    const payload = (await res.json()) as ApiResponse<{ user: PublicUser; token: string }>;
    return payload.data;
  }

  static async getMe(token: string): Promise<PublicUser> {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error('Unauthorized');
    }

    const payload = (await res.json()) as ApiResponse<{ user: PublicUser }>;
    return payload.data.user;
  }

  static async updateProfile(
    token: string,
    data: { display_name?: string; locale?: 'fa' | 'en' },
  ): Promise<PublicUser> {
    const res = await fetch(`${API_URL}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || 'Failed to update profile');
    }

    const payload = (await res.json()) as ApiResponse<{ user: PublicUser }>;
    return payload.data.user;
  }

  static async changePassword(
    token: string,
    data: { current_password: string; new_password: string },
  ): Promise<void> {
    const res = await fetch(`${API_URL}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!res.ok) {
      const err = (await res.json()) as { error?: { message?: string } };
      throw new Error(err.error?.message || 'Failed to change password');
    }
  }

  static async logout(token: string): Promise<void> {
    try {
      await fetch(`${API_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Ignore network failures on logout
    }
  }
}
