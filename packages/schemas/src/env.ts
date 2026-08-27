import { z } from 'zod';

export const CloudflareEnvSchema = z.object({
  APP_ENV: z.enum(['development', 'staging', 'production', 'test']).default('development'),
  SERVICE_NAME: z.string().min(1).default('nutriai-api'),
  APP_VERSION: z.string().min(1).default('1.0.0'),
  ALLOWED_ORIGINS: z.string().optional(),
  B2_ENDPOINT: z.string().url().optional(),
  B2_REGION: z.string().min(1).optional(),
  B2_BUCKET_NAME: z.string().min(1).optional(),
  B2_KEY_ID: z.string().min(1).optional(),
  B2_APPLICATION_KEY: z.string().min(1).optional(),
});

export const PublicClientEnvSchema = z.object({
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8787'),
  VITE_DEFAULT_LOCALE: z.enum(['fa', 'en']).default('fa'),
});

export type ValidatedCloudflareEnv = z.infer<typeof CloudflareEnvSchema>;
export type ValidatedPublicClientEnv = z.infer<typeof PublicClientEnvSchema>;
