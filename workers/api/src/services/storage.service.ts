import type {
  CloudflareEnv,
  SignedDownloadUrlParams,
  SignedUploadUrlParams,
  SignedUrlResult,
  StorageProvider,
} from '@nutriai/types';
import type {
  ValidatedSignedDownloadUrlRequest,
  ValidatedSignedUploadUrlRequest,
} from '@nutriai/schemas';
import { InvalidStorageKeyError, StorageConfigError, StorageFactory } from '@nutriai/storage';

/**
 * Server-side storage boundary. Clients can only request URLs for objects in
 * their own namespace; provider credentials never leave the Worker.
 */
export class StorageService {
  private providerInstance: StorageProvider | undefined;

  public constructor(private readonly env: CloudflareEnv) {}

  private provider(): StorageProvider {
    if (this.providerInstance) return this.providerInstance;

    const environment = this.env.APP_ENV ?? 'development';
    const b2ConfigValues = [
      this.env.B2_ENDPOINT,
      this.env.B2_REGION,
      this.env.B2_BUCKET_NAME,
      this.env.B2_KEY_ID,
      this.env.B2_APPLICATION_KEY,
    ];
    const hasB2Config = b2ConfigValues.every(Boolean);
    const hasPartialB2Config = b2ConfigValues.some(Boolean);
    const type =
      environment === 'production' || environment === 'staging' || hasB2Config || hasPartialB2Config
        ? 'backblaze-b2'
        : 'memory';

    const provider = StorageFactory.createProvider({
      type,
      environment,
      b2Config:
        type === 'backblaze-b2'
          ? {
              endpoint: this.env.B2_ENDPOINT ?? '',
              region: this.env.B2_REGION ?? '',
              bucketName: this.env.B2_BUCKET_NAME ?? '',
              keyId: this.env.B2_KEY_ID ?? '',
              applicationKey: this.env.B2_APPLICATION_KEY ?? '',
            }
          : undefined,
    });

    this.providerInstance = provider;
    return provider;
  }

  private scopedKey(userId: string, key: string): string {
    if (!userId || !key.startsWith(`user-uploads/${userId}/`)) {
      throw new InvalidStorageKeyError(key, 'Object key must be scoped to the authenticated user.');
    }

    const prefix = `user-uploads/${userId}/`;
    if (key.length <= prefix.length) {
      throw new InvalidStorageKeyError(key, 'Object key must include a file name.');
    }

    return key;
  }

  public async createUploadUrl(
    userId: string,
    input: ValidatedSignedUploadUrlRequest,
  ): Promise<SignedUrlResult> {
    const key = this.scopedKey(userId, input.key);
    const params: SignedUploadUrlParams = {
      key,
      contentType: input.contentType,
      expiresInSeconds: input.expiresInSeconds,
      // User uploads must never become public through a client-controlled ACL.
      acl: 'private',
    };
    return this.provider().getSignedUploadUrl(params);
  }

  public async createDownloadUrl(
    userId: string,
    input: ValidatedSignedDownloadUrlRequest,
  ): Promise<SignedUrlResult> {
    const key = this.scopedKey(userId, input.key);
    const params: SignedDownloadUrlParams = {
      key,
      expiresInSeconds: input.expiresInSeconds,
    };
    return this.provider().getSignedDownloadUrl(params);
  }
}

export { InvalidStorageKeyError, StorageConfigError };
