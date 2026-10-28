import '@infra/config';
import { fileURLToPath } from 'node:url';
import { setupEnvironment } from './setup-env-core.mjs';

setupEnvironment({
  rootFile: fileURLToPath(new URL('../.env', import.meta.url)),
  backendFile: fileURLToPath(new URL('../apps/backend/.env', import.meta.url)),
});
