import { describe, it, expect } from 'vitest';
import { createTestStorageProvider, TEST_ENVIRONMENT_CONFIG } from '../src';

describe('Testing Utilities Package (@nutriai/testing)', () => {
  it('creates an initialized MemoryStorageProvider', () => {
    const provider = createTestStorageProvider();
    expect(provider.providerName).toBe('memory');
  });

  it('exports standard testing environment configuration', () => {
    expect(TEST_ENVIRONMENT_CONFIG.APP_ENV).toBe('test');
    expect(TEST_ENVIRONMENT_CONFIG.SERVICE_NAME).toBe('nutriai-api-test');
    expect(TEST_ENVIRONMENT_CONFIG.APP_VERSION).toBe('1.0.0-test');
  });
});
