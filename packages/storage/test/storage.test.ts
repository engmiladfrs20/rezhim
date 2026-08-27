import { describe, it, expect, beforeEach } from 'vitest';
import {
  MemoryStorageProvider,
  StorageFactory,
  InvalidStorageKeyError,
  ObjectNotFoundError,
  StorageConfigError,
} from '../src';
import { normalizeAndValidateKey, convertBodyToUint8Array } from '../src/utils';

describe('Storage Provider Contract - MemoryStorageProvider', () => {
  let provider: MemoryStorageProvider;

  beforeEach(() => {
    provider = new MemoryStorageProvider();
  });

  it('puts, gets, and verifies objects with Uint8Array', async () => {
    const data = new TextEncoder().encode('Hello NutriAI Persia Storage');
    const putRes = await provider.putObject({
      key: 'test/sample.txt',
      data,
      contentType: 'text/plain',
      metadata: { author: 'unit-test' },
    });

    expect(putRes.key).toBe('test/sample.txt');
    expect(putRes.etag).toBeDefined();

    const exists = await provider.objectExists('test/sample.txt');
    expect(exists).toBe(true);

    const getRes = await provider.getObject('test/sample.txt');
    expect(getRes.contentType).toBe('text/plain');
    expect(getRes.metadata?.author).toBe('unit-test');

    const retrievedText = new TextDecoder().decode(getRes.data as Uint8Array);
    expect(retrievedText).toBe('Hello NutriAI Persia Storage');

    const meta = await provider.getMetadata('test/sample.txt');
    expect(meta).not.toBeNull();
    expect(meta?.sizeBytes).toBe(data.byteLength);
  });

  it('throws ObjectNotFoundError when retrieving non-existent object', async () => {
    await expect(provider.getObject('not-found.txt')).rejects.toThrow(ObjectNotFoundError);
    expect(await provider.objectExists('not-found.txt')).toBe(false);
    expect(await provider.getMetadata('not-found.txt')).toBeNull();
  });

  it('rejects invalid storage keys with path traversal or illegal characters', async () => {
    const data = new Uint8Array([1, 2, 3]);

    await expect(
      provider.putObject({
        key: '../traversal.txt',
        data,
        contentType: 'application/octet-stream',
      }),
    ).rejects.toThrow(InvalidStorageKeyError);

    await expect(
      provider.putObject({
        key: 'invalid character key $#*!',
        data,
        contentType: 'application/octet-stream',
      }),
    ).rejects.toThrow(InvalidStorageKeyError);
  });

  it('deletes objects cleanly', async () => {
    const data = new Uint8Array([1, 2]);
    await provider.putObject({
      key: 'to-delete.bin',
      data,
      contentType: 'application/octet-stream',
    });

    expect(await provider.objectExists('to-delete.bin')).toBe(true);
    const deleted = await provider.deleteObject('to-delete.bin');
    expect(deleted).toBe(true);
    expect(await provider.objectExists('to-delete.bin')).toBe(false);
  });

  it('generates signed upload and download URLs', async () => {
    const uploadUrl = await provider.getSignedUploadUrl({
      key: 'uploads/photo.jpg',
      contentType: 'image/jpeg',
      expiresInSeconds: 300,
    });

    expect(uploadUrl.url).toContain('uploads%2Fphoto.jpg');
    expect(uploadUrl.method).toBe('PUT');
    expect(uploadUrl.expiresAt).toBeDefined();

    await provider.putObject({
      key: 'uploads/photo.jpg',
      data: new Uint8Array([1]),
      contentType: 'image/jpeg',
    });

    const downloadUrl = await provider.getSignedDownloadUrl({
      key: 'uploads/photo.jpg',
      expiresInSeconds: 300,
    });

    expect(downloadUrl.url).toContain('uploads%2Fphoto.jpg');
    expect(downloadUrl.method).toBe('GET');
  });

  it('throws ObjectNotFoundError when signing download URL for missing object in memory provider', async () => {
    await expect(
      provider.getSignedDownloadUrl({
        key: 'missing.jpg',
        expiresInSeconds: 300,
      }),
    ).rejects.toThrow(ObjectNotFoundError);
  });

  it('clears memory storage', async () => {
    await provider.putObject({
      key: 'item1.txt',
      data: new Uint8Array([1]),
      contentType: 'text/plain',
    });
    expect(await provider.objectExists('item1.txt')).toBe(true);
    provider.clear();
    expect(await provider.objectExists('item1.txt')).toBe(false);
  });
});

