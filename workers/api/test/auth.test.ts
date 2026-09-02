import { describe, expect, it, beforeEach } from 'vitest';
import { app } from '../src/app';
import './apply-migrations';
import { env, type ProvidedEnv } from 'cloudflare:workers';
import type { ApiResponse, ApiErrorResponse, PublicUser } from '@nutriai/types';
import type { AuthSessionRecord, LoginAttemptRecord } from '../src/db/models';
import { AuthService } from '../src/services/auth.service';
import { SessionService } from '../src/services/session.service';

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

  describe('Login, Cookies, Bearer Tokens & Sensitive Field Stripping', () => {
    it('issues HttpOnly cookie in dev and production formats and strips sensitive fields', async () => {
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

      const devData = (await devResp.json()) as ApiResponse<{ user: PublicUser }>;
      expectPublicUser(devData.data.user as unknown as Record<string, unknown>);

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
      expect(prodCookie).toContain('SameSite=None');

      const prodData = (await prodResp.json()) as ApiResponse<{ user: PublicUser }>;
      expectPublicUser(prodData.data.user as unknown as Record<string, unknown>);
    }, 30000);

    it('verifies raw token is never stored in D1 database and strips sensitive fields on /token', async () => {
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
      expectPublicUser(tokenPayload.data.user as unknown as Record<string, unknown>);

      // Check D1 database directly
      const sessionInDb = await testEnv
        .DB!.prepare('SELECT * FROM auth_sessions')
        .first<AuthSessionRecord>();

      expect(sessionInDb).toBeTruthy();
      expect(sessionInDb?.token_hash).not.toBe(rawToken);
      expect(sessionInDb?.token_hash).toBeTruthy();
    }, 30000);

    it('returns authenticated user profile on /me and strips all sensitive fields', async () => {
      await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'me_sensitive_check@example.com',
            password: 'MeSensitivePass123!',
            display_name: 'Me Sensitive User',
          }),
        },
        testEnv,
      );

      const tokenResp = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'me_sensitive_check@example.com',
            password: 'MeSensitivePass123!',
          }),
        },
        testEnv,
      );
      const token = ((await tokenResp.json()) as ApiResponse<{ token: string }>).data.token;

      // 1. Check /me with Bearer token
      const bearerMe = await app.request(
        '/api/v1/auth/me',
        {
          headers: { Authorization: `Bearer ${token}` },
        },
        testEnv,
      );
      expect(bearerMe.status).toBe(200);
      const bearerData = (await bearerMe.json()) as ApiResponse<{ user: PublicUser }>;
      expect(bearerData.success).toBe(true);
      expect(bearerData.data.user.email).toBe('me_sensitive_check@example.com');
      expect(bearerData.data.user.display_name).toBe('Me Sensitive User');
      expectPublicUser(bearerData.data.user as unknown as Record<string, unknown>);

      // 2. Check /me with Cookie
      const cookieMe = await app.request(
        '/api/v1/auth/me',
        {
          headers: { Cookie: `nutriai_session=${token}` },
        },
        testEnv,
      );
      expect(cookieMe.status).toBe(200);
      const cookieData = (await cookieMe.json()) as ApiResponse<{ user: PublicUser }>;
      expect(cookieData.success).toBe(true);
      expect(cookieData.data.user.email).toBe('me_sensitive_check@example.com');
      expectPublicUser(cookieData.data.user as unknown as Record<string, unknown>);
    }, 30000);
  });

  describe('CORS, Preflight & CSRF Security with Referer & Origin', () => {
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

    it('validates allowed Origin and Referer and rejects missing, restricted, and malformed origins', async () => {
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

      // 1. Allowed Origin succeeds
      const validOriginRes = await app.request(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `nutriai_session=${token}`,
            Origin: 'https://app.nutriai.persia',
          },
          body: JSON.stringify({ display_name: 'Legit Name' }),
        },
        { ...testEnv, ALLOWED_ORIGINS: 'https://app.nutriai.persia' },
      );
      expect(validOriginRes.status).toBe(200);

      // 2. Allowed Referer without Origin succeeds
      const validRefererRes = await app.request(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `nutriai_session=${token}`,
            Referer: 'https://app.nutriai.persia/profile/edit',
          },
          body: JSON.stringify({ display_name: 'Legit Name Referer' }),
        },
        { ...testEnv, ALLOWED_ORIGINS: 'https://app.nutriai.persia' },
      );
      expect(validRefererRes.status).toBe(200);

      // 3. Missing Origin & Referer on cookie mutating request -> 403
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

      // 4. Restricted / Unallowed Origin -> 403
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

      // 5. Malformed Origin -> 403
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

      // 6. Malformed Referer -> 403
      const malformedRefererRes = await app.request(
        '/api/v1/users/me',
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Cookie: `nutriai_session=${token}`,
            Referer: '///invalid-referer-format',
          },
          body: JSON.stringify({ display_name: 'Hacked Name' }),
        },
        { ...testEnv, ALLOWED_ORIGINS: 'https://app.nutriai.persia' },
      );
      expect(malformedRefererRes.status).toBe(403);
    }, 30000);
  });

  describe('Rate Limiting, Stale Attempt Cleanup & HMAC Secret Environments', () => {
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

    it('cleans up stale auth_login_attempts older than window duration', async () => {
      const db = testEnv.DB!;
      const staleTime = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 mins ago

      await db
        .prepare(
          `INSERT INTO auth_login_attempts (email_hash, ip_hash, window_start, attempts)
           VALUES (?, ?, ?, ?)`,
        )
        .bind('old_email_hash', 'old_ip_hash', staleTime, 3)
        .run();

      const beforeCleanup = await db
        .prepare('SELECT * FROM auth_login_attempts WHERE email_hash = ? AND ip_hash = ?')
        .bind('old_email_hash', 'old_ip_hash')
        .first<LoginAttemptRecord>();
      expect(beforeCleanup).toBeTruthy();

      // Trigger cleanup
      const authService = new AuthService(db);
      await authService.cleanStaleAttempts();

      const afterCleanup = await db
        .prepare('SELECT * FROM auth_login_attempts WHERE email_hash = ? AND ip_hash = ?')
        .bind('old_email_hash', 'old_ip_hash')
        .first<LoginAttemptRecord>();
      expect(afterCleanup).toBeNull();
    });

    it('permits development/test HMAC fallback and fails with 503 in production/staging when secret is missing', async () => {
      // 1. Dev/Test permits fallback
      const devRes = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'devfallback@example.com', password: 'Password123!' }),
        },
        { ...testEnv, APP_ENV: 'development', RATE_LIMIT_HMAC_SECRET: undefined },
      );
      expect(devRes.status).toBe(401);

      // 2. Staging fails closed with 503
      const stagingRes = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'staging@example.com', password: 'Password123!' }),
        },
        { ...testEnv, APP_ENV: 'staging', RATE_LIMIT_HMAC_SECRET: undefined },
      );
      expect(stagingRes.status).toBe(503);
      const stagingErr = (await stagingRes.json()) as ApiErrorResponse;
      expect(stagingErr.error.code).toBe('NOT_READY');

      // 3. Production fails closed with 503
      const prodRes = await app.request(
        '/api/v1/auth/login',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'prod@example.com', password: 'Password123!' }),
        },
        { ...testEnv, APP_ENV: 'production', RATE_LIMIT_HMAC_SECRET: undefined },
      );
      expect(prodRes.status).toBe(503);
      const prodErr = (await prodRes.json()) as ApiErrorResponse;
      expect(prodErr.error.code).toBe('NOT_READY');
    });
  });

  describe('Session Expiry, Multi-Session Lifecycle & Logout-All', () => {
    it('returns 401 SESSION_EXPIRED for genuinely expired sessions in D1', async () => {
      const db = testEnv.DB!;
      const userId = 'user_expired_test_id';
      const now = new Date().toISOString();
      const expiredAt = new Date(Date.now() - 3600 * 1000).toISOString(); // 1 hour ago

      await db
        .prepare(
          `INSERT INTO users (id, email, email_normalized, password_hash, password_salt, password_algorithm, password_iterations, display_name, role, status, locale, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          userId,
          'expired_user@example.com',
          'expired_user@example.com',
          'dummyhash',
          'dummysalt',
          'pbkdf2-sha256',
          600000,
          'Expired User',
          'user',
          'active',
          'fa',
          now,
          now,
        )
        .run();

      const rawToken = 'genuinely_expired_token_12345';
      const tokenHash = await SessionService.hashSessionToken(rawToken);

      await db
        .prepare(
          `INSERT INTO auth_sessions (id, user_id, token_hash, created_at, last_seen_at, expires_at, revoked_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind('sess_expired_1', userId, tokenHash, expiredAt, expiredAt, expiredAt, null)
        .run();

      // Assert inserted record can be retrieved using production-generated hash before calling /api/v1/auth/me
      const sessionInDb = await db
        .prepare('SELECT * FROM auth_sessions WHERE token_hash = ?')
        .bind(tokenHash)
        .first<AuthSessionRecord>();
      expect(sessionInDb).toBeTruthy();
      expect(sessionInDb?.id).toBe('sess_expired_1');
      expect(sessionInDb?.user_id).toBe(userId);

      const res = await app.request(
        '/api/v1/auth/me',
        {
          headers: { Authorization: `Bearer ${rawToken}` },
        },
        testEnv,
      );

      expect(res.status).toBe(401);
      const data = (await res.json()) as ApiErrorResponse;
      expect(data.error.code).toBe('SESSION_EXPIRED');
    });

    it('revokes multiple independently active sessions simultaneously on logout-all', async () => {
      const regRes = await app.request(
        '/api/v1/auth/register',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'multisession@example.com',
            password: 'MultiPassword123!',
            display_name: 'Multi Session User',
          }),
        },
        testEnv,
      );
      const regData = (await regRes.json()) as ApiResponse<{ user: PublicUser }>;
      const userId = regData.data.user.id;

      // Session 1 (e.g. Web Client)
      const res1 = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'multisession@example.com',
            password: 'MultiPassword123!',
          }),
        },
        testEnv,
      );
      const token1 = ((await res1.json()) as ApiResponse<{ token: string }>).data.token;

      // Session 2 (e.g. Mobile Client)
      const res2 = await app.request(
        '/api/v1/auth/token',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: 'multisession@example.com',
            password: 'MultiPassword123!',
          }),
        },
        testEnv,
      );
      const token2 = ((await res2.json()) as ApiResponse<{ token: string }>).data.token;

      expect(token1).not.toBe(token2);

      // Both tokens are valid and /me strips sensitive fields
      const me1Before = await app.request(
        '/api/v1/auth/me',
        { headers: { Authorization: `Bearer ${token1}` } },
        testEnv,
      );
      const me2Before = await app.request(
        '/api/v1/auth/me',
        { headers: { Authorization: `Bearer ${token2}` } },
        testEnv,
      );
      expect(me1Before.status).toBe(200);
      expect(me2Before.status).toBe(200);

      const me1Data = (await me1Before.json()) as ApiResponse<{ user: PublicUser }>;
      expectPublicUser(me1Data.data.user as unknown as Record<string, unknown>);

      // Call logout-all using token 1
      const logoutAllRes = await app.request(
        '/api/v1/auth/logout-all',
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token1}` },
        },
        testEnv,
      );
      expect(logoutAllRes.status).toBe(200);

      // Both session 1 and session 2 must be revoked
      const me1After = await app.request(
        '/api/v1/auth/me',
        { headers: { Authorization: `Bearer ${token1}` } },
        testEnv,
      );
      const me2After = await app.request(
        '/api/v1/auth/me',
        { headers: { Authorization: `Bearer ${token2}` } },
        testEnv,
      );
      expect(me1After.status).toBe(401);
      expect(me2After.status).toBe(401);
      expect(((await me1After.json()) as ApiErrorResponse).error.code).toBe('SESSION_EXPIRED');
      expect(((await me2After.json()) as ApiErrorResponse).error.code).toBe('SESSION_EXPIRED');

      // Verify 0 active (non-revoked) sessions remain in D1 for user
      const remaining = await testEnv
        .DB!.prepare(
          'SELECT COUNT(*) as count FROM auth_sessions WHERE user_id = ? AND revoked_at IS NULL',
        )
        .bind(userId)
        .first<{ count: number }>();
      expect(remaining?.count).toBe(0);
    }, 30000);
  });

  describe('RBAC, Sensitive Field Stripping & Admin Self-Disable Prevention', () => {
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
      expectPublicUser(listData.data.users[1] as unknown as Record<string, unknown>);

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
