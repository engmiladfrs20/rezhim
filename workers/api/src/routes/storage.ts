import { Hono } from 'hono';
import type { Context } from 'hono';
import { SignedDownloadUrlRequestSchema, SignedUploadUrlRequestSchema } from '@nutriai/schemas';
import type { ApiErrorResponse, ApiResponse, SignedUrlResult } from '@nutriai/types';
import { StorageError } from '@nutriai/storage';
import type { AppEnv } from '../types';
import { authMiddleware } from '../middleware/auth';
import { parseJsonBody } from '../lib/validation';
import { StorageService } from '../services/storage.service';

export const storageRouter = new Hono<AppEnv>();
storageRouter.use('/*', authMiddleware);

function isStorageError(error: unknown): error is StorageError {
  if (error instanceof StorageError) return true;
  if (!error || typeof error !== 'object') return false;
  const candidate = error as { code?: unknown; statusCode?: unknown };
  return typeof candidate.code === 'string' && typeof candidate.statusCode === 'number';
}

function storageFailure(c: Context<AppEnv>, error: unknown): Response {
  if (!isStorageError(error)) throw error;

  const statusCode = [400, 404, 500, 502, 503].includes(error.statusCode) ? error.statusCode : 500;
  const status = statusCode as 400 | 404 | 500 | 502 | 503;
  const message =
    error.code === 'INVALID_STORAGE_KEY'
      ? 'The object key is not valid for this user.'
      : error.code === 'OBJECT_NOT_FOUND'
        ? 'The requested object was not found.'
        : error.code === 'STORAGE_CONFIG_ERROR'
          ? 'Storage service is not configured.'
          : 'Storage operation failed.';
  const response: ApiErrorResponse = {
    success: false,
    error: { code: error.code, message },
    requestId: c.get('requestId') || '00000000-0000-0000-0000-000000000000',
  };
  return c.json(response, status);
}

storageRouter.post('/signed-upload-url', async (c) => {
  const parsed = await parseJsonBody(c, SignedUploadUrlRequestSchema);
  if (!parsed.success) return parsed.response;

  try {
    const service = new StorageService(c.env);
    const result = await service.createUploadUrl(c.get('user').id, parsed.data);
    const response: ApiResponse<SignedUrlResult> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    return storageFailure(c, error);
  }
});

storageRouter.post('/signed-download-url', async (c) => {
  const parsed = await parseJsonBody(c, SignedDownloadUrlRequestSchema);
  if (!parsed.success) return parsed.response;

  try {
    const service = new StorageService(c.env);
    const result = await service.createDownloadUrl(c.get('user').id, parsed.data);
    const response: ApiResponse<SignedUrlResult> = {
      success: true,
      data: result,
      requestId: c.get('requestId'),
    };
    return c.json(response, 200);
  } catch (error) {
    return storageFailure(c, error);
  }
});
