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

  it('loads the user day context but still fails closed for an unconfigured coach provider', async () => {
    const response = await app.request(
      '/api/v1/ai/coach',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question: 'امروز چه بخورم؟',
          date: '2026-08-31',
          locale: 'fa',
          biometrics: {
            gender: 'male',
            age: 30,
            heightCm: 180,
            weightKg: 80,
            activityLevel: 'moderately_active',
            dietGoal: 'maintenance',
            formula: 'mifflin_st_jeor',
          },
        }),
      },
      testEnv,
    );
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'AI_UNAVAILABLE',
    );
  });

  it('validates food recognition images before reaching an unavailable provider', async () => {
    const response = await app.request(
      '/api/v1/ai/food-recognition',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image_base64: 'not-base64!', mime_type: 'image/jpeg' }),
      },
      testEnv,
    );
    expect(response.status).toBe(400);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_ERROR',
    );
  });

  it('fails closed with 503 for a valid image when Gemini credentials are absent', async () => {
    const response = await app.request(
      '/api/v1/ai/food-recognition',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ image_base64: 'aGVsbG8gd29ybGQ=', mime_type: 'image/jpeg' }),
      },
      testEnv,
    );
    expect(response.status).toBe(503);
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'AI_UNAVAILABLE',
    );
  });

  it('validates and fails closed for transcript-based food logging', async () => {
    const invalid = await app.request(
      '/api/v1/ai/food-log',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: '', date: '2026-08-31', locale: 'fa' }),
      },
      testEnv,
    );
    expect(invalid.status).toBe(400);

    const unavailable = await app.request(
      '/api/v1/ai/food-log',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ transcript: 'دو عدد تخم مرغ برای صبحانه', date: '2026-08-31' }),
      },
      testEnv,
    );
    expect(unavailable.status).toBe(503);
    expect(((await unavailable.json()) as { error: { code: string } }).error.code).toBe(
      'AI_UNAVAILABLE',
    );
  });
});
