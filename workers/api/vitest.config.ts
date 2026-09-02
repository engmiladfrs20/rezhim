import { defineConfig } from 'vitest/config';
import { readD1Migrations, cloudflareTest } from '@cloudflare/vitest-plugin';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default async () => {
  const migrationsPath = path.join(__dirname, 'migrations');
  const migrations = await readD1Migrations(migrationsPath);

  return defineConfig({
    plugins: [
      cloudflareTest({
        // CI has no interactive Wrangler profile. Keep D1 and all test
        // bindings in the local Miniflare runtime; provider calls are tested
        // through the fail-closed boundary and production smoke checks.
        remoteBindings: false,
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      fileParallelism: false,
      // D1/Workerd integration calls can take several seconds when the
      // worker test environment is starting or when CI shares a runner.
      // Keep the tests deterministic without masking genuine hangs.
      testTimeout: 30_000,
      hookTimeout: 30_000,
      setupFiles: ['./test/apply-migrations.ts'],
      coverage: {
        provider: 'istanbul',
        thresholds: {
          lines: 70,
          functions: 50,
          branches: 50,
          statements: 70,
        },
      },
    },
  });
};
