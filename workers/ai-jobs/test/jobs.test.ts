import { describe, it, expect } from 'vitest';
import worker from '../src/index';
import type { CloudflareEnv, ExecutionContext, MessageBatch } from '@nutriai/types';

describe('AI Jobs Worker (workers/ai-jobs)', () => {
  it('returns status 200 on fetch placeholder', async () => {
    const req = new Request('http://localhost/');
    const mockEnv: CloudflareEnv = {
      APP_ENV: 'development',
      SERVICE_NAME: 'nutriai-ai-jobs',
    };
    const mockCtx = {} as ExecutionContext;

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const body = (await res.json()) as { status: string; service: string };
    expect(body.status).toBe('ok');
    expect(body.service).toBe('nutriai-ai-jobs');
  });

  it('handles queue batches gracefully in Phase 1 placeholder', async () => {
    const mockBatch = {
      messages: [],
      queue: 'nutriai-ai-jobs-dev',
      ackAll: () => {},
      retryAll: () => {},
    } as unknown as MessageBatch<unknown>;
    const mockEnv: CloudflareEnv = { APP_ENV: 'development' };
    const mockCtx = {} as ExecutionContext;

    await expect(worker.queue(mockBatch, mockEnv, mockCtx)).resolves.toBeUndefined();
  });
});
