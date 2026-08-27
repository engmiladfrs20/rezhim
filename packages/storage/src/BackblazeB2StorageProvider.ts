import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  type ObjectCannedACL,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type {
  StorageProvider,
  BackblazeB2Config,
  PutObjectParams,
  PutObjectResult,
  GetObjectResult,
  SignedUploadUrlParams,
  SignedDownloadUrlParams,
  SignedUrlResult,
  ObjectMetadata,
} from '@nutriai/types';
import { BackblazeB2ConfigSchema } from '@nutriai/schemas';
import { normalizeAndValidateKey, convertBodyToUint8Array } from './utils';
import { StorageConfigError, ObjectNotFoundError, StorageError } from './errors';

function isNotFoundError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    name?: string;
    Code?: string;
    code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === 'NotFound' ||
    e.name === 'NoSuchKey' ||
    e.Code === 'NoSuchKey' ||
    e.Code === 'NotFound' ||
    e.code === 'NoSuchKey' ||
    e.code === 'NotFound' ||
    e.$metadata?.httpStatusCode === 404
  );
}

function sanitizeStorageError(
  err: unknown,
  defaultMessage: string,
  defaultCode: string,
): StorageError {
  if (err instanceof StorageError) return err;
  const msg = err instanceof Error ? err.message : 'Unknown B2 storage error';
  const statusCode =
    err && typeof err === 'object' && '$metadata' in err
      ? ((err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode ?? 500)
      : 500;
  return new StorageError(`${defaultMessage}: ${msg}`, defaultCode, statusCode);
}

function validateExpirationSeconds(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < 1 || seconds > 604800) {
    throw new StorageConfigError(
      `Invalid signed URL expiration: '${seconds}' seconds. Expiration must be an integer between 1 and 604800 (7 days).`,
    );
  }
}

export class BackblazeB2StorageProvider implements StorageProvider {
  public readonly providerName = 'backblaze-b2';
  private client: S3Client;
  private bucketName: string;

  constructor(config: BackblazeB2Config, customS3Client?: S3Client) {
    const parseResult = BackblazeB2ConfigSchema.safeParse(config);
    if (!parseResult.success) {
      const errorObj = parseResult.error as unknown as {
        issues?: { path?: (string | number)[]; message: string }[];
        errors?: { path?: (string | number)[]; message: string }[];
        message: string;
      };
      const issues = errorObj.issues ?? errorObj.errors ?? [];
      const msg =
        issues.map((e) => `${e.path?.join('.') ?? ''}: ${e.message}`).join(', ') ||
        errorObj.message;
      throw new StorageConfigError(`Invalid Backblaze B2 configuration: ${msg}`);
    }

    const validated = parseResult.data;
    this.bucketName = validated.bucketName;

    if (customS3Client) {
      this.client = customS3Client;
    } else {
      this.client = new S3Client({
        endpoint: validated.endpoint,
        region: validated.region,
        credentials: {
          accessKeyId: validated.keyId,
          secretAccessKey: validated.applicationKey,
        },
        forcePathStyle: true,
      });
    }
  }

