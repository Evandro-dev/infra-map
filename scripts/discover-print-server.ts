import '@infra/config';
import { prisma } from '@infra/database';
import { printServerSchema } from '@infra/contracts';
import { printCatalogService } from '../apps/backend/src/modules/inventory/print-catalog.service.js';

try {
  const server = printServerSchema.parse(process.argv[2]);
  const result = await printCatalogService.discover(server);
  console.log(
    `Coleta concluída em ${result.server}: ${result.queues.length} filas, ${result.drivers.length} drivers, ${result.ports.length} portas. Nenhuma configuração do servidor foi alterada.`,
  );
  for (const warning of result.warnings) console.log(warning);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha na consulta.');
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
