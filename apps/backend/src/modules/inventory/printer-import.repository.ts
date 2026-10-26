import { prisma } from '@infra/database';
import { AppError } from '../../shared/errors.js';
import type { preparePrinterImport } from './printer-import.model.js';
import type { PrinterImportResult } from '@infra/contracts';

export const printerImportRepository = {
  async import(
    printers: ReturnType<typeof preparePrinterImport>,
    apply: boolean,
  ): Promise<PrinterImportResult> {
    return prisma.$transaction(async (tx) => {
      // Uma importação de cada vez; cadastro existente sempre vence sobre o arquivo.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended('infra-map:printer-import', 0))::text`;
      const result: PrinterImportResult = { applied: apply, created: 0, skipped: 0, printers: [] };
      for (const printer of printers) {
        const matches = await tx.device.findMany({
          where: {
            OR: [
              {
                printServer: { equals: printer.printServer, mode: 'insensitive' },
                printShare: { equals: printer.printShare, mode: 'insensitive' },
              },
              { name: { equals: printer.name, mode: 'insensitive' } },
              { ipAddress: printer.ipAddress },
            ],
          },
        });
        const exact = matches.find(
          (item) =>
            item.kind === 'PRINTER' &&
            item.printServer?.toLowerCase() === printer.printServer.toLowerCase() &&
            item.printShare?.toLowerCase() === printer.printShare.toLowerCase(),
        );
        if (!exact && matches.length)
          throw new AppError(
            409,
            `Conflito de nome ou IP em ${printer.name}. Confira o inventário antes de importar.`,
          );
        const outcome = exact ? 'SKIP' : 'CREATE';
        result.printers.push({
          name: printer.name,
          share: `\\\\${printer.printServer}\\${printer.printShare}`,
          outcome,
        });
        if (exact) result.skipped++;
        else {
          if (apply) await tx.device.create({ data: printer });
          result.created++;
        }
      }
      return result;
    });
  },
};
