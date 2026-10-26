import { prisma } from '@infra/database';
import type { z } from 'zod';
import type { printerConfigSchema, SupportAction } from '@infra/contracts';
import { AppError } from '../../shared/errors.js';

export const supportRepository = {
  byId: (id: string) => prisma.device.findUnique({ where: { id } }),
  details: (id: string) =>
    prisma.device.findUnique({
      where: { id },
      include: {
        assignedPrinters: { include: { printer: true } },
        assignedComputers: { include: { computer: true } },
        supportJobs: { orderBy: { createdAt: 'desc' }, take: 25 },
      },
    }),
  link: (id: string, computer: { id: string; name: string } | null) =>
    prisma.device.update({
      where: { id },
      data: { islComputerId: computer?.id ?? null, islComputerName: computer?.name ?? null },
    }),
  configurePrinter: (id: string, data: z.infer<typeof printerConfigSchema>) =>
    prisma.device.update({ where: { id }, data }),
  assignPrinter: (computerId: string, printerId: string) =>
    prisma.printerAssignment.upsert({
      where: { computerId_printerId: { computerId, printerId } },
      create: { computerId, printerId },
      update: {},
    }),
  unassignPrinter: (computerId: string, printerId: string) =>
    prisma.printerAssignment.deleteMany({ where: { computerId, printerId } }),
  async startJob(deviceId: string, action: SupportAction) {
    return prisma.$transaction(async (tx) => {
      // Serializa solicitações deste computador inclusive entre processos da API.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${deviceId}, 0))::text`;
      const pending = await tx.supportJob.findFirst({
        where: {
          deviceId,
          status: { in: ['STARTING', 'SUBMITTED', 'REVIEW_REQUIRED'] },
        },
      });
      if (pending)
        throw new AppError(
          409,
          'Já existe uma operação pendente neste computador. Consulte o histórico antes de continuar.',
        );
      return tx.supportJob.create({ data: { deviceId, action, status: 'STARTING' } });
    });
  },
  job: (id: string) => prisma.supportJob.findUnique({ where: { id } }),
  updateJob: (
    id: string,
    data: { providerActionId?: string; status?: string; resultSummary?: string },
  ) => prisma.supportJob.update({ where: { id }, data }),
};
