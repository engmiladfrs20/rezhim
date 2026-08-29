import { describe, it } from 'vitest';

describe('PBKDF2 Web Crypto Benchmarks (Cloudflare Constraints)', () => {
  it('measures 600,000 iterations to verify CPU bounds', async () => {
    const password = 'BenchmarkPassword_12#';
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iterations = 600000;

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey'],
    );

    const start = performance.now();
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      256,
    );
    const timeMs = performance.now() - start;

    console.log(`[BENCHMARK] PBKDF2 600K iterations took: ${timeMs.toFixed(2)}ms`);
  });
});
