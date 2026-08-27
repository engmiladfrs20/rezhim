import type {
  StorageProvider,
  PutObjectParams,
  PutObjectResult,
  GetObjectResult,
  SignedUploadUrlParams,
  SignedDownloadUrlParams,
  SignedUrlResult,
  ObjectMetadata,
} from '@nutriai/types';
import { normalizeAndValidateKey, convertBodyToUint8Array } from './utils';
import { ObjectNotFoundError } from './errors';

interface StoredMemoryItem {
  data: Uint8Array;
  contentType: string;
  metadata?: Record<string, string> | undefined;
  lastModified: Date;
  etag: string;
}

export class MemoryStorageProvider implements StorageProvider {
  public readonly providerName = 'memory';
  private items = new Map<string, StoredMemoryItem>();

  public async putObject(params: PutObjectParams): Promise<PutObjectResult> {
    const key = normalizeAndValidateKey(params.key);
    const bytes = await convertBodyToUint8Array(params.data);
    const etag = `"${Date.now()}-${bytes.byteLength}"`;

    const item: StoredMemoryItem = {
      data: bytes,
      contentType: params.contentType,
      lastModified: new Date(),
      etag,
    };
    if (params.metadata !== undefined) {
      item.metadata = { ...params.metadata };
    }

    this.items.set(key, item);

    return {
      key,
      etag,
    };
  }

  public async getObject(rawKey: string): Promise<GetObjectResult> {
    const key = normalizeAndValidateKey(rawKey);
    const item = this.items.get(key);
    if (!item) {
      throw new ObjectNotFoundError(key);
    }

    const result: GetObjectResult = {
      data: item.data,
      contentType: item.contentType,
      contentLength: item.data.byteLength,
      etag: item.etag,
    };
    if (item.metadata !== undefined) {
      result.metadata = { ...item.metadata };
    }

    return result;
  }

  public async deleteObject(rawKey: string): Promise<boolean> {
    const key = normalizeAndValidateKey(rawKey);
    return this.items.delete(key);
  }

  public async getSignedUploadUrl(params: SignedUploadUrlParams): Promise<SignedUrlResult> {
    const key = normalizeAndValidateKey(params.key);
    const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();
    return {
      url: `https://memory.storage.local/upload/${encodeURIComponent(key)}?expires=${params.expiresInSeconds}`,
      expiresAt,
      method: 'PUT',
    };
  }

  public async getSignedDownloadUrl(params: SignedDownloadUrlParams): Promise<SignedUrlResult> {
    const key = normalizeAndValidateKey(params.key);
    const exists = this.items.has(key);
    if (!exists) {
      throw new ObjectNotFoundError(key);
    }
    const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();
    return {
      url: `https://memory.storage.local/download/${encodeURIComponent(key)}?expires=${params.expiresInSeconds}`,
      expiresAt,
      method: 'GET',
    };
  }

  public async objectExists(rawKey: string): Promise<boolean> {
    const key = normalizeAndValidateKey(rawKey);
    return this.items.has(key);
  }

  public async getMetadata(rawKey: string): Promise<ObjectMetadata | null> {
    const key = normalizeAndValidateKey(rawKey);
    const item = this.items.get(key);
    if (!item) return null;

    const result: ObjectMetadata = {
      key,
      sizeBytes: item.data.byteLength,
      contentType: item.contentType,
      lastModified: item.lastModified,
      etag: item.etag,
    };
    if (item.metadata !== undefined) {
      result.metadata = item.metadata;
    }

    return result;
  }

  public clear(): void {
    this.items.clear();
  }
}
