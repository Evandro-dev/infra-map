import type { FastifyInstance } from 'fastify';
import { cloneDevicesSchema, newDeviceSchema, updateDeviceSchema } from '@infra/contracts';
import { devicesService } from './devices.service.js';
import { z } from 'zod';

export async function deviceRoutes(app: FastifyInstance) {
  app.get('/', async () => devicesService.list());
  app.post('/clone', async (req, reply) => {
    const { ids } = cloneDevicesSchema.parse(req.body);
    const clones = await devicesService.cloneMany(ids);
    if (!clones) return reply.code(404).send({ error: 'Um ou mais dispositivos não existem.' });
    return reply.code(201).send(clones);
  });
  app.post('/', async (req, reply) => {
    const body = newDeviceSchema.parse(req.body);
    return reply.code(201).send(await devicesService.create(body));
  });
  app.patch('/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string().min(1) }).parse(req.params);
    const body = updateDeviceSchema.parse(req.body);
    if (!Object.keys(body).length)
      return reply.code(400).send({ error: 'Nenhuma alteração enviada.' });
    const device = await devicesService.update(id, body);
    return device ?? reply.code(404).send({ error: 'Dispositivo não encontrado.' });
  });
}
