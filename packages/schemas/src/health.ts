import { z } from 'zod';

export const HealthCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  service: z.string().min(1),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
});

export const ReadinessCheckResponseSchema = z.object({
  status: z.enum(['ok', 'degraded', 'error']),
  service: z.string().min(1),
  database: z.enum(['connected', 'disconnected']),
  timestamp: z.string().datetime(),
});

export const SystemMetadataSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  value: z.string(),
  updated_at: z.string().datetime(),
});

export type ValidatedHealthCheckResponse = z.infer<typeof HealthCheckResponseSchema>;
export type ValidatedReadinessCheckResponse = z.infer<typeof ReadinessCheckResponseSchema>;
export type ValidatedSystemMetadata = z.infer<typeof SystemMetadataSchema>;
