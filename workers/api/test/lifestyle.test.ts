import { beforeEach, describe, expect, it } from 'vitest';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import { app } from '../src/app';
import './apply-migrations';
import type {
  ApiResponse,
  DailyLifestyleSummary,
  FastingSession,
  HabitLog,
  WaterIntake,
} from '@nutriai/types';

const testEnv = env as ProvidedEnv;

describe('Phase 22 — water, fasting, and habits', () => {
  let token = '';

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM water_intakes').run();
    await db.prepare('DELETE FROM fasting_sessions').run();
    await db.prepare('DELETE FROM habit_logs').run();
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();

    const email = `lifestyle_${crypto.randomUUID()}@nutriai.persia`;
    const register = await app.request(
      '/api/v1/auth/register',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password: 'LifestylePassword123!',
          display_name: 'Lifestyle',
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
        body: JSON.stringify({ email, password: 'LifestylePassword123!' }),
      },
      testEnv,
    );
    expect(login.status).toBe(200);
    token = ((await login.json()) as ApiResponse<{ token: string }>).data.token;
  });

  it('requires authentication for all lifestyle endpoints', async () => {
    expect((await app.request('/api/v1/lifestyle/summary', {}, testEnv)).status).toBe(401);
    expect((await app.request('/api/v1/lifestyle/water', {}, testEnv)).status).toBe(401);
    expect((await app.request('/api/v1/lifestyle/fasting', {}, testEnv)).status).toBe(401);
    expect((await app.request('/api/v1/lifestyle/habits', {}, testEnv)).status).toBe(401);
  });

  it('records water and returns a deterministic daily total', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const first = await app.request(
      '/api/v1/lifestyle/water',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount_ml: 350, consumed_at: '2026-09-01T08:00:00.000Z' }),
      },
      testEnv,
    );
    expect(first.status).toBe(201);
    const second = await app.request(
      '/api/v1/lifestyle/water',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount_ml: 500, consumed_at: '2026-09-01T12:00:00.000Z' }),
      },
      testEnv,
    );
    expect(second.status).toBe(201);
    const summary = await app.request(
      '/api/v1/lifestyle/summary?date=2026-09-01',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(summary.status).toBe(200);
    const data = ((await summary.json()) as ApiResponse<DailyLifestyleSummary>).data;
    expect(data.waterTotalMl).toBe(850);
    expect(data.waterEntries).toHaveLength(2);
    expect(
      ((await first.clone().json()) as ApiResponse<{ entry: WaterIntake }>).data.entry.amountMl,
    ).toBe(350);
  });

  it('enforces one active fast, then completes it', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const start = await app.request(
      '/api/v1/lifestyle/fasting/start',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ started_at: '2026-08-31T06:00:00.000Z', goal_hours: 16 }),
      },
      testEnv,
    );
    expect(start.status).toBe(201);
    const session = ((await start.json()) as ApiResponse<{ session: FastingSession }>).data.session;
    const duplicate = await app.request(
      '/api/v1/lifestyle/fasting/start',
      { method: 'POST', headers, body: JSON.stringify({ goal_hours: 12 }) },
      testEnv,
    );
    expect(duplicate.status).toBe(409);
    const stop = await app.request(
      `/api/v1/lifestyle/fasting/${session.id}/stop`,
      { method: 'POST', headers },
      testEnv,
    );
    expect(stop.status).toBe(200);
    expect(
      ((await stop.json()) as ApiResponse<{ session: FastingSession }>).data.session.status,
    ).toBe('completed');
    const missing = await app.request(
      `/api/v1/lifestyle/fasting/${session.id}/stop`,
      { method: 'POST', headers },
      testEnv,
    );
    expect(missing.status).toBe(404);
  });

  it('creates, updates, lists, and deletes an idempotent daily habit log', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const create = await app.request(
      '/api/v1/lifestyle/habits',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ habit_key: 'walk_30m', occurred_on: '2026-09-01', completed: true }),
      },
      testEnv,
    );
    expect(create.status).toBe(201);
    const habit = ((await create.json()) as ApiResponse<{ habit: HabitLog }>).data.habit;
    const duplicate = await app.request(
      '/api/v1/lifestyle/habits',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          habit_key: 'walk_30m',
          occurred_on: '2026-09-01',
          completed: false,
        }),
      },
      testEnv,
    );
    expect(duplicate.status).toBe(409);
    const update = await app.request(
      `/api/v1/lifestyle/habits/${habit.id}`,
      { method: 'PATCH', headers, body: JSON.stringify({ completed: false, note: 'rest day' }) },
      testEnv,
    );
    expect(update.status).toBe(200);
    expect(((await update.json()) as ApiResponse<{ habit: HabitLog }>).data.habit.completed).toBe(
      false,
    );
    const list = await app.request(
      '/api/v1/lifestyle/habits?date=2026-09-01',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(((await list.json()) as ApiResponse<{ habits: HabitLog[] }>).data.habits).toHaveLength(
      1,
    );
    const remove = await app.request(
      `/api/v1/lifestyle/habits/${habit.id}`,
      { method: 'DELETE', headers },
      testEnv,
    );
    expect(remove.status).toBe(200);
  });

  it('rejects invalid dates, amounts, and future fasting starts', async () => {
    const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
    const badDate = await app.request(
      '/api/v1/lifestyle/summary?date=01-09-2026',
      { headers: { Authorization: `Bearer ${token}` } },
      testEnv,
    );
    expect(badDate.status).toBe(400);
    const badWater = await app.request(
      '/api/v1/lifestyle/water',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount_ml: 0, consumed_at: '2026-09-01T08:00:00.000Z' }),
      },
      testEnv,
    );
    expect(badWater.status).toBe(400);
    const future = await app.request(
      '/api/v1/lifestyle/fasting/start',
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ started_at: '2099-09-01T08:00:00.000Z', goal_hours: 16 }),
      },
      testEnv,
    );
    expect(future.status).toBe(400);
  });
});
