import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { deleteMapWithContents, saveLayout, mapsService } from './maps.service.js';

const params = z.object({ id: z.string().min(1).max(100) });
const newMap = z
  .object({
    name: z.string().trim().min(1).max(140),
    widthMeters: z.number().finite().gt(0).max(100000),
    heightMeters: z.number().finite().gt(0).max(100000),
  })
  .strict();
const newConnection = z
  .object({
    sourceElementId: z.string().min(1).max(80),
    targetElementId: z.string().min(1).max(80),
  })
  .strict();

export async function mapRoutes(app: FastifyInstance) {
  app.get('/', async () => mapsService.list());
  app.post('/', async (req, reply) => {
    const body = newMap.parse(req.body);
    return reply
      .code(201)
      .send(await mapsService.create(body.name, body.widthMeters, body.heightMeters));
  });
  app.get('/:id/relationships', async (req) => ({
    relationships: await mapsService.relationships(params.parse(req.params).id),
  }));
  app.get('/:id/connections', async (req) => ({
    connections: await mapsService.connections(params.parse(req.params).id),
  }));
  app.post('/:id/connections', async (req, reply) => {
    const body = newConnection.parse(req.body);
    const result = await mapsService.connect(
      params.parse(req.params).id,
      body.sourceElementId,
      body.targetElementId,
    );
    return reply.code(result.created ? 201 : 200).send(result.connection);
  });
  app.delete('/:id/connections/:connectionId', async (req, reply) => {
    const { id, connectionId } = params
      .extend({ connectionId: z.string().min(1).max(100) })
      .parse(req.params);
    await mapsService.disconnect(id, connectionId);
    return reply.code(204).send();
  });
  app.get('/:id', async (req) => mapsService.byId(params.parse(req.params).id));
  app.delete('/:id', async (req, reply) => {
    await deleteMapWithContents(params.parse(req.params).id);
    return reply.code(204).send();
  });
  app.put('/:id/layout', async (req) => saveLayout(params.parse(req.params).id, req.body));
}
