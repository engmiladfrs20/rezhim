import { beforeEach, describe, expect, it } from 'vitest';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import { app } from '../src/app';
import './apply-migrations';
import type { AdminAnalyticsOverview, ApiResponse, UserSubscription } from '@nutriai/types';

const testEnv = env as ProvidedEnv;

async function tokenFor(email: string, password: string): Promise<string> {
  const login = await app.request(
    '/api/v1/auth/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    },
    testEnv,
  );
  expect(login.status).toBe(200);
  return ((await login.json()) as ApiResponse<{ token: string }>).data.token;
}

async function registerAndToken(email: string, password: string): Promise<string> {
  const registration = await app.request(
    '/api/v1/auth/register',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: email.split('@')[0] }),
    },
    testEnv,
  );
  expect(registration.status).toBe(201);
  return tokenFor(email, password);
}

describe('Phase 24/25 — subscription boundary and admin analytics', () => {
  let userToken = '';
  let adminToken = '';

  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM user_subscriptions').run();
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM users').run();
    userToken = await registerAndToken('billing-user@example.com', 'BillingPassword123!');
    await registerAndToken('billing-admin@example.com', 'BillingAdminPassword123!');
    await db
      .prepare(
        "UPDATE users SET role = 'admin' WHERE email_normalized = 'billing-admin@example.com'",
      )
      .run();
    adminToken = await tokenFor('billing-admin@example.com', 'BillingAdminPassword123!');
  });

  it('returns a safe free entitlement and fails closed for checkout', async () => {
    const status = await app.request(
      '/api/v1/subscription',
      { headers: { Authorization: `Bearer ${userToken}` } },
      testEnv,
    );
    expect(status.status).toBe(200);
    const subscription = ((await status.json()) as ApiResponse<{ subscription: UserSubscription }>)
      .data.subscription;
    expect(subscription.plan).toBe('free');
    expect(subscription.id).toBeNull();

    const checkout = await app.request(
      '/api/v1/subscription/checkout',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${userToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'pro' }),
      },
      testEnv,
    );
    expect(checkout.status).toBe(503);
    expect(((await checkout.json()) as { error: { code: string } }).error.code).toBe(
      'PAYMENT_NOT_CONFIGURED',
    );
  });

  it('protects analytics with authentication and admin RBAC', async () => {
    expect((await app.request('/api/v1/admin/analytics/overview', {}, testEnv)).status).toBe(401);
    expect(
      (
        await app.request(
          '/api/v1/admin/analytics/overview',
          { headers: { Authorization: `Bearer ${userToken}` } },
          testEnv,
        )
      ).status,
    ).toBe(403);
    const response = await app.request(
      '/api/v1/admin/analytics/overview',
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv,
    );
    expect(response.status).toBe(200);
    const data = ((await response.json()) as ApiResponse<AdminAnalyticsOverview>).data;
    expect(data.users.total).toBe(2);
    expect(data.users.active).toBe(2);
    expect(data.foods.total).toBeGreaterThanOrEqual(0);
  });

  it('rejects malformed analytics windows', async () => {
    const response = await app.request(
      '/api/v1/admin/analytics/overview?since=not-a-date',
      { headers: { Authorization: `Bearer ${adminToken}` } },
      testEnv,
    );
    expect(response.status).toBe(400);
  });
});
