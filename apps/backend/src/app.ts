import Fastify, { type FastifyServerOptions } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { ZodError } from 'zod';
import { prisma } from '@infra/database';
import { env } from './config/env.js';
import { mapRoutes } from './modules/maps/maps.routes.js';
import { deviceRoutes } from './modules/devices/devices.routes.js';
import { supportRoutes } from './modules/support/support.routes.js';
import { inventoryRoutes } from './modules/inventory/inventory.routes.js';
import { monitoringRoutes } from './modules/monitoring/monitoring.routes.js';
import { credentialsRoutes } from './modules/credentials/credentials.routes.js';

export async function buildApp(options: FastifyServerOptions = {}) {
  const app = Fastify({
    logger: {
      level: 'info',
      redact: [
        'req.headers.x-support-token',
        'req.headers.authorization',
        'req.body.credentials',
        'req.body.accessPassword',
        'req.body.username',
        'req.body.password',
        'req.body.secret',
      ],
    },
    bodyLimit: 1_000_000,
    ...options,
  });
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: [env.CORS_ORIGIN],
    credentials: false,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' });
  await app.register(swagger, { openapi: { info: { title: 'Infra Map API', version: '0.2.0' } } });
  await app.register(swaggerUi, { routePrefix: '/api/docs' });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError)
      return reply.code(400).send({ error: 'Dados inválidos', issues: error.issues });
    if (typeof error === 'object' && error !== null && 'code' in error) {
      if (error.code === 'P2002')
        return reply.code(409).send({ error: 'Já existe um cadastro com este identificador.' });
      if (error.code === 'P2025')
        return reply.code(404).send({ error: 'Registro não encontrado.' });
      if (error.code === 'P2003')
        return reply
          .code(400)
          .send({ error: 'Referência a um registro inexistente ou ainda em uso.' });
    }
    const code =
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number'
        ? error.statusCode
        : 500;
    if (code >= 500) request.log.error(error);
    return reply.code(code).send({
      error:
        code >= 500 && !(error instanceof Error && error.name === 'AppError')
          ? 'Erro interno'
          : error instanceof Error
            ? error.message
            : 'Erro inesperado',
    });
  });

  app.get('/health', async () => ({ ok: true, service: 'api' }));
  app.get('/health/ready', async (_req, reply) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return { ok: true, database: 'ready' };
    } catch {
      return reply.code(503).send({ ok: false, database: 'unavailable' });
    }
  });
  await app.register(mapRoutes, { prefix: '/api/v1/maps' });
  await app.register(deviceRoutes, { prefix: '/api/v1/devices' });
  await app.register(supportRoutes, { prefix: '/api/v1/support' });
  await app.register(inventoryRoutes, { prefix: '/api/v1/inventory' });
  await app.register(monitoringRoutes, { prefix: '/api/v1/monitoring' });
  await app.register(credentialsRoutes, { prefix: '/api/v1/credentials' });
  app.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
  return app;
}
