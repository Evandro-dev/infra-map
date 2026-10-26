import { randomBytes } from 'node:crypto';
import { prisma } from '@infra/database';
import { AppError } from '../../shared/errors.js';
async function requireMap(id: string) {
  if (!(await prisma.map.findUnique({ where: { id }, select: { id: true } })))
    throw new AppError(404, 'Mapa não encontrado');
}
export const mapsRepository = {
  list: () => prisma.map.findMany({ orderBy: { createdAt: 'desc' }, include: { branch: true } }),
  byId: (id: string) =>
    prisma.map.findUnique({
      where: { id },
      include: {
        elements: { orderBy: { orderIndex: 'asc' }, include: { device: true } },
        branch: true,
      },
    }),
  create: async (name: string, widthMeters: number, heightMeters: number) => {
    let branch = await prisma.branch.findFirst();
    if (!branch) branch = await prisma.branch.create({ data: { name: 'Filial principal' } });
    return prisma.map.create({
      data: {
        id: randomBytes(12).toString('base64url').slice(0, 16),
        branchId: branch.id,
        name,
        widthMeters,
        heightMeters,
      },
    });
  },
  async relationships(mapId: string) {
    await requireMap(mapId);
    return prisma.printerAssignment.findMany({
      where: {
        computer: { elements: { some: { mapId } } },
        printer: { elements: { some: { mapId } } },
      },
      select: { computerId: true, printerId: true },
    });
  },
  async connections(mapId: string) {
    await requireMap(mapId);
    return prisma.mapConnection.findMany({ where: { mapId }, orderBy: { createdAt: 'asc' } });
  },
  async connect(mapId: string, source: string, target: string) {
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mapId}, 0))::text`;
      const exists = await tx.map.findUnique({ where: { id: mapId }, select: { id: true } });
      if (!exists) throw new AppError(404, 'Mapa não encontrado');
      const nodes = await tx.mapElement.findMany({
        where: { mapId, kind: 'DEVICE', id: { in: [source, target] } },
        include: { device: true },
      });
      if (nodes.length !== 2)
        throw new AppError(400, 'As duas pontas devem ser dispositivos deste mapa');
      const existing = await tx.mapConnection.findFirst({
        where: {
          mapId,
          OR: [
            { sourceElementId: source, targetElementId: target },
            { sourceElementId: target, targetElementId: source },
          ],
        },
      });
      if (existing) return { created: false, connection: existing };
      const computer = nodes.find((node) => node.device?.kind === 'COMPUTER')?.device;
      const printer = nodes.find((node) => node.device?.kind === 'PRINTER')?.device;
      const assignment =
        computer && printer
          ? await tx.printerAssignment.upsert({
              where: { computerId_printerId: { computerId: computer.id, printerId: printer.id } },
              create: { computerId: computer.id, printerId: printer.id },
              update: {},
            })
          : null;
      if (computer && printer)
        await tx.deviceMonitor.updateMany({
          where: { deviceId: computer.id },
          data: { nextRunAt: new Date() },
        });
      // Ligações não direcionadas: canonicalizar evita duplicatas invertidas.
      const [sourceElementId, targetElementId] = [source, target].sort();
      return {
        created: true,
        connection: await tx.mapConnection.create({
          data: {
            mapId,
            sourceElementId,
            targetElementId,
            kind: assignment ? 'PRINTING' : 'NETWORK',
            printerAssignmentId: assignment?.id ?? null,
          },
        }),
      };
    });
  },
  disconnect: (mapId: string, id: string) =>
    prisma.$transaction(async (tx) => {
      const connection = await tx.mapConnection.findFirst({ where: { id, mapId } });
      if (!connection) return { count: 0 };
      if (connection.kind === 'PRINTING' && connection.printerAssignmentId) {
        const assignment = await tx.printerAssignment.findUnique({
          where: { id: connection.printerAssignmentId },
        });
        await tx.printerAssignment.deleteMany({ where: { id: connection.printerAssignmentId } });
        if (assignment)
          await tx.deviceMonitor.updateMany({
            where: { deviceId: assignment.computerId },
            data: { nextRunAt: new Date() },
          });
        return { count: 1 };
      }
      return tx.mapConnection.deleteMany({ where: { id, mapId } });
    }),
};
