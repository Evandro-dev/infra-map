import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';

// API, Prisma CLI e scripts usam a mesma precedência, independentemente do cwd.
// Variáveis fornecidas pelo processo têm prioridade sobre arquivos locais.
config({
  path: [
    fileURLToPath(new URL('../../../apps/backend/.env', import.meta.url)),
    fileURLToPath(new URL('../../../.env', import.meta.url)),
  ],
  quiet: true,
});
