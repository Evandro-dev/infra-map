import '@infra/config';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { prisma } from '@infra/database';
import { printerImportService } from '../apps/backend/src/modules/inventory/printer-import.service.js';

const args = process.argv.slice(2);
if (args.some((arg) => arg.startsWith('--') && arg !== '--apply'))
  throw new Error('Opção desconhecida. Use npm run inventory:import -- [arquivo.json] [--apply]');
const path =
  args.find((arg) => arg !== '--apply') ??
  fileURLToPath(new URL('../docs/references/cadastro_impressoras_economart.json', import.meta.url));
try {
  const source: unknown = JSON.parse(await readFile(path, 'utf8'));
  const result = await printerImportService.import(source, args.includes('--apply'));
  console.log(
    result.applied
      ? 'Importação concluída.'
      : 'Prévia; nenhum registro foi gravado. Use --apply para importar.',
  );
  console.table(result.printers);
  console.log(`${result.created} a criar/criadas; ${result.skipped} já cadastradas e preservadas.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha na importação.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
