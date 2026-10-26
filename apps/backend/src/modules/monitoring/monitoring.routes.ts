import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { monitorConfigSchema } from '@infra/contracts';
import { requireSupportOperator } from '../support/support.auth.js';
import { monitoringService } from './monitoring.service.js';

const deviceParams = z.object({ deviceId: z.string().min(1).max(100) });
export async function monitoringRoutes(app: FastifyInstance) {
  app.get('/maps/:mapId', async (req) => {
    const { mapId } = z.object({ mapId: z.string().min(1).max(100) }).parse(req.params);
    const { page } = z
      .object({ page: z.coerce.number().int().min(1).max(10000).default(1) })
      .parse(req.query);
    return monitoringService.map(mapId, page);
  });
  await app.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', requireSupportOperator);
    protectedRoutes.get('/devices/:deviceId', async (req) =>
      monitoringService.detail(deviceParams.parse(req.params).deviceId),
    );
    protectedRoutes.put('/devices/:deviceId', async (req) =>
      monitoringService.configure(
        deviceParams.parse(req.params).deviceId,
        monitorConfigSchema.parse(req.body),
      ),
    );
    protectedRoutes.post(
      '/devices/:deviceId/run',
      { config: { rateLimit: { max: 4, timeWindow: '1 minute' } } },
      async (req) => monitoringService.run(deviceParams.parse(req.params).deviceId),
    );
    protectedRoutes.post(
      '/run-due',
      { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
      async () => monitoringService.runDue(),
    );
  });
}
