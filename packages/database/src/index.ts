import '@infra/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client.ts';
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL ausente. Confira apps/backend/.env');
export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
export type { PrismaClient } from './generated/prisma/client.ts';
export { Prisma } from './generated/prisma/client.ts';
