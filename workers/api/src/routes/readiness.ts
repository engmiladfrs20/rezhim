import { Hono } from 'hono';
import { ReadinessService } from '../services/readiness.service';
import type { AppEnv } from '../types';

const readinessRouter = new Hono<AppEnv>();

readinessRouter.get('/', async (c) => {
  const service = new ReadinessService(c.env);
  const result = await service.checkSystemReadiness();

  if (result.status === 'degraded') {
    return c.json(result, 503);
  }
  return c.json(result, 200);
});

export { readinessRouter };
