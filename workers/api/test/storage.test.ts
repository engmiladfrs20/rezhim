import { beforeEach, describe, expect, it } from 'vitest';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type { ApiResponse, SignedUrlResult } from '@nutriai/types';
import { app } from '../src/app';
import './apply-migrations';

const testEnv = env as ProvidedEnv;

describe('Phase 16 — authenticated storage signed URL boundary', () => {
  let token = '';
  let userId = '';

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();

    const register = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'storage-user@example.com',
          password: 'StoragePassword123!',
          display_name: 'Storage user',
        }),
      },
      testEnv,
    );
    expect(register.status).toBe(201);

    const user = await db
      .prepare("SELECT id FROM users WHERE email_normalized = 'storage-user@example.com'")
      .first<{ id: string }>();
    userId = user!.id;

    const login = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'storage-user@example.com',
          password: 'StoragePassword123!',
        }),
      },
      testEnv,
    );
    expect(login.status).toBe(200);
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;
  });

  it('requires authentication before exposing signed URL endpoints', async () => {
    const response = await app.request(
      '/api/v1/storage/signed-upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'user-uploads/anonymous/avatar.png',
          contentType: 'image/png',
        }),
      },
      testEnv,
    );

    expect(response.status).toBe(401);
  });

  it('returns a development signed upload URL for the authenticated namespace', async () => {
    const key = `user-uploads/${userId}/avatar.png`;
    const response = await app.request(
      '/api/v1/storage/signed-upload-url',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ key, contentType: 'image/png', acl: 'public-read' }),
      },
      testEnv,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as ApiResponse<SignedUrlResult>;
    expect(body.success).toBe(true);
    expect(body.data.method).toBe('PUT');
    expect(body.data.url).toContain(encodeURIComponent(key));
    expect(new Date(body.data.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('rejects a key belonging to another user before reaching storage', async () => {
    const response = await app.request(
      '/api/v1/storage/signed-upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          key: 'user-uploads/another-user/avatar.png',
          contentType: 'image/png',
        }),
      },
      testEnv,
    );

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'INVALID_STORAGE_KEY',
    );
  });

  it('validates download requests before reaching the provider', async () => {
    const response = await app.request(
      '/api/v1/storage/signed-download-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          key: `user-uploads/${userId}/missing.png`,
          expiresInSeconds: 30,
        }),
      },
      testEnv,
    );

    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('fails closed in production when B2 credentials are absent', async () => {
    const productionEnv = { ...testEnv, APP_ENV: 'production' as const };
    const response = await app.request(
      '/api/v1/storage/signed-upload-url',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          key: `user-uploads/${userId}/avatar.png`,
          contentType: 'image/png',
        }),
      },
      productionEnv,
    );

    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('STORAGE_CONFIG_ERROR');
    expect(body.error.message).toBe('Storage service is not configured.');
  });
});