describe('StorageFactory Policies', () => {
  it('creates memory provider in development or test', () => {
    const devProvider = StorageFactory.createProvider({
      type: 'memory',
      environment: 'development',
    });
    expect(devProvider.providerName).toBe('memory');

    const testProvider = StorageFactory.createProvider({
      type: 'memory',
      environment: 'test',
    });
    expect(testProvider.providerName).toBe('memory');

    const defaultProvider = StorageFactory.createProvider({
      type: 'memory',
    });
    expect(defaultProvider.providerName).toBe('memory');
  });

  it('throws StorageConfigError if memory provider is requested in staging or production', () => {
    expect(() => {
      StorageFactory.createProvider({
        type: 'memory',
        environment: 'staging',
      });
    }).toThrow(StorageConfigError);

    expect(() => {
      StorageFactory.createProvider({
        type: 'memory',
        environment: 'production',
      });
    }).toThrow(/MemoryStorageProvider is not permitted/);
  });

  it('creates BackblazeB2StorageProvider when b2Config is provided', () => {
    const provider = StorageFactory.createProvider({
      type: 'backblaze-b2',
      b2Config: {
        endpoint: 'https://s3.us-west-004.backblazeb2.com',
        region: 'us-west-004',
        bucketName: 'nutriai-media-test',
        keyId: 'test-key',
        applicationKey: 'test-secret',
      },
    });
    expect(provider.providerName).toBe('backblaze-b2');
  });

  it('throws StorageConfigError if backblaze-b2 is requested without config', () => {
    expect(() => {
      StorageFactory.createProvider({ type: 'backblaze-b2' });
    }).toThrow(StorageConfigError);
  });

  it('throws StorageConfigError for unknown provider type', () => {
    expect(() => {
      // @ts-expect-error - testing runtime error on invalid type
      StorageFactory.createProvider({ type: 'unsupported-cloud' });
    }).toThrow(/Unknown storage provider type/);
  });
});

describe('Storage Utils', () => {
  it('normalizes valid keys and strips leading slashes', () => {
    expect(normalizeAndValidateKey('/valid/path.png')).toBe('valid/path.png');
    expect(normalizeAndValidateKey('folder/file.json')).toBe('folder/file.json');
  });

  it('rejects empty or invalid storage keys', () => {
    expect(() => normalizeAndValidateKey('')).toThrow(InvalidStorageKeyError);
    // @ts-expect-error - testing runtime type validation
    expect(() => normalizeAndValidateKey(null)).toThrow(InvalidStorageKeyError);
    expect(() => normalizeAndValidateKey('../traversal.txt')).toThrow(InvalidStorageKeyError);
  });

  it('converts various body formats to Uint8Array', async () => {
    const raw = new Uint8Array([1, 2, 3]);
    expect(await convertBodyToUint8Array(raw)).toBe(raw);

    const int16 = new Int16Array([10, 20]);
    const fromView = await convertBodyToUint8Array(int16);
    expect(fromView.byteLength).toBe(4);

    const ab = new ArrayBuffer(8);
    const fromAb = await convertBodyToUint8Array(ab);
    expect(fromAb.byteLength).toBe(8);

    const blob = new Blob(['hello world']);
    const fromBlob = await convertBodyToUint8Array(blob);
    expect(new TextDecoder().decode(fromBlob)).toBe('hello world');

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2]));
        controller.enqueue(new Uint8Array([3, 4]));
        controller.close();
      },
    });
    const fromStream = await convertBodyToUint8Array(stream);
    expect(Array.from(fromStream)).toEqual([1, 2, 3, 4]);

    const arrayLike = [10, 20, 30];
    const fromArrayLike = await convertBodyToUint8Array(arrayLike as unknown as ArrayBuffer);
    expect(Array.from(fromArrayLike)).toEqual([10, 20, 30]);

    await expect(convertBodyToUint8Array(12345 as unknown as ArrayBuffer)).rejects.toThrow(
      /Unsupported storage data format/,
    );
  });
});
