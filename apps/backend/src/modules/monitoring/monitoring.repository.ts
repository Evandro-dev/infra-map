import { prisma, Prisma } from '@infra/database';
import type {
  MonitorConfig,
  MonitorObservation,
  MonitorSource,
  ObservationStatus,
} from '@infra/contracts';

export const monitoringRepository = {
  target: (id: string) =>
    prisma.device.findUnique({
      where: { id },
      include: { monitoring: true, assignedPrinters: { include: { printer: true } } },
    }),
  async saveConfig(deviceId: string, config: MonitorConfig) {
    return prisma.deviceMonitor.upsert({
      where: { deviceId },
      create: { deviceId, ...config, nextRunAt: new Date() },
      update: { ...config, nextRunAt: new Date() },
    });
  },
  async claim(deviceId: string) {
    const now = new Date();
    const result = await prisma.deviceMonitor.updateMany({
      where: { deviceId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] },
      data: { leaseUntil: new Date(now.getTime() + 120_000) },
    });
    return result.count > 0;
  },
  async claimDue() {
    return prisma.$queryRaw<
      Array<{ deviceId: string }>
    >`WITH due AS (SELECT "deviceId" FROM "DeviceMonitor" WHERE enabled=true AND "nextRunAt"<=CURRENT_TIMESTAMP AND ("leaseUntil" IS NULL OR "leaseUntil"<CURRENT_TIMESTAMP) ORDER BY "nextRunAt" FOR UPDATE SKIP LOCKED LIMIT 3) UPDATE "DeviceMonitor" m SET "leaseUntil"=CURRENT_TIMESTAMP+INTERVAL '120 seconds' FROM due WHERE m."deviceId"=due."deviceId" RETURNING m."deviceId"`;
  },
  async finish(deviceId: string) {
    // Usa o intervalo atual, inclusive se o operador o editou durante a coleta.
    await prisma.$executeRaw`UPDATE "DeviceMonitor" SET "lastRunAt"=CURRENT_TIMESTAMP,"nextRunAt"=CURRENT_TIMESTAMP+"intervalSeconds"*INTERVAL '1 second',"leaseUntil"=NULL WHERE "deviceId"=${deviceId}`;
  },
  async observe(
    deviceId: string,
    source: MonitorSource,
    status: ObservationStatus,
    summary: string,
    data: Record<string, unknown> = {},
  ) {
    const record = await prisma.monitorObservation.create({
      data: {
        deviceId,
        source,
        status,
        summary,
        data: JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue,
      },
    });
    // Histórico limitado por equipamento; não acumula relatórios indefinidamente.
    await prisma.$executeRaw`DELETE FROM "MonitorObservation" WHERE id IN (SELECT id FROM "MonitorObservation" WHERE "deviceId"=${deviceId} ORDER BY "checkedAt" DESC,id DESC OFFSET 200)`;
    return record;
  },
  async latest(deviceIds: string[]): Promise<MonitorObservation[]> {
    if (!deviceIds.length) return [];
    const records = await prisma.$queryRaw<
      Array<{
        id: string;
        deviceId: string;
        source: MonitorSource;
        status: ObservationStatus;
        summary: string;
        checkedAt: Date;
        data: Record<string, unknown>;
      }>
    >(
      Prisma.sql`SELECT DISTINCT ON ("deviceId",source) id,"deviceId",source,status,summary,"checkedAt",data FROM "MonitorObservation" WHERE "deviceId" IN (${Prisma.join(deviceIds)}) ORDER BY "deviceId",source,"checkedAt" DESC,id DESC`,
    );
    return records.map((row) => ({ ...row, checkedAt: row.checkedAt.toISOString() }));
  },
  history: (deviceId: string) =>
    prisma.monitorObservation.findMany({
      where: { deviceId },
      orderBy: { checkedAt: 'desc' },
      take: 20,
    }),
  async mapPage(mapId: string, page: number) {
    const where = { elements: { some: { mapId } } };
    const [devices, total] = await prisma.$transaction([
      prisma.device.findMany({
        where,
        include: { monitoring: true },
        orderBy: { id: 'asc' },
        skip: (page - 1) * 100,
        take: 100,
      }),
      prisma.device.count({ where }),
    ]);
    return { devices, total };
  },
};
