import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { mapElementSchema } from '@infra/contracts';
import { deleteMapWithContents, saveLayout, mapsService } from './maps.service.js';

const params = z.object({ id: z.string().min(1).max(100) });
const territoryClear = z
  .object({
    name: z.string().trim().min(1).max(140),
    widthMeters: z.number().finite().gt(0).max(100000),
    heightMeters: z.number().finite().gt(0).max(100000),
  })
  .strict();
const listQuery = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  search: z.string().trim().max(140).default(''),
  sort: z.enum(['updated', 'created', 'name']).default('updated'),
  recentOnly: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
});
const newMap = z
  .object({
    name: z.string().trim().min(1).max(140),
    widthMeters: z.number().finite().gt(0).max(100000),
    heightMeters: z.number().finite().gt(0).max(100000),
    originXMeters: z.number().finite().default(0),
    originYMeters: z.number().finite().default(0),
    hasTerritory: z.boolean().default(true),
    elements: z.array(mapElementSchema).max(3000).default([]),
  })
  .strict();
const newConnection = z
  .object({
    sourceElementId: z.string().min(1).max(80),
    targetElementId: z.string().min(1).max(80),
  })
  .strict();

export async function mapRoutes(app: FastifyInstance) {
  app.get('/summary', async () => mapsService.summary());
  app.get('/paged', async (req) => mapsService.page(listQuery.parse(req.query)));
  app.get('/', async () => mapsService.list());
  app.post('/', async (req, reply) => {
    const body = newMap.parse(req.body);
    return reply.code(201).send(await mapsService.create(body));
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
  app.delete('/:id/territory', async (req, reply) => {
    await mapsService.deleteTerritory(params.parse(req.params).id, territoryClear.parse(req.body));
    return reply.code(204).send();
  });
  app.get('/:id', async (req) => mapsService.byId(params.parse(req.params).id));
  app.delete('/:id', async (req, reply) => {
    await deleteMapWithContents(params.parse(req.params).id);
    return reply.code(204).send();
  });
  app.put('/:id/layout', async (req) => saveLayout(params.parse(req.params).id, req.body));
}
