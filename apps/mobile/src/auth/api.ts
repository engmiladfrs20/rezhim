import type { PublicUser, ApiResponse } from '@nutriai/types';
import type { LoginDto, RegisterDto } from '@nutriai/schemas';

export class MobileApiError extends Error {
  readonly status: number;
  readonly code?: string | undefined;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string | undefined, details?: unknown) {
    super(message);
    this.name = 'MobileApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class MobileAuthApi {
  static getBaseUrl(): string {
    const envUrl = process.env.EXPO_PUBLIC_API_URL;
    if (envUrl && envUrl.trim().length > 0) {
      return envUrl.trim().replace(/\/+$/, '');
    }

    const isDevOrTest =
      process.env.NODE_ENV !== 'production' ||
      typeof process.env.VITEST !== 'undefined' ||
      process.env.APP_ENV === 'development' ||
      process.env.APP_ENV === 'test';

    if (isDevOrTest) {
      return 'http://localhost:8787';
    }

    throw new Error('EXPO_PUBLIC_API_URL is required in production environment.');
  }

  private static async handleResponse<T>(res: Response): Promise<T> {
    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      let code: string | undefined;
      let details: unknown;

      try {
        const body = (await res.json()) as {
          error?: { message?: string; code?: string; details?: unknown };
        };
        if (body?.error?.message) {
          message = body.error.message;
        }
        if (body?.error?.code) {
          code = body.error.code;
        }
        if (body?.error?.details) {
          details = body.error.details;
        }
      } catch {
        // Fall back to default status message if JSON parsing fails
      }

      throw new MobileApiError(message, res.status, code, details);
    }

    return (await res.json()) as T;
  }

  static async register(data: RegisterDto): Promise<PublicUser> {
    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const payload = await this.handleResponse<ApiResponse<{ user: PublicUser }>>(res);
    return payload.data.user;
  }

  static async loginToken(data: LoginDto): Promise<{ user: PublicUser; token: string }> {
    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });

    const payload =
      await this.handleResponse<ApiResponse<{ user: PublicUser; token: string }>>(res);
    return payload.data;
  }

  static async getMe(token: string): Promise<PublicUser> {
    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const payload = await this.handleResponse<ApiResponse<{ user: PublicUser }>>(res);
    return payload.data.user;
  }

  static async updateProfile(
    token: string,
    data: { display_name?: string | undefined; locale?: 'fa' | 'en' | undefined },
  ): Promise<PublicUser> {
    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    const payload = await this.handleResponse<ApiResponse<{ user: PublicUser }>>(res);
    return payload.data.user;
  }

  static async changePassword(
    token: string,
    data: { current_password: string; new_password: string },
  ): Promise<void> {
    const baseUrl = this.getBaseUrl();
    const res = await fetch(`${baseUrl}/api/v1/auth/change-password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    await this.handleResponse<ApiResponse<null>>(res);
  }

  static async logout(token: string): Promise<void> {
    const baseUrl = this.getBaseUrl();
    try {
      await fetch(`${baseUrl}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Best-effort logout network dispatch
    }
  }
}
