import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const run = (cmd, args, cwd = root) =>
  execFileSync(cmd, args, { cwd, stdio: 'inherit', windowsHide: true });
const npmCli =
  process.env.npm_execpath ??
  path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
if (!existsSync(npmCli))
  throw new Error('CLI do npm não encontrada. Execute a preparação através de npm run dev.');
if (!existsSync(path.join(root, 'node_modules')))
  throw new Error('Dependências ausentes: execute npm install na raiz.');
if (!existsSync(path.join(root, '.env')) || !existsSync(path.join(root, 'apps/backend/.env')))
  throw new Error('Configuração local ausente: execute npm run setup.');
console.log('Iniciando PostgreSQL local via Docker...');
run('docker', ['compose', 'up', '-d', '--wait']);
console.log('Aplicando migrations e conferindo Prisma Client...');
run(process.execPath, [npmCli, 'run', 'migrate', '--workspace=@infra/database']);
run(process.execPath, [npmCli, 'run', 'generate', '--workspace=@infra/database']);
// Do not recreate example maps after the user deletes their territorial map.
// Optional first-run demo: npm run db:seed
