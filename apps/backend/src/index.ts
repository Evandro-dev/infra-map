import { prisma } from '@infra/database';
import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = await buildApp();
try {
  await prisma.$connect();
  await app.listen({ host: '127.0.0.1', port: env.API_PORT });
  const stop = () => {
    void app.close().catch((error) => {
      app.log.error(error);
      process.exitCode = 1;
    });
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
} catch (error) {
  app.log.error(error);
  await app.close();
  process.exitCode = 1;
}
