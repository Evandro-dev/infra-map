import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  deviceKindSchema,
  catalogSearchSchema,
  printDiscoveryRequestSchema,
} from '@infra/contracts';
import { printCatalogService } from './print-catalog.service.js';
import { requireSupportOperator } from '../support/support.auth.js';
import { credentialsService } from '../credentials/credentials.service.js';

export async function inventoryRoutes(app: FastifyInstance) {
  app.get('/catalog', async (req) => {
    const query = z
      .object({ kind: deviceKindSchema.optional(), server: z.string().trim().max(180).default('') })
      .parse(req.query);
    return printCatalogService.summary(query.server);
  });
  app.get('/options', async (req) =>
    printCatalogService.options(catalogSearchSchema.parse(req.query)),
  );
  app.get('/print-discovery/capabilities', { preHandler: requireSupportOperator }, async () =>
    printCatalogService.capabilities(),
  );
  app.post(
    '/print-discovery',
    {
      preHandler: requireSupportOperator,
      config: { rateLimit: { max: 6, timeWindow: '1 minute' } },
    },
    async (req) => {
      const { server, credentials, credentialId } = printDiscoveryRequestSchema.parse(req.body);
      const account = credentialId
        ? await credentialsService.resolveWindowsPrintServer(credentialId, server)
        : credentials;
      const snapshot = await printCatalogService.discover(server, account);
      return {
        server: snapshot.server,
        source: snapshot.source,
        collectedAt: snapshot.collectedAt,
        queueCount: snapshot.queues.length,
        driverCount: snapshot.drivers.length,
        portCount: snapshot.ports.length,
        warnings: snapshot.warnings,
      };
    },
  );
}
