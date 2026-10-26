import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { islLinkSchema, printerConfigSchema, supportExecutionSchema } from '@infra/contracts';
import { requireSupportOperator } from './support.auth.js';
import { supportService } from './support.service.js';
import { printerImportService } from '../inventory/printer-import.service.js';

const deviceParams = z.object({ deviceId: z.string().min(1).max(100) });
const jobParams = z.object({ jobId: z.string().min(1).max(100) });

/** Apenas HTTP e validação de contratos; regras e persistência ficam nas respectivas camadas. */
export async function supportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireSupportOperator);
  app.get('/settings', async () => supportService.settings());
  app.post('/printers/import/preview', async (req) => printerImportService.import(req.body));
  app.post('/printers/import', async (req) => {
    const { source } = z
      .object({ confirm: z.literal(true), source: z.unknown() })
      .strict()
      .parse(req.body);
    return printerImportService.import(source, true);
  });
  app.get('/computers', async (req) => {
    const { search } = z.object({ search: z.string().max(120).default('') }).parse(req.query);
    return { computers: await supportService.computers(search) };
  });
  app.get('/devices/:deviceId', async (req) =>
    supportService.details(deviceParams.parse(req.params).deviceId),
  );
  app.put('/devices/:deviceId/isl-link', async (req) =>
    supportService.link(deviceParams.parse(req.params).deviceId, islLinkSchema.parse(req.body)),
  );
  app.delete('/devices/:deviceId/isl-link', async (req) =>
    supportService.unlink(deviceParams.parse(req.params).deviceId),
  );
  app.get('/devices/:deviceId/presence', async (req) =>
    supportService.presence(deviceParams.parse(req.params).deviceId),
  );
  app.patch('/devices/:deviceId/print-config', async (req) =>
    supportService.configurePrinter(
      deviceParams.parse(req.params).deviceId,
      printerConfigSchema.parse(req.body),
    ),
  );
  app.post('/devices/:deviceId/printers', async (req, reply) => {
    const { deviceId } = deviceParams.parse(req.params);
    const { printerId } = z
      .object({ printerId: z.string().min(1) })
      .strict()
      .parse(req.body);
    return reply.code(201).send(await supportService.assign(deviceId, printerId));
  });
  app.delete('/devices/:deviceId/printers/:printerId', async (req, reply) => {
    const { deviceId, printerId } = deviceParams
      .extend({ printerId: z.string().min(1) })
      .parse(req.params);
    await supportService.unassign(deviceId, printerId);
    return reply.code(204).send();
  });
  app.post('/devices/:deviceId/open-isl', async (req, reply) =>
    reply.code(202).send(await supportService.open(deviceParams.parse(req.params).deviceId)),
  );
  app.post('/devices/:deviceId/actions', async (req, reply) =>
    reply
      .code(202)
      .send(
        await supportService.execute(
          deviceParams.parse(req.params).deviceId,
          supportExecutionSchema.parse(req.body),
        ),
      ),
  );
  app.get('/jobs/:jobId', async (req) => supportService.job(jobParams.parse(req.params).jobId));
  app.post('/jobs/:jobId/review', async (req) => {
    z.object({ confirm: z.literal(true) })
      .strict()
      .parse(req.body);
    return supportService.review(jobParams.parse(req.params).jobId);
  });
  app.get('/jobs/:jobId/result', async (req) =>
    supportService.result(jobParams.parse(req.params).jobId),
  );
}