  public async putObject(params: PutObjectParams): Promise<PutObjectResult> {
    const key = normalizeAndValidateKey(params.key);
    const bodyBytes = await convertBodyToUint8Array(params.data);

    const acl: ObjectCannedACL | undefined =
      params.acl === 'public-read' ? 'public-read' : undefined;

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: bodyBytes,
        ContentType: params.contentType,
        ACL: acl,
        Metadata: params.metadata,
      });

      const response = await this.client.send(command);

      const result: PutObjectResult = { key };
      if (response.ETag !== undefined) {
        result.etag = response.ETag;
      }
      if (response.VersionId !== undefined) {
        result.versionId = response.VersionId;
      }

      return result;
    } catch (err: unknown) {
      throw sanitizeStorageError(err, `Failed to put object '${key}'`, 'B2_PUT_ERROR');
    }
  }

  public async getObject(rawKey: string): Promise<GetObjectResult> {
    const key = normalizeAndValidateKey(rawKey);

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      if (!response.Body) {
        throw new ObjectNotFoundError(key);
      }

      // transformToByteArray works across both Node.js and Cloudflare Worker runtimes
      const dataBytes = await response.Body.transformToByteArray();

      const result: GetObjectResult = {
        data: dataBytes,
      };
      if (response.ContentType !== undefined) {
        result.contentType = response.ContentType;
      }
      if (response.ContentLength !== undefined) {
        result.contentLength = response.ContentLength;
      }
      if (response.Metadata !== undefined) {
        result.metadata = response.Metadata;
      }
      if (response.ETag !== undefined) {
        result.etag = response.ETag;
      }

      return result;
    } catch (err: unknown) {
      if (err instanceof ObjectNotFoundError) throw err;
      if (isNotFoundError(err)) {
        throw new ObjectNotFoundError(key);
      }
      throw sanitizeStorageError(err, `Failed to get object '${key}'`, 'B2_GET_ERROR');
    }
  }

  public async deleteObject(rawKey: string): Promise<boolean> {
    const key = normalizeAndValidateKey(rawKey);

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (err: unknown) {
      throw sanitizeStorageError(err, `Failed to delete object '${key}'`, 'B2_DELETE_ERROR');
    }
  }

  public async getSignedUploadUrl(params: SignedUploadUrlParams): Promise<SignedUrlResult> {
    const key = normalizeAndValidateKey(params.key);
    validateExpirationSeconds(params.expiresInSeconds);

    const acl: ObjectCannedACL | undefined =
      params.acl === 'public-read' ? 'public-read' : undefined;

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      ContentType: params.contentType,
      ACL: acl,
    });

    try {
      const url = await getSignedUrl(this.client, command, {
        expiresIn: params.expiresInSeconds,
      });

      const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();

      return {
        url,
        expiresAt,
        method: 'PUT',
      };
    } catch (err: unknown) {
      throw sanitizeStorageError(err, 'Failed to generate signed upload URL', 'B2_SIGN_ERROR');
    }
  }

  public async getSignedDownloadUrl(params: SignedDownloadUrlParams): Promise<SignedUrlResult> {
    const key = normalizeAndValidateKey(params.key);
    validateExpirationSeconds(params.expiresInSeconds);

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const url = await getSignedUrl(this.client, command, {
        expiresIn: params.expiresInSeconds,
      });

      const expiresAt = new Date(Date.now() + params.expiresInSeconds * 1000).toISOString();

      return {
        url,
        expiresAt,
        method: 'GET',
      };
    } catch (err: unknown) {
      throw sanitizeStorageError(err, 'Failed to generate signed download URL', 'B2_SIGN_ERROR');
    }
  }

  public async objectExists(rawKey: string): Promise<boolean> {
    const key = normalizeAndValidateKey(rawKey);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        return false;
      }
      throw sanitizeStorageError(err, `Failed to check existence for '${key}'`, 'B2_EXISTS_ERROR');
    }
  }

  public async getMetadata(rawKey: string): Promise<ObjectMetadata | null> {
    const key = normalizeAndValidateKey(rawKey);

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.client.send(command);

      const result: ObjectMetadata = {
        key,
        sizeBytes: response.ContentLength ?? 0,
      };
      if (response.ContentType !== undefined) {
        result.contentType = response.ContentType;
      }
      if (response.LastModified !== undefined) {
        result.lastModified = response.LastModified;
      }
      if (response.ETag !== undefined) {
        result.etag = response.ETag;
      }
      if (response.Metadata !== undefined) {
        result.metadata = response.Metadata;
      }

      return result;
    } catch (err: unknown) {
      if (isNotFoundError(err)) {
        return null;
      }
      throw sanitizeStorageError(err, `Failed to get metadata for '${key}'`, 'B2_HEAD_ERROR');
    }
  }
}
