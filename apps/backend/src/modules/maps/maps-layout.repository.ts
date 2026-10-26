import { prisma } from '@infra/database';
import type { z } from 'zod';
import type { layoutSchema, MapElementInput } from '@infra/contracts';
import { LayoutValidationError } from '../../domain/layout-tree.js';

/** Changes only modified rows. Never drop and recreate the entire map on save. */
export async function persistLayout(
  mapId: string,
  layout: z.infer<typeof layoutSchema>,
  sorted: MapElementInput[],
) {
  const deviceIds = [...new Set(sorted.flatMap((el) => (el.deviceId ? [el.deviceId] : [])))];
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mapId}, 0))::text`;
    const found = await tx.map.findUnique({ where: { id: mapId }, select: { id: true } });
    if (!found) throw Object.assign(new Error('Mapa não encontrado'), { statusCode: 404 });
    if (deviceIds.length) {
      const count = await tx.device.count({ where: { id: { in: deviceIds } } });
      if (count !== deviceIds.length) throw new LayoutValidationError('Equipamento não cadastrado');
    }
    const current = await tx.mapElement.findMany({ where: { mapId } });
    const before = new Map(current.map((el) => [el.id, el]));
    const desiredIds = new Set(sorted.map((el) => el.id));
    const newIds = sorted.filter((el) => !before.has(el.id)).map((el) => el.id);
    if (newIds.length) {
      const collisions = await tx.mapElement.count({ where: { id: { in: newIds } } });
      if (collisions) throw new LayoutValidationError('Identificador pertence a outro mapa');
    }
    await tx.map.update({
      where: { id: mapId },
      data: {
        name: layout.name,
        widthMeters: layout.widthMeters,
        heightMeters: layout.heightMeters,
        originXMeters: layout.originXMeters ?? 0,
        originYMeters: layout.originYMeters ?? 0,
      },
    });
    let changed = 0;
    for (const el of sorted) {
      const data = {
        parentId: el.parentId,
        deviceId: el.deviceId,
        kind: el.kind,
        name: el.name,
        iconKey: el.iconKey,
        xMeters: el.xMeters,
        yMeters: el.yMeters,
        widthMeters: el.widthMeters,
        heightMeters: el.heightMeters,
        level: el.level,
        orderIndex: el.orderIndex ?? 0,
        hidden: el.hidden ?? false,
        locked: el.locked ?? false,
      };
      const old = before.get(el.id);
      if (!old) {
        await tx.mapElement.create({ data: { id: el.id, mapId, ...data } });
        changed++;
        continue;
      }
      if (Object.entries(data).some(([key, value]) => old[key as keyof typeof old] !== value)) {
        await tx.mapElement.update({ where: { id: el.id }, data });
        changed++;
      }
    }
    const removed = current.filter((el) => !desiredIds.has(el.id)).map((el) => el.id);
    if (removed.length) {
      await tx.mapElement.deleteMany({ where: { mapId, id: { in: removed } } });
    }
    // Names edited on device cards are also reflected in their inventory record.
    for (const el of sorted) {
      if (el.kind === 'DEVICE' && el.deviceId) {
        const device = await tx.device.findUnique({
          where: { id: el.deviceId },
          select: { name: true },
        });
        if (device && device.name !== el.name) {
          await tx.device.update({ where: { id: el.deviceId }, data: { name: el.name } });
          await tx.mapElement.updateMany({
            where: { deviceId: el.deviceId },
            data: { name: el.name },
          });
        }
      }
    }
    return { ok: true, count: sorted.length, changed, removed: removed.length };
  });
}

/** A posição pertence ao mapa; cadastro técnico e histórico pertencem ao inventário. */
export async function deleteMapRecords(mapId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${mapId}, 0))::text`;
    const found = await tx.map.findUnique({ where: { id: mapId }, select: { id: true } });
    if (!found) throw Object.assign(new Error('Mapa não encontrado'), { statusCode: 404 });
    // Both map and MapElement share cascade FKs in the existing schema.
    await tx.map.delete({ where: { id: mapId } });
    return { ok: true };
  });
}
