import '@infra/config';
import { randomBytes } from 'node:crypto';
import { existsSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const rootFile = fileURLToPath(new URL('../.env', import.meta.url));
const backendFile = fileURLToPath(new URL('../apps/backend/.env', import.meta.url));
if (
  existsSync(rootFile) &&
  !existsSync(backendFile) &&
  (!process.env.DB_USER || !process.env.DB_PASSWORD || !process.env.DB_NAME)
) {
  throw new Error(
    'O .env existente precisa de DB_USER, DB_PASSWORD e DB_NAME para gerar a conexão sem divergência.',
  );
}
const user = process.env.DB_USER || 'infra_map';
const password = process.env.DB_PASSWORD || randomBytes(24).toString('hex');
const database = process.env.DB_NAME || 'infra_map';
if (!existsSync(rootFile)) {
  writeFileSync(
    rootFile,
    `DB_USER=${JSON.stringify(user)}\nDB_PASSWORD=${JSON.stringify(password)}\nDB_NAME=${JSON.stringify(database)}\n`,
    { flag: 'wx' },
  );
  console.log('.env criado com credenciais locais.');
} else console.log('.env existente preservado.');
if (!existsSync(backendFile)) {
  const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:55432/${encodeURIComponent(database)}`;
  writeFileSync(
    backendFile,
    `NODE_ENV=development\nDATABASE_URL=${databaseUrl}\nAPI_PORT=4000\nCORS_ORIGIN=http://localhost:3000\nISL_MODE=disabled\nISL_SERVER_URL=\nISL_API_USERNAME=\nISL_API_PASSWORD=\nISL_LIGHT_EXE=\nISL_REMOTE_EXEC_ENABLED=false\nSUPPORT_OPERATOR_TOKEN=${randomBytes(32).toString('hex')}\n`,
    { flag: 'wx' },
  );
  console.log('apps/backend/.env criado; a chave de suporte está somente nesse arquivo.');
} else console.log('apps/backend/.env existente preservado.');
