import { describe, it, expect, vi } from 'vitest';
import type { S3Client } from '@aws-sdk/client-s3';
import {
  BackblazeB2StorageProvider,
  StorageConfigError,
  StorageError,
  ObjectNotFoundError,
} from '../src';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockImplementation(async (_client, _command, options) => {
    return `https://s3.us-west-004.backblazeb2.com/test-signed?expiresIn=${options.expiresIn}`;
  }),
}));

describe('BackblazeB2StorageProvider (Mocked Contract Tests)', () => {
  const validConfig = {
    endpoint: 'https://s3.us-west-004.backblazeb2.com',
    region: 'us-west-004',
    bucketName: 'nutriai-media-test',
    keyId: 'test-key-id-001',
    applicationKey: 'test-application-key-secret',
  };

  it('rejects invalid configuration on initialization', () => {
    expect(() => {
      new BackblazeB2StorageProvider({
        ...validConfig,
        endpoint: 'not-a-valid-url',
      });
    }).toThrow(StorageConfigError);

    expect(() => {
      new BackblazeB2StorageProvider({
        ...validConfig,
        bucketName: 'INVALID_BUCKET_NAME_WITH_CAPS',
      });
    }).toThrow(StorageConfigError);
  });

  describe('putObject', () => {
    it('constructs PutObjectCommand correctly and returns PutObjectResult', async () => {
      const mockSend = vi.fn().mockResolvedValue({
        ETag: '"etag-12345"',
        VersionId: 'v1',
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const result = await provider.putObject({
        key: 'users/profile.jpg',
        data: new Uint8Array([10, 20, 30]),
        contentType: 'image/jpeg',
        acl: 'public-read',
        metadata: { userId: 'u123' },
      });

      expect(result.key).toBe('users/profile.jpg');
      expect(result.etag).toBe('"etag-12345"');
      expect(result.versionId).toBe('v1');
      expect(mockSend).toHaveBeenCalledTimes(1);

      const command = mockSend.mock.calls[0]?.[0];
      expect(command.input.Bucket).toBe('nutriai-media-test');
      expect(command.input.Key).toBe('users/profile.jpg');
      expect(command.input.ContentType).toBe('image/jpeg');
      expect(command.input.ACL).toBe('public-read');
      expect(command.input.Metadata).toEqual({ userId: 'u123' });
    });

    it('wraps putObject errors in sanitized StorageError', async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error('Network connection timeout'));
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      await expect(
        provider.putObject({
          key: 'users/test.png',
          data: new Uint8Array([1]),
          contentType: 'image/png',
        }),
      ).rejects.toThrow(StorageError);
    });
  });

  describe('getObject', () => {
    it('retrieves object and converts body to byte array', async () => {
      const bytes = new Uint8Array([1, 2, 3, 4]);
      const mockSend = vi.fn().mockResolvedValue({
        Body: {
          transformToByteArray: vi.fn().mockResolvedValue(bytes),
        },
        ContentType: 'image/png',
        ContentLength: 4,
        ETag: '"etag-999"',
        Metadata: { tag: 'food' },
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const result = await provider.getObject('photos/meal.png');
      expect(result.data).toEqual(bytes);
      expect(result.contentType).toBe('image/png');
      expect(result.contentLength).toBe(4);
      expect(result.etag).toBe('"etag-999"');
      expect(result.metadata).toEqual({ tag: 'food' });
    });

    it('throws ObjectNotFoundError on 404/NoSuchKey', async () => {
      const mockSend = vi.fn().mockRejectedValue({
        name: 'NoSuchKey',
        $metadata: { httpStatusCode: 404 },
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      await expect(provider.getObject('missing.png')).rejects.toThrow(ObjectNotFoundError);
    });

    it('throws sanitized StorageError on non-404 errors (e.g. 403 or 500)', async () => {
      const mockSend = vi.fn().mockRejectedValue({
        name: 'AccessDenied',
        message: 'Invalid credentials',
        $metadata: { httpStatusCode: 403 },
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      await expect(provider.getObject('protected.png')).rejects.toThrow(StorageError);
    });
  });

  describe('deleteObject', () => {
    it('constructs DeleteObjectCommand and deletes object', async () => {
      const mockSend = vi.fn().mockResolvedValue({});
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const success = await provider.deleteObject('file-to-delete.txt');
      expect(success).toBe(true);

      const command = mockSend.mock.calls[0]?.[0];
      expect(command.input.Bucket).toBe('nutriai-media-test');
      expect(command.input.Key).toBe('file-to-delete.txt');
    });

    it('re-throws sanitized StorageError on delete failures', async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error('ThrottlingException'));
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      await expect(provider.deleteObject('throttled.txt')).rejects.toThrow(StorageError);
    });
  });

  describe('objectExists', () => {
    it('returns true on 200 HeadObject response', async () => {
      const mockSend = vi.fn().mockResolvedValue({ ContentLength: 50 });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const exists = await provider.objectExists('existing-file.txt');
      expect(exists).toBe(true);
    });

    it('returns false ONLY for verified 404 / NotFound / NoSuchKey', async () => {
      const mockSend = vi.fn().mockRejectedValue({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const exists = await provider.objectExists('missing-file.txt');
      expect(exists).toBe(false);
    });

    it('re-throws authorization, network, or server failures as sanitized StorageError', async () => {
      const mockSend = vi.fn().mockRejectedValue({
        name: 'InternalError',
        message: 'B2 server unavailable',
        $metadata: { httpStatusCode: 500 },
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      await expect(provider.objectExists('erroneous-file.txt')).rejects.toThrow(StorageError);
    });
  });

  describe('getMetadata', () => {
    it('returns ObjectMetadata on successful HeadObject', async () => {
      const now = new Date();
      const mockSend = vi.fn().mockResolvedValue({
        ContentLength: 1024,
        ContentType: 'application/json',
        LastModified: now,
        ETag: '"etag-abc"',
        Metadata: { source: 'api' },
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const meta = await provider.getMetadata('data.json');
      expect(meta).toEqual({
        key: 'data.json',
        sizeBytes: 1024,
        contentType: 'application/json',
        lastModified: now,
        etag: '"etag-abc"',
        metadata: { source: 'api' },
      });
    });

    it('returns null on 404 NotFound', async () => {
      const mockSend = vi.fn().mockRejectedValue({
        name: 'NotFound',
        $metadata: { httpStatusCode: 404 },
      });
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const meta = await provider.getMetadata('missing-meta.json');
      expect(meta).toBeNull();
    });

    it('re-throws sanitized StorageError on non-404 errors', async () => {
      const mockSend = vi.fn().mockRejectedValue(new Error('Network error'));
      const mockClient = { send: mockSend } as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      await expect(provider.getMetadata('network-fail.json')).rejects.toThrow(StorageError);
    });
  });

  describe('signed URLs & expiration bounds', () => {
    it('generates signed upload URL for valid expiration', async () => {
      const mockClient = {} as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const result = await provider.getSignedUploadUrl({
        key: 'uploads/target.jpg',
        contentType: 'image/jpeg',
        expiresInSeconds: 3600,
        acl: 'public-read',
      });

      expect(result.url).toContain('test-signed');
      expect(result.method).toBe('PUT');
      expect(result.expiresAt).toBeDefined();
    });

    it('generates signed download URL for valid expiration', async () => {
      const mockClient = {} as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      const result = await provider.getSignedDownloadUrl({
        key: 'downloads/target.jpg',
        expiresInSeconds: 1800,
      });

      expect(result.url).toContain('test-signed');
      expect(result.method).toBe('GET');
      expect(result.expiresAt).toBeDefined();
    });

    it('rejects signed URL generation when expiration is out of bounds or non-integer', async () => {
      const mockClient = {} as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      // Expiration <= 0
      await expect(
        provider.getSignedUploadUrl({
          key: 'test.jpg',
          contentType: 'image/jpeg',
          expiresInSeconds: 0,
        }),
      ).rejects.toThrow(StorageConfigError);

      // Expiration > 604800 (7 days)
      await expect(
        provider.getSignedUploadUrl({
          key: 'test.jpg',
          contentType: 'image/jpeg',
          expiresInSeconds: 1000000,
        }),
      ).rejects.toThrow(StorageConfigError);

      // Non-integer expiration
      await expect(
        provider.getSignedDownloadUrl({
          key: 'test.jpg',
          expiresInSeconds: 120.5,
        }),
      ).rejects.toThrow(StorageConfigError);
    });

    it('wraps signing errors in sanitized StorageError', async () => {
      const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');
      vi.mocked(getSignedUrl).mockRejectedValueOnce(new Error('Signing failure'));

      const mockClient = {} as unknown as S3Client;
      const provider = new BackblazeB2StorageProvider(validConfig, mockClient);

      await expect(
        provider.getSignedUploadUrl({
          key: 'test.jpg',
          contentType: 'image/jpeg',
          expiresInSeconds: 300,
        }),
      ).rejects.toThrow(StorageError);

      vi.mocked(getSignedUrl).mockRejectedValueOnce(new Error('Signing failure'));
      await expect(
        provider.getSignedDownloadUrl({
          key: 'test.jpg',
          expiresInSeconds: 300,
        }),
      ).rejects.toThrow(StorageError);
    });
  });
});
