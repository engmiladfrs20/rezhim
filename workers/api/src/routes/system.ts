import { Hono } from 'hono';
import type { CloudflareEnv, ApiResponse, ApiErrorResponse } from '@nutriai/types';
import { ReadinessService } from '../services/readiness.service';

type AppEnv = { Bindings: CloudflareEnv; Variables: { requestId: string } };
const systemRouter = new Hono<AppEnv>();

systemRouter.get('/', async (c) => {
  const service = new ReadinessService(c.env);
  const metadata = await service.getSystemMetadata();

  if (!metadata) {
    const requestId = c.get('requestId') as string;
    const errorResponse: ApiErrorResponse = {
      success: false,
      requestId,
      error: {
        code: 'METADATA_NOT_FOUND',
        message: 'System schema metadata is currently unavailable.',
      },
    };
    return c.json(errorResponse, 503);
  }

  const response: ApiResponse<{
    service: string;
    version: string;
    environment: string;
    schema_version: string;
    last_migration: string;
  }> = {
    success: true,
    requestId: c.get('requestId') as string,
    data: {
      service: c.env.SERVICE_NAME || 'nutriai-api',
      version: c.env.APP_VERSION || '1.0.0',
      environment: c.env.APP_ENV || 'development',
      schema_version: metadata.value,
      last_migration: metadata.updated_at,
    },
  };

  return c.json(response, 200);
});

export { systemRouter };
