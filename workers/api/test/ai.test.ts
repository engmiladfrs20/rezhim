import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type { ApiResponse } from '@nutriai/types';

const testEnv = env as ProvidedEnv;

describe('Phase 11 — AI gateway configuration boundary', () => {
  let token: string;

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
          email: 'ai-gateway-user@example.com',
          password: 'AiGatewayPassword123!',
          display_name: 'AI gateway user',
        }),
      },
      testEnv,
    );
    expect(register.status).toBe(201);
    const login = await app.request(
      '/api/v1/auth/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'ai-gateway-user@example.com',
          password: 'AiGatewayPassword123!',
        }),
      },
      testEnv,
    );
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;
  });

  it('requires authentication before reaching the provider boundary', async () => {
    const response = await app.request('/api/v1/ai/generate', { method: 'POST' }, testEnv);
    expect(response.status).toBe(401);
  });

  it('fails closed with 503 when Gemini credentials are not configured', async () => {
    const response = await app.request(
      '/api/v1/ai/generate',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt: 'یک پاسخ کوتاه بده' }),
      },
      testEnv,
    );
    expect(response.status).toBe(503);
    const json = (await response.json()) as { error: { code: string } };
    expect(json.error.code).toBe('AI_UNAVAILABLE');
  });
});
