export type StorageAcl = 'private' | 'public-read';

export interface PutObjectParams {
  key: string;
  data: Uint8Array | ArrayBuffer | Blob | ReadableStream;
  contentType: string;
  acl?: StorageAcl | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface PutObjectResult {
  key: string;
  etag?: string | undefined;
  versionId?: string | undefined;
}

export interface GetObjectResult {
  data: Uint8Array | ReadableStream;
  contentType?: string | undefined;
  contentLength?: number | undefined;
  metadata?: Record<string, string> | undefined;
  etag?: string | undefined;
}

export interface SignedUploadUrlParams {
  key: string;
  contentType: string;
  expiresInSeconds: number;
  acl?: StorageAcl | undefined;
}

export interface SignedDownloadUrlParams {
  key: string;
  expiresInSeconds: number;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: string;
  method: 'PUT' | 'GET';
}

export interface ObjectMetadata {
  key: string;
  sizeBytes: number;
  contentType?: string | undefined;
  lastModified?: Date | undefined;
  etag?: string | undefined;
  metadata?: Record<string, string> | undefined;
}

export interface StorageProvider {
  readonly providerName: string;
  putObject(params: PutObjectParams): Promise<PutObjectResult>;
  getObject(key: string): Promise<GetObjectResult>;
  deleteObject(key: string): Promise<boolean>;
  getSignedUploadUrl(params: SignedUploadUrlParams): Promise<SignedUrlResult>;
  getSignedDownloadUrl(params: SignedDownloadUrlParams): Promise<SignedUrlResult>;
  objectExists(key: string): Promise<boolean>;
  getMetadata(key: string): Promise<ObjectMetadata | null>;
}

export interface BackblazeB2Config {
  endpoint: string;
  region: string;
  bucketName: string;
  keyId: string;
  applicationKey: string;
}
