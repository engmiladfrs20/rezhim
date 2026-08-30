/// <reference types="@cloudflare/workers-types/experimental" />
import type { CloudflareEnv } from '@nutriai/types';

declare module 'cloudflare:workers' {
  interface ProvidedEnv extends CloudflareEnv {
    TEST_MIGRATIONS: import('cloudflare:test').D1Migration[];
  }
}

declare module '*.json' {
  const value: any;
  export default value;
}
