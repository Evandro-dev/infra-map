import '@infra/config';
import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.string().min(10),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGIN: z.url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  ISL_MODE: z.enum(['disabled', 'hosted', 'self-hosted']).default('disabled'),
  ISL_SERVER_URL: z.string().default(''),
  ISL_API_USERNAME: z.string().default(''),
  ISL_API_PASSWORD: z.string().default(''),
  ISL_REMOTE_EXEC_ENABLED: z.enum(['true', 'false']).default('false'),
  ISL_LIGHT_EXE: z.string().default(''),
  SUPPORT_OPERATOR_TOKEN: z.string().default(''),
});
export const env = schema.parse(process.env);
