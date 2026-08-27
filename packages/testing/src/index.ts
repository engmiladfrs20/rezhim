import { MemoryStorageProvider } from '@nutriai/storage';

export function createTestStorageProvider(): MemoryStorageProvider {
  return new MemoryStorageProvider();
}

export const TEST_ENVIRONMENT_CONFIG = {
  APP_ENV: 'test' as const,
  SERVICE_NAME: 'nutriai-api-test',
  APP_VERSION: '1.0.0-test',
};
