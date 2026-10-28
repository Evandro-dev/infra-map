import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  createWindowsPrintCredentialSchema,
  updateManagedCredentialSchema,
} from '@infra/contracts';
import { requireSupportOperator } from '../support/support.auth.js';
import { credentialsService } from './credentials.service.js';

const params = z.object({ id: z.string().min(1).max(100) });

export async function credentialsRoutes(app: FastifyInstance) {
  app.addHook('preHandler', requireSupportOperator);
  app.get('/', async () => ({ credentials: await credentialsService.list() }));
  app.post('/', async (req, reply) => {
    const input = createWindowsPrintCredentialSchema.parse(req.body);
    return reply.code(201).send(await credentialsService.create(input));
  });
  app.patch('/:id', async (req) =>
    credentialsService.update(
      params.parse(req.params).id,
      updateManagedCredentialSchema.parse(req.body),
    ),
  );
  app.delete('/:id', async (req, reply) => {
    await credentialsService.remove(params.parse(req.params).id);
    return reply.code(204).send();
  });
}
