import type { CloudflareEnv, ExecutionContext, MessageBatch } from '@nutriai/types';

export default {
  async fetch(_request: Request, _env: CloudflareEnv, _ctx: ExecutionContext): Promise<Response> {
    return new Response(
      JSON.stringify({
        status: 'ok',
        service: 'nutriai-ai-jobs',
        message: 'Worker queue consumer placeholder for asynchronous AI jobs (Phase 1).',
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      },
    );
  },

  async queue(
    _batch: MessageBatch<unknown>,
    _env: CloudflareEnv,
    _ctx: ExecutionContext,
  ): Promise<void> {
    // Phase 1 architecture placeholder:
    // In Phase 2, this will consume AI image analysis and macro estimation jobs from Cloudflare Queues.
  },
};
