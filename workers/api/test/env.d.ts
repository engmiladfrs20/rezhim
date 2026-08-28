/// <reference types="@cloudflare/workers-types/experimental" />
import type { CloudflareEnv } from '@nutriai/types';

declare global {
  namespace Cloudflare {
    interface Env extends CloudflareEnv {
      TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
    }
  }
}

declare module 'cloudflare:test' {
  interface ProvidedEnv extends CloudflareEnv {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}
