import '@infra/config';
import { readFile } from 'node:fs/promises';
import { prisma } from '@infra/database';
import { preparePrintReferences } from '../apps/backend/src/modules/inventory/print-reference.model.js';
import { printCatalogRepository } from '../apps/backend/src/modules/inventory/print-catalog.repository.js';

try {
  const input: unknown = JSON.parse(
    await readFile(
      new URL('../docs/references/cadastro_impressoras_economart.json', import.meta.url),
      'utf8',
    ),
  );
  for (const snapshot of preparePrintReferences(input)) {
    await printCatalogRepository.save(snapshot);
    console.log(
      `Referência documental sincronizada: ${snapshot.server}, ${snapshot.queues.length} filas. Nenhum equipamento ou servidor foi alterado.`,
    );
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha ao sincronizar referência.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
