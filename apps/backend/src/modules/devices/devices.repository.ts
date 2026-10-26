import { prisma } from '@infra/database';
import type { z } from 'zod';
import { updateDeviceSchema } from '@infra/contracts';

type DeviceChange = z.infer<typeof updateDeviceSchema>;
export const devicesRepository = {
  list: () => prisma.device.findMany({ orderBy: { name: 'asc' } }),
  create: (data: {
    name: string;
    kind: string;
    model?: string;
    ipAddress?: string;
    assetTag?: string;
  }) => prisma.device.create({ data }),
  async update(id: string, data: DeviceChange) {
    const existing = await prisma.device.findUnique({ where: { id }, select: { id: true } });
    if (!existing) return null;
    return prisma.$transaction(async (tx) => {
      const result = await tx.device.update({
        where: { id },
        data: { ...data, ipAddress: data.ipAddress === '' ? null : data.ipAddress },
      });
      if (data.name !== undefined)
        await tx.mapElement.updateMany({ where: { deviceId: id }, data: { name: data.name } });
      return result;
    });
  },
};
