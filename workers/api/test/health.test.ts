import { describe, it, expect } from 'vitest';
import worker, { isAllowedOrigin, sanitizeOrGenerateRequestId } from '../src/index';
import type { HealthCheckResponse, ApiErrorResponse, CloudflareEnv } from '@nutriai/types';

describe('Cloudflare Worker API - Health & Security Tests', () => {
  it('responds with 200 and standard HealthCheckResponse format on GET /health', async () => {
    const req = new Request('http://localhost/health', {
      method: 'GET',
    });

    const res = await worker.fetch(req, {
      APP_ENV: 'development',
      SERVICE_NAME: 'nutriai-api',
      APP_VERSION: '1.0.0',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as HealthCheckResponse;
    expect(body.status).toBe('ok');
    expect(body.service).toBe('nutriai-api');
    expect(body.version).toBe('1.0.0');
    expect(body.timestamp).toBeDefined();

    // Verify security headers
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
    expect(res.headers.get('X-Request-Id')).toBeDefined();
  });

  it('rejects unauthenticated storage requests with 501 in Phase 1', async () => {
    const req = new Request('http://localhost/api/storage/upload-url', {
      method: 'POST',
      body: JSON.stringify({ key: 'test.jpg' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await worker.fetch(req, {});
    expect(res.status).toBe(501);

    const body = (await res.json()) as ApiErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PHASE_1_PLACEHOLDER');
  });

  it('rejects unauthenticated AI inference requests with 501 in Phase 1', async () => {
    const req = new Request('http://localhost/api/ai/analyze', {
      method: 'POST',
      body: JSON.stringify({ image: 'base64...' }),
      headers: { 'Content-Type': 'application/json' },
    });

    const res = await worker.fetch(req, {});
    expect(res.status).toBe(501);

    const body = (await res.json()) as ApiErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('PHASE_1_PLACEHOLDER');
  });

  it('returns 404 for non-existent routes with safe format', async () => {
    const req = new Request('http://localhost/non-existent-route');
    const res = await worker.fetch(req, {});
    expect(res.status).toBe(404);

    const body = (await res.json()) as ApiErrorResponse;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('returns root greeting on GET /', async () => {
    const req = new Request('http://localhost/');
    const res = await worker.fetch(req, {});
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('NutriAI Persia API Worker');
  });

  it('handles CORS preflight and request headers on API routes', async () => {
    const req = new Request('http://localhost/api/storage/upload-url', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:3000',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type, X-Request-Id',
      },
    });

    const res = await worker.fetch(req, { APP_ENV: 'development' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
  });

  it('blocks disallowed origins in CORS preflight', async () => {
    const req = new Request('http://localhost/api/storage/upload-url', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://malicious.com',
        'Access-Control-Request-Method': 'POST',
      },
    });

    const res = await worker.fetch(req, { APP_ENV: 'production' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
});

describe('Request ID Validation', () => {
  it('preserves valid client-provided alphanumeric request IDs', () => {
    const validId = 'req-12345-abcdef';
    expect(sanitizeOrGenerateRequestId(validId)).toBe(validId);

    const uuid = '550e8400-e29b-41d4-a716-446655440000';
    expect(sanitizeOrGenerateRequestId(uuid)).toBe(uuid);
  });

  it('generates a new UUID when client request ID is missing or invalid', () => {
    const emptyId = sanitizeOrGenerateRequestId(undefined);
    expect(emptyId).toMatch(/^[0-9a-f-]{36}$/);

    const nullId = sanitizeOrGenerateRequestId(null);
    expect(nullId).toMatch(/^[0-9a-f-]{36}$/);

    // Invalid characters or too short/long
    const invalidChars = sanitizeOrGenerateRequestId('<script>alert(1)</script>');
    expect(invalidChars).not.toBe('<script>alert(1)</script>');
    expect(invalidChars).toMatch(/^[0-9a-f-]{36}$/);

    const tooShort = sanitizeOrGenerateRequestId('abc');
    expect(tooShort).not.toBe('abc');
  });
});

describe('CORS Origin Validation', () => {
  const devEnv: CloudflareEnv = { APP_ENV: 'development' };
  const prodEnv: CloudflareEnv = {
    APP_ENV: 'production',
    ALLOWED_ORIGINS: 'https://app.nutriai.persia,https://admin.nutriai.persia',
  };

  it('allows exact localhost origins in development', () => {
    expect(isAllowedOrigin('http://localhost:3000', devEnv)).toBe(true);
    expect(isAllowedOrigin('http://localhost:3001', devEnv)).toBe(true);
    expect(isAllowedOrigin('http://127.0.0.1:3000', devEnv)).toBe(true);
  });

  it('rejects malicious lookalike hostnames containing localhost or substrings', () => {
    expect(isAllowedOrigin('http://localhost.attacker.com', devEnv)).toBe(false);
    expect(isAllowedOrigin('http://attacker-localhost.com', devEnv)).toBe(false);
    expect(isAllowedOrigin('http://127.0.0.1.attacker.com', devEnv)).toBe(false);
    expect(isAllowedOrigin('javascript:alert(1)', devEnv)).toBe(false);
  });

  it('rejects unconfigured origins and malicious subdomains in production', () => {
    expect(isAllowedOrigin('http://localhost:3000', prodEnv)).toBe(false);
    expect(isAllowedOrigin('https://app.nutriai.persia.attacker.com', prodEnv)).toBe(false);
    expect(isAllowedOrigin('https://evil-run.app', prodEnv)).toBe(false);
  });

  it('allows configured origins in production', () => {
    expect(isAllowedOrigin('https://app.nutriai.persia', prodEnv)).toBe(true);
    expect(isAllowedOrigin('https://admin.nutriai.persia', prodEnv)).toBe(true);
    expect(isAllowedOrigin('https://nutriai.persia', prodEnv)).toBe(true);
  });

  it('handles edge case origin inputs safely', () => {
    expect(isAllowedOrigin(undefined, devEnv)).toBe(false);
    expect(isAllowedOrigin(null, devEnv)).toBe(false);
    expect(isAllowedOrigin('', devEnv)).toBe(false);
    expect(isAllowedOrigin('not-a-url', devEnv)).toBe(false);
    expect(isAllowedOrigin('ftp://localhost:3000', devEnv)).toBe(false);
    expect(isAllowedOrigin('http://localhost:3000', {})).toBe(true);
    expect(
      isAllowedOrigin('https://custom.nutriai.persia', {
        APP_ENV: 'production',
        ALLOWED_ORIGINS: 'not-a-valid-url,https://custom.nutriai.persia',
      }),
    ).toBe(true);
  });
});
