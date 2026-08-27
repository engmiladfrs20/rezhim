import { z } from 'zod';

export const ObjectKeySchema = z
  .string()
  .min(1, 'Object key must not be empty')
  .max(1024, 'Object key must not exceed 1024 characters')
  .regex(/^[a-zA-Z0-9/_.\-@]+$/, 'Object key contains invalid characters')
  .refine((key) => !key.startsWith('/') && !key.includes('..'), {
    message: 'Object key must not be absolute or contain relative path traversal (..)',
  });

export const SignedUploadUrlRequestSchema = z.object({
  key: ObjectKeySchema,
  contentType: z
    .string()
    .min(1)
    .regex(/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/, 'Invalid MIME type'),
  expiresInSeconds: z
    .number()
    .int()
    .min(60, 'Expiration must be at least 60 seconds')
    .max(86400, 'Expiration must not exceed 24 hours (86400 seconds)')
    .default(900),
  acl: z.enum(['private', 'public-read']).default('private'),
});

export const SignedDownloadUrlRequestSchema = z.object({
  key: ObjectKeySchema,
  expiresInSeconds: z
    .number()
    .int()
    .min(60, 'Expiration must be at least 60 seconds')
    .max(86400, 'Expiration must not exceed 24 hours (86400 seconds)')
    .default(900),
});

export const BackblazeB2ConfigSchema = z.object({
  endpoint: z.string().url('Backblaze B2 endpoint must be a valid URL'),
  region: z.string().min(1, 'Region is required'),
  bucketName: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9]([a-z0-9.-]*[a-z0-9])?$/, 'Invalid S3/B2 bucket name format'),
  keyId: z.string().min(1, 'B2 Key ID is required'),
  applicationKey: z.string().min(1, 'B2 Application Key is required'),
});

export type ValidatedSignedUploadUrlRequest = z.infer<typeof SignedUploadUrlRequestSchema>;
export type ValidatedSignedDownloadUrlRequest = z.infer<typeof SignedDownloadUrlRequestSchema>;
export type ValidatedBackblazeB2Config = z.infer<typeof BackblazeB2ConfigSchema>;
