import { Hono } from 'hono';
import type { HealthCheckResponse } from '@nutriai/types';
import { CloudflareEnvSchema } from '@nutriai/schemas';
import type { AppEnv } from '../types';

const healthRouter = new Hono<AppEnv>();

healthRouter.get('/', async (c) => {
  let serviceName = 'nutriai-api';
  let appVersion = '1.0.0';

  try {
    const parsed = CloudflareEnvSchema.parse(c.env || {});
    serviceName = parsed.SERVICE_NAME;
    appVersion = parsed.APP_VERSION;
  } catch {
    // Graceful degrading fallback for pure liveness probe
  }

  const response: HealthCheckResponse = {
    status: 'ok',
    service: serviceName,
    version: appVersion,
    timestamp: new Date().toISOString(),
  };

  return c.json(response, 200);
});

export { healthRouter };
