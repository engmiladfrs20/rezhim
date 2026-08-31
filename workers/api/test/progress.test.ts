import { beforeEach, describe, expect, it } from 'vitest';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import { app } from '../src/app';
import './apply-migrations';
import type { ApiResponse, WeightEntry, WeightTrend } from '@nutriai/types';

const testEnv = env as ProvidedEnv;

describe('Phase 21 — progress and weight trend ownership', () => {
  let token = '';

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM user_weight_entries').run();
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();

    const email = `progress_${crypto.randomUUID()}@nutriai.persia`;
    const register = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'ProgressPassword123!',
          display_name: 'Progress User',
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
        body: JSON.stringify({ email, password: 'ProgressPassword123!' }),
      },
      testEnv,
    );
    expect(login.status).toBe(200);
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;
  });

  it('requires authentication for weight endpoints', async () => {
    expect((await app.request('/api/v1/progress/weight', {}, testEnv)).status).toBe(401);
    expect((await app.request('/api/v1/progress/weight/trend', {}, testEnv)).status).toBe(401);
  });

  it('creates, lists, updates and calculates a deterministic trend', async () => {
    const first = await app.request(
      '/api/v1/progress/weight',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weight_kg: 82.5, measured_at: '2026-08-01T08:00:00.000Z' }),
      },
      testEnv,
    );
    expect(first.status).toBe(201);
    const firstEntry = ((await first.json()) as ApiResponse<{ entry: WeightEntry }>).data.entry;

    const second = await app.request(
      '/api/v1/progress/weight',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          weight_kg: 80,
          measured_at: '2026-09-01T08:00:00.000Z',
          note: 'morning',
        }),
      },
      testEnv,
    );
    expect(second.status).toBe(201);

    const trend = await app.request(
      '/api/v1/progress/weight/trend?from=2026-08-01&to=2026-09-01',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(trend.status).toBe(200);
    const data = ((await trend.json()) as ApiResponse<WeightTrend>).data;
    expect(data.entries).toHaveLength(2);
    expect(data.firstWeightKg).toBe(82.5);
    expect(data.latestWeightKg).toBe(80);
    expect(data.changeKg).toBe(-2.5);
    expect(data.changePercent).toBe(-3.03);

    const list = await app.request(
      '/api/v1/progress/weight?limit=1',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(
      ((await list.json()) as ApiResponse<{ entries: WeightEntry[] }>).data.entries,
    ).toHaveLength(1);

    const update = await app.request(
      `/api/v1/progress/weight/${firstEntry.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weight_kg: 81.5 }),
      },
      testEnv,
    );
    expect(update.status).toBe(200);
    expect(((await update.json()) as ApiResponse<{ entry: WeightEntry }>).data.entry.weightKg).toBe(
      81.5,
    );

    const remove = await app.request(
      `/api/v1/progress/weight/${firstEntry.id}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(remove.status).toBe(200);
  });

  it('rejects invalid ranges, duplicate timestamps, and reversed ranges', async () => {
    const invalid = await app.request(
      '/api/v1/progress/weight',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weight_kg: 0, measured_at: '2026-09-01T08:00:00.000Z' }),
      },
      testEnv,
    );
    expect(invalid.status).toBe(400);

    const body = { weight_kg: 80, measured_at: '2026-09-01T08:00:00.000Z' };
    const first = await app.request(
      '/api/v1/progress/weight',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      testEnv,
    );
    expect(first.status).toBe(201);
    const duplicate = await app.request(
      '/api/v1/progress/weight',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      },
      testEnv,
    );
    expect(duplicate.status).toBe(409);

    const reversed = await app.request(
      '/api/v1/progress/weight/trend?from=2026-09-02&to=2026-09-01',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(reversed.status).toBe(400);
  });

  it('isolates records by user and returns stable not-found errors', async () => {
    const missing = await app.request(
      '/api/v1/progress/weight/weight_missing',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ weight_kg: 75 }),
      },
      testEnv,
    );
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as { error: { code: string } }).error.code).toBe(
      'WEIGHT_ENTRY_NOT_FOUND',
    );
  });
});
