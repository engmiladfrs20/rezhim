import type { StorageProvider, BackblazeB2Config } from '@nutriai/types';
import { MemoryStorageProvider } from './MemoryStorageProvider';
import { BackblazeB2StorageProvider } from './BackblazeB2StorageProvider';
import { StorageConfigError } from './errors';

export type StorageProviderType = 'backblaze-b2' | 'memory';

export interface StorageFactoryOptions {
  type: StorageProviderType;
  b2Config?: BackblazeB2Config | undefined;
  environment?: 'development' | 'staging' | 'production' | 'test' | undefined;
}

export class StorageFactory {
  public static createProvider(options: StorageFactoryOptions): StorageProvider {
    if (options.type === 'memory') {
      if (options.environment === 'staging' || options.environment === 'production') {
        throw new StorageConfigError(
          `MemoryStorageProvider is not permitted in '${options.environment}' environment. Use 'backblaze-b2' storage provider.`,
        );
      }
      return new MemoryStorageProvider();
    }

    if (options.type === 'backblaze-b2') {
      if (!options.b2Config) {
        throw new StorageConfigError(
          'Cannot create BackblazeB2StorageProvider: Missing B2 configuration.',
        );
      }
      return new BackblazeB2StorageProvider(options.b2Config);
    }

    throw new StorageConfigError(`Unknown storage provider type: ${String(options.type)}`);
  }
}
