import { randomBytes } from 'node:crypto';
import { appendFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs';

function setSecretIfMissing(file, key, value) {
  const contents = readFileSync(file, 'utf8');
  const entry = new RegExp(`^([\\t ]*${key}[\\t ]*=)([^\\r\\n]*)`, 'm');
  const match = contents.match(entry);

  if (match?.[2].trim()) return false;

  if (match) {
    writeFileSync(
      file,
      contents.replace(entry, (_line, prefix) => `${prefix}${value}`),
    );
  } else {
    const separator = contents.length > 0 && !contents.endsWith('\n') ? '\n' : '';
    appendFileSync(file, `${separator}${key}=${value}\n`, { flag: 'a' });
  }
  return true;
}

export function setupEnvironment({
  rootFile,
  backendFile,
  environment = process.env,
  logger = console,
}) {
  if (
    existsSync(rootFile) &&
    !existsSync(backendFile) &&
    (!environment.DB_USER || !environment.DB_PASSWORD || !environment.DB_NAME)
  ) {
    throw new Error(
      'O .env existente precisa de DB_USER, DB_PASSWORD e DB_NAME para gerar a conexão sem divergência.',
    );
  }

  const user = environment.DB_USER || 'infra_map';
  const password = environment.DB_PASSWORD || randomBytes(24).toString('hex');
  const database = environment.DB_NAME || 'infra_map';

  if (!existsSync(rootFile)) {
    writeFileSync(
      rootFile,
      `DB_USER=${JSON.stringify(user)}\nDB_PASSWORD=${JSON.stringify(password)}\nDB_NAME=${JSON.stringify(database)}\n`,
      { flag: 'wx', mode: 0o600 },
    );
    logger.log('.env criado com credenciais locais.');
  } else logger.log('.env existente preservado.');

  if (!existsSync(backendFile)) {
    const databaseUrl = `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@127.0.0.1:55432/${encodeURIComponent(database)}`;
    writeFileSync(
      backendFile,
      `NODE_ENV=development\nDATABASE_URL=${databaseUrl}\nAPI_PORT=4000\nCORS_ORIGIN=http://localhost:3000\nISL_MODE=disabled\nISL_SERVER_URL=\nISL_API_USERNAME=\nISL_API_PASSWORD=\nISL_LIGHT_EXE=\nISL_REMOTE_EXEC_ENABLED=false\n`,
      { flag: 'wx', mode: 0o600 },
    );
    logger.log('apps/backend/.env criado com uma chave de suporte local.');
  } else logger.log('apps/backend/.env existente mantido; chaves ausentes serão adicionadas.');

  if (setSecretIfMissing(backendFile, 'SUPPORT_OPERATOR_TOKEN', randomBytes(32).toString('hex')))
    logger.log('Token de suporte local adicionado ao backend/.env.');
  else logger.log('Token de suporte existente preservado.');

  if (
    setSecretIfMissing(
      backendFile,
      'CREDENTIALS_ENCRYPTION_KEY',
      randomBytes(32).toString('base64'),
    )
  ) {
    logger.log('Chave local do cofre de credenciais adicionada ao backend/.env.');
  } else logger.log('Chave do cofre existente preservada.');

  logger.log(
    'Para acessar o cofre, use SUPPORT_OPERATOR_TOKEN de apps/backend/.env. CREDENTIALS_ENCRYPTION_KEY apenas cifra os dados. Reinicie o backend após alterar o .env.',
  );
}
