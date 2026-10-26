import { prisma } from '@infra/database';
import type { PrintSnapshot } from '@infra/contracts';

export const printCatalogRepository = {
  save(snapshot: PrintSnapshot) {
    const serverKey = snapshot.server.toLowerCase();
    return prisma.printCatalogSnapshot.upsert({
      where: { serverKey_source: { serverKey, source: snapshot.source } },
      create: {
        serverKey,
        serverName: snapshot.server,
        source: snapshot.source,
        collectedAt: new Date(snapshot.collectedAt),
        payload: snapshot,
      },
      update: {
        serverName: snapshot.server,
        collectedAt: new Date(snapshot.collectedAt),
        payload: snapshot,
      },
    });
  },
};
