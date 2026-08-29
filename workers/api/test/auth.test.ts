import { describe, expect, it, beforeEach } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type { ApiResponse, ApiErrorResponse, PublicUser } from '@nutriai/types';
import type { AuthSessionRecord, LoginAttemptRecord } from '../src/db/models';

const testEnv = env as ProvidedEnv;

function expectPublicUser(user: Record<string, unknown>) {
  expect(user.password_hash).toBeUndefined();
  expect(user.password_salt).toBeUndefined();
  expect(user.password_algorithm).toBeUndefined();
  expect(user.password_iterations).toBeUndefined();
  expect(user.email_normalized).toBeUndefined();
  expect(user.token_hash).toBeUndefined();
}

describe('Authentication API & Security Integration Tests', () => {
  beforeEach(async () => {
    const db = testEnv.DB!;
    await db.prepare('DELETE FROM auth_login_attempts').run();
    await db.prepare('DELETE FROM auth_sessions').run();
    await db.prepare('DELETE FROM users').run();
  });

  describe('Registration & Duplicate Handling', () => {
    it('registers user securely, stripping sensitive hashes and metadata', async () => {
      const resp = await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'secure_user@example.com',
            password: 'SuperSecurePassword123!',
            display_name: 'Secure User',
          }),
        },
        testEnv,
      );

      expect(resp.status).toBe(201);
      const data = (await resp.json()) as ApiResponse<{ user: PublicUser }>;
      expect(data.success).toBe(true);
      expect(data.data.user.email).toBe('secure_user@example.com');
      expect(data.data.user.role).toBe('user');
      expect(data.data.user.status).toBe('active');
      expectPublicUser(data.data.user as unknown as Record<string, unknown>);
    }, 30000);

    it('rejects concurrent duplicate registrations atomically', async () => {
      const regPayload = JSON.stringify({
        email: 'concurrent_dup@example.com',
        password: 'Password12345678!',
        display_name: 'Concurrent User',
      });

      const promises = [
        app.request(
          '/api/v1/auth/register',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: regPayload,
          },
          testEnv,
        ),
        app.request(
          '/api/v1/auth/register',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: regPayload,
          },
          testEnv,
        ),
      ];

      const [res1, res2] = await Promise.all(promises);
      const statuses = [res1?.status, res2?.status].sort();
      expect(statuses).toEqual([201, 409]);
    }, 30000);
  });

  describe('Login, Cookies, Bearer Tokens & D1 Token Hashing', () => {
    it('issues HttpOnly cookie in dev and production formats', async () => {
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'cookie_test@example.com',
            password: 'CookiePassword123!',
            display_name: 'Cookie User',
          }),
        },
        testEnv,
      );

      // Dev environment login
      const devResp = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.1' },
          body: JSON.stringify({
            email: 'cookie_test@example.com',
            password: 'CookiePassword123!',
          }),
        },
        { ...testEnv, APP_ENV: 'development' },
      );

      expect(devResp.status).toBe(200);
      const devCookie = devResp.headers.get('Set-Cookie') || '';
      expect(devCookie).toContain('nutriai_session=');
      expect(devCookie).toContain('HttpOnly');
      expect(devCookie).toContain('SameSite=Lax');

      // Production environment login
      const prodResp = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.2' },
          body: JSON.stringify({
            email: 'cookie_test@example.com',
            password: 'CookiePassword123!',
          }),
        },
        { ...testEnv, APP_ENV: 'production', RATE_LIMIT_HMAC_SECRET: 'prod-secret-123456789' },
      );

      expect(prodResp.status).toBe(200);
      const prodCookie = prodResp.headers.get('Set-Cookie') || '';
      expect(prodCookie).toContain('__Host-nutriai_session=');
      expect(prodCookie).toContain('Secure');
      expect(prodCookie).toContain('HttpOnly');
      expect(prodCookie).toContain('SameSite=Lax');
    }, 30000);

    it('verifies raw token is never stored in D1 database', async () => {
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'token_check@example.com',
            password: 'TokenPassword123!',
            display_name: 'Token User',
          }),
        },
        testEnv,
      );

      const tokenResp = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.0.0.3' },
          body: JSON.stringify({ email: 'token_check@example.com', password: 'TokenPassword123!' }),
        },
        testEnv,
      );

      expect(tokenResp.status).toBe(200);
      const tokenPayload = (await tokenResp.json()) as ApiResponse<{
        user: PublicUser;
        token: string;
      }>;
      const rawToken = tokenPayload.data.token;
      expect(rawToken).toBeTruthy();

      // Check D1 database directly
      const sessionInDb = await testEnv
        .DB!.prepare('SELECT * FROM auth_sessions')
        .first<AuthSessionRecord>();

      expect(sessionInDb).toBeTruthy();
      expect(sessionInDb?.token_hash).not.toBe(rawToken);
      expect(sessionInDb?.token_hash).toBeTruthy();
    }, 30000);
  });

  describe('CORS, Preflight & CSRF Security', () => {
    it('returns Access-Control-Allow-Credentials and handles PATCH preflight', async () => {
      // OPTIONS Preflight
      const preflight = await app.request(
        '/api/v1/users/me',
        {
          method: 'OPTIONS',
          headers: {
            Origin: 'http://localhost:3000',
            'Access-Control-Request-Method': 'PATCH',
            'Access-Control-Request-Headers': 'Content-Type, Authorization',
          },
        },
        { ...testEnv, ALLOWED_ORIGINS: 'http://localhost:3000' },
      );

      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
      expect(preflight.headers.get('Access-Control-Allow-Credentials')).toBe('true');
      expect(preflight.headers.get('Access-Control-Allow-Methods')).toContain('PATCH');
    });

    it('rejects missing, restricted, and malformed origins on cookie mutations', async () => {
      // Register and get cookie session token
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'csrf_test@example.com',
            password: 'CsrfPassword123!',
            display_name: 'CSRF User',
          }),
        },
        testEnv,
      );

      const loginRes = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'csrf_test@example.com', password: 'CsrfPassword123!' }),
        },
        testEnv,
      );
      const token = ((await loginRes.json()) as ApiResponse<{ token: string }>).data.token;

      // 1. Missing Origin/Referer on cookie mutating request
      const noOriginRes = await app.request(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `nutriai_session=${token}`,
          },
          body: JSON.stringify({ display_name: 'Hacked Name' }),
        },
        { ...testEnv, ALLOWED_ORIGINS: 'https://app.nutriai.persia' },
      );
      expect(noOriginRes.status).toBe(403);

      // 2. Restricted / Unallowed Origin
      const evilOriginRes = await app.request(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `nutriai_session=${token}`,
            Origin: 'https://evil-attacker.com',
          },
          body: JSON.stringify({ display_name: 'Hacked Name' }),
        },
        { ...testEnv, ALLOWED_ORIGINS: 'https://app.nutriai.persia' },
      );
      expect(evilOriginRes.status).toBe(403);

      // 3. Malformed Origin
      const malformedOriginRes = await app.request(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `nutriai_session=${token}`,
            Origin: 'not-a-valid-url',
          },
          body: JSON.stringify({ display_name: 'Hacked Name' }),
        },
        { ...testEnv, ALLOWED_ORIGINS: 'https://app.nutriai.persia' },
      );
      expect(malformedOriginRes.status).toBe(403);
    }, 30000);
  });

  describe('Rate Limiting & Timing Attack Mitigations', () => {
    it('returns identical 401 INVALID_CREDENTIALS for wrong password, unknown user, and disabled user', async () => {
      // Register user
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'valid_user@example.com',
            password: 'ValidPassword123!',
            display_name: 'Valid User',
          }),
        },
        testEnv,
      );

      // Register second user and disable
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'disabled_user@example.com',
            password: 'DisabledPassword123!',
            display_name: 'Disabled User',
          }),
        },
        testEnv,
      );
      await testEnv
        .DB!.prepare(
          "UPDATE users SET status = 'disabled' WHERE email_normalized = 'disabled_user@example.com'",
        )
        .run();

      // 1. Wrong Password
      const wrongPw = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.1.1.1' },
          body: JSON.stringify({ email: 'valid_user@example.com', password: 'WrongPassword999!' }),
        },
        testEnv,
      );
      expect(wrongPw.status).toBe(401);
      const wrongPwData = (await wrongPw.json()) as ApiErrorResponse;
      expect(wrongPwData.error.code).toBe('INVALID_CREDENTIALS');

      // 2. Unknown User
      const unknownUser = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.1.1.2' },
          body: JSON.stringify({ email: 'nonexistent@example.com', password: 'WrongPassword999!' }),
        },
        testEnv,
      );
      expect(unknownUser.status).toBe(401);
      const unknownUserData = (await unknownUser.json()) as ApiErrorResponse;
      expect(unknownUserData.error.code).toBe('INVALID_CREDENTIALS');

      // 3. Disabled User
      const disabledUser = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '10.1.1.3' },
          body: JSON.stringify({
            email: 'disabled_user@example.com',
            password: 'DisabledPassword123!',
          }),
        },
        testEnv,
      );
      expect(disabledUser.status).toBe(401);
      const disabledUserData = (await disabledUser.json()) as ApiErrorResponse;
      expect(disabledUserData.error.code).toBe('INVALID_CREDENTIALS');
    }, 30000);

    it('stores HMAC hashed identifiers and enforces rate limit atomically under concurrency', async () => {
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'rate_target@example.com',
            password: 'TargetPassword123!',
            display_name: 'Rate Target',
          }),
        },
        testEnv,
      );

      const requests = [];
      for (let i = 0; i < 7; i++) {
        requests.push(
          app.request(
            '/api/v1/auth/login',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '172.16.0.5' },
              body: JSON.stringify({
                email: 'rate_target@example.com',
                password: 'WrongPassword123!',
              }),
            },
            testEnv,
          ),
        );
      }

      const results = await Promise.all(requests);
      const rateLimitedCount = results.filter((r) => r.status === 429).length;
      expect(rateLimitedCount).toBeGreaterThanOrEqual(1);

      // Check D1 auth_login_attempts table directly
      const attempts = await testEnv
        .DB!.prepare('SELECT * FROM auth_login_attempts')
        .all<LoginAttemptRecord>();

      expect(attempts.results?.length).toBeGreaterThanOrEqual(1);
      const record = attempts.results?.[0];
      expect(record?.email_hash).not.toContain('rate_target@example.com');
      expect(record?.ip_hash).not.toContain('172.16.0.5');
      expect(record?.attempts).toBeGreaterThanOrEqual(5);
    }, 30000);

    it('requires RATE_LIMIT_HMAC_SECRET in production returning 503 if missing', async () => {
      const prodMissingSecretEnv = {
        ...testEnv,
        APP_ENV: 'production',
        RATE_LIMIT_HMAC_SECRET: undefined,
      };

      const res = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'Password123!' }),
        },
        prodMissingSecretEnv,
      );

      expect(res.status).toBe(503);
      const err = (await res.json()) as ApiErrorResponse;
      expect(err.error.code).toBe('NOT_READY');
    });
  });

  describe('Session Lifecycle, Expiry, Logout & Logout-All', () => {
    it('manages token session lifecycle, profile update, logout, and logout-all', async () => {
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'lifecycle@example.com',
            password: 'LifecyclePass123!',
            display_name: 'Initial Name',
          }),
        },
        testEnv,
      );

      const tokRes = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'lifecycle@example.com', password: 'LifecyclePass123!' }),
        },
        testEnv,
      );
      const token = ((await tokRes.json()) as ApiResponse<{ token: string }>).data.token;

      // Profile edit
      const patchRes = await app.request(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ display_name: 'Updated Name', locale: 'en' }),
        },
        testEnv,
      );
      expect(patchRes.status).toBe(200);

      // Verify me
      const meRes = await app.request(
        '/api/v1/auth/me',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        testEnv,
      );
      expect(meRes.status).toBe(200);
      const meData = (await meRes.json()) as ApiResponse<{ user: PublicUser }>;
      expect(meData.data.user.display_name).toBe('Updated Name');
      expect(meData.data.user.locale).toBe('en');
      expectPublicUser(meData.data.user as unknown as Record<string, unknown>);

      // Password change
      const pwChangeRes = await app.request(
        '/api/v1/auth/change-password',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            current_password: 'LifecyclePass123!',
            new_password: 'NewLifecyclePass456!',
          }),
        },
        testEnv,
      );
      expect(pwChangeRes.status).toBe(200);

      // Logout All
      const logoutAllRes = await app.request(
        '/api/v1/auth/logout-all',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        },
        testEnv,
      );
      expect(logoutAllRes.status).toBe(200);

      // After logout all, session is revoked -> 401
      const expiredRes = await app.request(
        '/api/v1/auth/me',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        testEnv,
      );
      expect(expiredRes.status).toBe(401);
      const expiredData = (await expiredRes.json()) as ApiErrorResponse;
      expect(expiredData.error.code).toBe('SESSION_EXPIRED');
    }, 30000);
  });

  describe('RBAC & Admin Management Protection', () => {
    it('enforces RBAC, lists users with pagination, views user detail, and prevents admin self-disable', async () => {
      // Create user
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'regular_user@example.com',
            password: 'RegularPassword123!',
            display_name: 'Regular',
          }),
        },
        testEnv,
      );
      const uRes = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'regular_user@example.com',
            password: 'RegularPassword123!',
          }),
        },
        testEnv,
      );
      const uToken = ((await uRes.json()) as ApiResponse<{ token: string }>).data.token;

      // Create admin
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'super_admin@example.com',
            password: 'AdminPassword123!',
            display_name: 'Admin',
          }),
        },
        testEnv,
      );
      await testEnv
        .DB!.prepare(
          "UPDATE users SET role = 'admin' WHERE email_normalized = 'super_admin@example.com'",
        )
        .run();

      const aRes = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'super_admin@example.com', password: 'AdminPassword123!' }),
        },
        testEnv,
      );
      const aData = (await aRes.json()) as ApiResponse<{ user: PublicUser; token: string }>;
      const aToken = aData.data.token;
      const adminId = aData.data.user.id;

      // User tries admin endpoint -> 403
      const userForbidden = await app.request(
        '/api/v1/admin/users',
        {
          headers: { Authorization: `Bearer ${uToken}` },
        },
        testEnv,
      );
      expect(userForbidden.status).toBe(403);

      // Admin lists users
      const listRes = await app.request(
        '/api/v1/admin/users?limit=10',
        {
          headers: { Authorization: `Bearer ${aToken}` },
        },
        testEnv,
      );
      expect(listRes.status).toBe(200);
      const listData = (await listRes.json()) as ApiResponse<{
        users: PublicUser[];
        nextCursor: string | null;
      }>;
      expect(listData.data.users.length).toBe(2);
      expectPublicUser(listData.data.users[0] as unknown as Record<string, unknown>);

      const regUser = listData.data.users.find((u) => u.email === 'regular_user@example.com')!;
      expect(regUser).toBeDefined();

      // Admin gets user detail
      const detailRes = await app.request(
        `/api/v1/admin/users/${regUser.id}`,
        {
          headers: { Authorization: `Bearer ${aToken}` },
        },
        testEnv,
      );
      expect(detailRes.status).toBe(200);
      const detailData = (await detailRes.json()) as ApiResponse<{ user: PublicUser }>;
      expect(detailData.data.user.id).toBe(regUser.id);
      expect(detailData.data.user.email).toBe('regular_user@example.com');
      expectPublicUser(detailData.data.user as unknown as Record<string, unknown>);

      // Admin toggles user status to disabled
      const disableRes = await app.request(
        `/api/v1/admin/users/${regUser.id}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aToken}` },
          body: JSON.stringify({ status: 'disabled' }),
        },
        testEnv,
      );
      expect(disableRes.status).toBe(200);

      // Admin tries to disable self -> 403 FORBIDDEN
      const selfDisableRes = await app.request(
        `/api/v1/admin/users/${adminId}/status`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aToken}` },
          body: JSON.stringify({ status: 'disabled' }),
        },
        testEnv,
      );
      expect(selfDisableRes.status).toBe(403);
      const selfErr = (await selfDisableRes.json()) as ApiErrorResponse;
      expect(selfErr.error.code).toBe('FORBIDDEN');
    }, 30000);
  });
});
