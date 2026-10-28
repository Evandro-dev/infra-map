import { prisma } from '@infra/database';
import type { z } from 'zod';
import { updateDeviceSchema } from '@infra/contracts';
import { cloneDeviceData, cloneMonitorData } from './device-clone.js';

type DeviceChange = z.infer<typeof updateDeviceSchema>;
type DeviceRecord = Awaited<ReturnType<typeof prisma.device.create>>;
export const devicesRepository = {
  list: () => prisma.device.findMany({ orderBy: { name: 'asc' } }),
  create: (data: {
    name: string;
    kind: string;
    model?: string;
    ipAddress?: string;
    assetTag?: string;
  }) => prisma.device.create({ data }),
  cloneMany: (ids: string[]) =>
    prisma.$transaction(async (tx) => {
      const sources = await tx.device.findMany({
        where: { id: { in: ids } },
        include: { monitoring: true },
      });
      if (sources.length !== ids.length) return null;
      const clones: Record<string, DeviceRecord> = {};
      for (const source of sources) {
        const clone = await tx.device.create({ data: cloneDeviceData(source) });
        const monitor = cloneMonitorData(source.monitoring, clone.id);
        if (monitor) await tx.deviceMonitor.create({ data: monitor });
        clones[source.id] = clone;
      }
      return clones;
    }),
  async update(id: string, data: DeviceChange) {
    const existing = await prisma.device.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) return null;
    return prisma.$transaction(async (tx) => {
      const result = await tx.device.update({
        where: { id },
        data: { ...data, ipAddress: data.ipAddress === '' ? null : data.ipAddress },
      });
      if (data.name !== undefined && data.name !== existing.name)
        await tx.mapElement.updateMany({
          where: { deviceId: id, name: existing.name },
          data: { name: data.name },
        });
      return result;
    });
  },
};
