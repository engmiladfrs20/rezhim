import type {
  D1Database,
  KVNamespace,
  Queue,
  ExecutionContext,
  MessageBatch,
} from '@cloudflare/workers-types';

export type { ExecutionContext, MessageBatch, D1Database, KVNamespace, Queue };

export interface CloudflareEnv {
  // Environment metadata
  APP_ENV?: 'development' | 'staging' | 'production' | 'test' | undefined;
  SERVICE_NAME?: string | undefined;
  APP_VERSION?: string | undefined;
  ALLOWED_ORIGINS?: string | undefined;

  // Security & Storage Secrets
  RATE_LIMIT_HMAC_SECRET?: string | undefined;
  B2_ENDPOINT?: string | undefined;
  B2_REGION?: string | undefined;
  B2_BUCKET_NAME?: string | undefined;
  B2_KEY_ID?: string | undefined;
  B2_APPLICATION_KEY?: string | undefined;
  GEMINI_API_KEY?: string | undefined;
  GEMINI_MODEL?: string | undefined;
  GEMINI_ENDPOINT?: string | undefined;

  // Cloudflare D1 Database binding placeholder
  DB?: D1Database | undefined;

  // Cloudflare KV Namespace binding placeholder
  KV_CACHE?: KVNamespace | undefined;

  // Cloudflare Queue binding placeholder
  AI_JOBS_QUEUE?: Queue | undefined;
}
