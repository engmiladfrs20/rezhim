import { Hono } from 'hono';
import type { CloudflareEnv } from '@nutriai/types';
import { ReadinessService } from '../services/readiness.service';

const readinessRouter = new Hono<{ Bindings: CloudflareEnv }>();

readinessRouter.get('/', async (c) => {
  const service = new ReadinessService(c.env);
  const result = await service.checkSystemReadiness();

  if (result.status === 'degraded') {
    return c.json(result, 503);
  }
  return c.json(result, 200);
});

export { readinessRouter };
