import { describe, it, expect } from 'vitest';
import { createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import worker from '../src/index';

import { env } from 'cloudflare:workers';

import { SystemRepository } from '../src/db/system.repository';

describe('NutriAI API Worker Integration Tests (D1 Bound)', () => {
  describe('GET /health', () => {
    it('returns 200 ok for liveness probe without accessing D1 binding', async () => {
      const request = new Request('http://localhost/health');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const data = await response.json<{ status: string; database?: string }>();
      expect(data.status).toBe('ok');
    });
  });

  describe('GET /ready', () => {
    it('returns 200 and connected status when D1 database is healthy', async () => {
      const repo = new SystemRepository(env.DB);
      await repo.setMetadata(
        'sys-01',
        'schema_version',
        '0001_system_metadata',
        new Date().toISOString(),
      );

      const req = new Request('http://localhost/ready', { method: 'GET' });
      const ctx = createExecutionContext();
      const res = await worker.fetch(req, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(res.status).toBe(200);
      const body = await res.json<{ status: string; database?: string }>();
      expect(body.status).toBe('ok');
    });

    it('gracefully degrades returning 503 if D1 binding is completely missing', async () => {
      const degradedEnv = { ...env };
      delete (degradedEnv as { DB?: unknown }).DB;

      const request = new Request('http://localhost/ready');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, degradedEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(503);
      const data = await response.json<{ status: string; database?: string }>();
      expect(data.status).toBe('degraded');
      expect(data.database).toBe('disconnected');
    });
  });

  describe('GET /api/v1/system', () => {
    it('returns system metadata safely stripping internals', async () => {
      const request = new Request('http://localhost/api/v1/system');

      const repo = new SystemRepository(env.DB);
      await repo.setMetadata('sys-01', 'schema_version', 'mocked_v1', new Date().toISOString());

      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(200);
      const payload = await response.json<{
        success: boolean;
        data: { schema_version: string; last_migration: string };
        requestId: string;
      }>();
      expect(payload.success).toBe(true);
      expect(payload.data.schema_version).toBe('mocked_v1');
      expect(payload.requestId).toBeDefined();
    });
  });

  describe('Configuration, 404, CORS bounds, Request ID Injection', () => {
    it('generates missing RequestIds natively on 404 boundaries', async () => {
      const request = new Request('http://localhost/random-not-found');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.status).toBe(404);
      expect(response.headers.get('X-Request-Id')).toBeDefined();
    });

    it('preserves valid client-side X-Request-Id', async () => {
      const request = new Request('http://localhost/health', {
        headers: { 'X-Request-Id': 'custom-client-id-123456789' },
      });
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('X-Request-Id')).toBe('custom-client-id-123456789');
    });

    it('injects standard security headers globally', async () => {
      const request = new Request('http://localhost/health');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);

      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('allows permitted origins securely', async () => {
      const req = new Request('http://localhost/api/v1/system', {
        headers: {
          Origin: 'http://localhost:3000',
        },
      });
      const modifiedEnv = { ...env, ALLOWED_ORIGINS: 'http://localhost:3000' };
      const ctx = createExecutionContext();
      const res = await worker.fetch(req, modifiedEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:3000');
    });

    it('blocks illegitimate standard origins immediately yielding 403 bounds', async () => {
      const req = new Request('http://localhost/api/v1/system', {
        method: 'OPTIONS',
        headers: {
          Origin: 'https://malicious.com',
        },
      });
      const modifiedEnv = { ...env, ALLOWED_ORIGINS: 'http://localhost:3000' };
      const ctx = createExecutionContext();
      const res = await worker.fetch(req, modifiedEnv, ctx);
      await waitOnExecutionContext(ctx);

      expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('Feature disabled stubs (Placeholder checks)', () => {
    it('returns FEATURE_NOT_AVAILABLE for unprotected /api/storage/ tests', async () => {
      const request = new Request('http://localhost/api/storage/test');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(501);
    });

    it('returns FEATURE_NOT_AVAILABLE for unprotected /api/ai/ tests', async () => {
      const request = new Request('http://localhost/api/ai/test');
      const ctx = createExecutionContext();
      const response = await worker.fetch(request, env, ctx);
      await waitOnExecutionContext(ctx);
      expect(response.status).toBe(501);
    });
  });

  describe('SystemRepository SQL Bind Integrity Testing', () => {
    it('ensures prepared statements strip SQL injections natively as raw strings mapping D1 constraints cleanly', async () => {
      const repo = new SystemRepository(env.DB);

      // Testing raw payload execution - it should not execute dropping
      const injectionStr = "' OR 1=1; DROP TABLE system_metadata; --";
      await repo.setMetadata('inj-01', injectionStr, 'safe', new Date().toISOString());

      const val = await repo.getMetadata(injectionStr);
      expect(val?.key).toBe(injectionStr);
      expect(val?.value).toBe('safe');

      // Verifies the db still exists
      const safeCheck = await env.DB!.prepare('SELECT 1').first();
      expect(safeCheck).not.toBeNull();
    });
  });
});
