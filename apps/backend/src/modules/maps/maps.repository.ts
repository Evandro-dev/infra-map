import { randomBytes } from 'node:crypto';
import { prisma } from '@infra/database';
import type { MapElementInput } from '@infra/contracts';
import { AppError } from '../../shared/errors.js';
async function requireMap(id: string) {
  if (!(await prisma.map.findUnique({ where: { id }, select: { id: true } })))
    throw new AppError(404, 'Mapa não encontrado');
}
export const mapsRepository = {
  list: () => prisma.map.findMany({ orderBy: { createdAt: 'desc' }, include: { branch: true } }),
  async page({
    page,
    pageSize,
    search,
    sort,
    recentOnly,
  }: {
    page: number;
    pageSize: number;
    search: string;
    sort: 'updated' | 'created' | 'name';
    recentOnly: boolean;
  }) {
    const where = {
      ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      ...(recentOnly ? { updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } : {}),
    };
    const orderBy =
      sort === 'name'
        ? { name: 'asc' as const }
        : sort === 'created'
          ? { createdAt: 'desc' as const }
          : { updatedAt: 'desc' as const };
    const [total, items] = await prisma.$transaction([
      prisma.map.count({ where }),
      prisma.map.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { branch: true },
      }),
    ]);
    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  },
  async summary() {
    const [workflows, devices, computers, printers, connections] = await Promise.all([
      prisma.map.count(),
      prisma.device.count({ where: { elements: { some: {} } } }),
      prisma.device.count({ where: { kind: 'COMPUTER', elements: { some: {} } } }),
      prisma.device.count({ where: { kind: 'PRINTER', elements: { some: {} } } }),
      prisma.mapConnection.count(),
    ]);
    return { workflows, devices, computers, printers, connections };
  },
  byId: (id: string) =>
    prisma.map.findUnique({
      where: { id },
      include: {
        elements: { orderBy: { orderIndex: 'asc' }, include: { device: true } },
        branch: true,
      },
    }),
  create: async (
    workflow: {
      name: string;
      widthMeters: number;
      heightMeters: number;
      originXMeters: number;
      originYMeters: number;
      hasTerritory: boolean;
      elements: MapElementInput[];
    },
    sortedElements: MapElementInput[],
  ) =>
    prisma.$transaction(async (tx) => {
      let branch = await tx.branch.findFirst();
      if (!branch) branch = await tx.branch.create({ data: { name: 'Filial principal' } });
      const deviceIds = [
        ...new Set(
          sortedElements.flatMap((element) => (element.deviceId ? [element.deviceId] : [])),
        ),
      ];
      if (deviceIds.length) {
        const count = await tx.device.count({ where: { id: { in: deviceIds } } });
        if (count !== deviceIds.length) throw new AppError(400, 'Equipamento não cadastrado');
      }
      const map = await tx.map.create({
        data: {
          id: randomBytes(12).toString('base64url').slice(0, 16),
          branchId: branch.id,
          name: workflow.name,
          widthMeters: workflow.widthMeters,
          heightMeters: workflow.heightMeters,
          originXMeters: workflow.originXMeters,
          originYMeters: workflow.originYMeters,
          hasTerritory: workflow.hasTerritory,
        },
      });
      if (sortedElements.length)
        await tx.mapElement.createMany({
          data: sortedElements.map((element) => ({
            id: element.id,
            mapId: map.id,
            parentId: element.parentId,
            deviceId: element.deviceId,
            kind: element.kind,
            name: element.name,
            iconKey: element.iconKey,
            xMeters: element.xMeters,
            yMeters: element.yMeters,
            widthMeters: element.widthMeters,
            heightMeters: element.heightMeters,
            level: element.level,
            orderIndex: element.orderIndex ?? 0,
            hidden: element.hidden ?? false,
            locked: element.locked ?? false,
          })),
        });
      return map;
    }),
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
      const server = nodes.find((node) => node.device?.kind === 'SERVER')?.device;
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
      const normalizeServer = (value: string) =>
        value.replaceAll(String.fromCharCode(92), '').trim().toLocaleLowerCase('en-US');
      const servesPrinter = Boolean(
        server?.hostname &&
        printer?.printServer &&
        normalizeServer(server.hostname) === normalizeServer(printer.printServer),
      );
      // Ligações não direcionadas: canonicalizar evita duplicatas invertidas.
      const [sourceElementId, targetElementId] = [source, target].sort();
      return {
        created: true,
        connection: await tx.mapConnection.create({
          data: {
            mapId,
            sourceElementId,
            targetElementId,
            kind: assignment ? 'PRINTING' : servesPrinter ? 'SERVES' : 'NETWORK',
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
