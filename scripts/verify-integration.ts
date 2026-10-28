import '@infra/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { prisma } from '@infra/database';
import { printerImportSchema, printSnapshotSchema, monitorConfigSchema } from '@infra/contracts';
import { buildApp } from '../apps/backend/src/app.js';
import { supportRepository } from '../apps/backend/src/modules/support/support.repository.js';
import { printerImportService } from '../apps/backend/src/modules/inventory/printer-import.service.js';
import { printCatalogRepository } from '../apps/backend/src/modules/inventory/print-catalog.repository.js';
import { createPrintCatalogService } from '../apps/backend/src/modules/inventory/print-catalog.service.js';
import { createMonitoringService } from '../apps/backend/src/modules/monitoring/monitoring.service.js';
import { monitoringRepository } from '../apps/backend/src/modules/monitoring/monitoring.repository.js';
import { mapsRepository } from '../apps/backend/src/modules/maps/maps.repository.js';

// Somente registros identificados por IDs novos deste teste são removidos no finally.
// Não chama provedores externos, ISL Light nem comandos de manutenção.
const testId = `integration-${randomUUID()}`;
const deviceIds: string[] = [];
const app = await buildApp({ logger: false });
let branchId: string | undefined;
let importServer: string | undefined;
try {
  await prisma.$connect();
  const branch = await prisma.branch.create({ data: { name: testId } });
  branchId = branch.id;
  const map = await prisma.map.create({ data: { branchId, name: testId } });
  for (const kind of ['COMPUTER', 'PRINTER']) {
    const device = await prisma.device.create({ data: { name: `${testId}-${kind}`, kind } });
    deviceIds.push(device.id);
  }
  const [computerId, printerId] = deviceIds;
  const elements = deviceIds.map((deviceId, index) => ({
    id: `${testId}-${index}`,
    deviceId,
    parentId: null,
    kind: 'DEVICE',
    name: `${testId}-${index ? 'PRINTER' : 'COMPUTER'}`,
    iconKey: null,
    xMeters: index * 5,
    yMeters: 0,
    widthMeters: 3,
    heightMeters: 3,
    level: 0,
  }));
  const layout = { name: map.name, widthMeters: 120, heightMeters: 80, elements };
  const save = await app.inject({
    method: 'PUT',
    url: `/api/v1/maps/${map.id}/layout`,
    payload: layout,
  });
  assert.equal(save.statusCode, 200, save.body);
  const invalid = await app.inject({
    method: 'PUT',
    url: `/api/v1/maps/${map.id}/layout`,
    payload: { ...layout, elements: [elements[0], elements[0]] },
  });
  assert.equal(invalid.statusCode, 400);
  assert.equal(
    await prisma.mapElement.count({ where: { mapId: map.id } }),
    2,
    'Layout inválido alterou os dados',
  );

  const links = await Promise.all([
    app.inject({
      method: 'POST',
      url: `/api/v1/maps/${map.id}/connections`,
      payload: { sourceElementId: elements[0].id, targetElementId: elements[1].id },
    }),
    app.inject({
      method: 'POST',
      url: `/api/v1/maps/${map.id}/connections`,
      payload: { sourceElementId: elements[1].id, targetElementId: elements[0].id },
    }),
  ]);
  assert.deepEqual(links.map((item) => item.statusCode).sort(), [200, 201]);
  assert.equal(await prisma.mapConnection.count({ where: { mapId: map.id } }), 1);
  const printingLink = await prisma.mapConnection.findFirstOrThrow({ where: { mapId: map.id } });
  assert.equal(printingLink.kind, 'PRINTING');
  assert(printingLink.printerAssignmentId);
  assert.equal(
    await prisma.printerAssignment.count({ where: { computerId, printerId } }),
    1,
    'Conectar os nodes não criou o padrão esperado',
  );
  await supportRepository.unassignPrinter(computerId, printerId);
  assert.equal(
    await prisma.mapConnection.count({ where: { mapId: map.id } }),
    0,
    'Remover a associação deixou uma linha de impressão órfã',
  );
  const reconnected = await mapsRepository.connect(map.id, elements[0].id, elements[1].id);
  await mapsRepository.disconnect(map.id, reconnected.connection.id);
  assert.equal(
    await prisma.printerAssignment.count({ where: { computerId, printerId } }),
    0,
    'Desconectar não removeu o padrão esperado',
  );
  await mapsRepository.connect(map.id, elements[0].id, elements[1].id);

  await prisma.device.update({ where: { id: computerId }, data: { hostname: 'PC-TEST' } });
  const monitoring = createMonitoringService({
    windows: {
      collect: async () => ({
        target: 'PC-TEST',
        spooler: 'Stopped',
        osCaption: 'Windows teste',
        uptimeHours: 2,
        freeMemoryPercent: 35,
        disks: [],
        printers: [],
        printersAvailable: false,
        warnings: [],
      }),
    },
  });
  await monitoring.configure(computerId, { enabled: false, useWindows: true });
  assert(await monitoringRepository.claim(computerId));
  assert.equal(
    await monitoringRepository.claim(computerId),
    false,
    'Duas coletas adquiriram o mesmo equipamento',
  );
  await monitoringRepository.saveConfig(
    computerId,
    monitorConfigSchema.parse({ enabled: false, useWindows: true, intervalSeconds: 90 }),
  );
  await monitoringRepository.finish(computerId);
  const rescheduled = await prisma.deviceMonitor.findUniqueOrThrow({
    where: { deviceId: computerId },
  });
  assert(rescheduled.lastRunAt);
  assert.equal(
    rescheduled.nextRunAt.getTime() - rescheduled.lastRunAt.getTime(),
    90_000,
    'A coleta ignorou o intervalo editado pelo operador',
  );
  const monitored = await monitoring.run(computerId);
  assert.equal(monitored.health.observations[0].status, 'CRITICAL');
  assert.equal(
    'status' in (await prisma.device.findUniqueOrThrow({ where: { id: computerId } })),
    false,
    'Estado deve ser calculado pelas leituras de monitoramento',
  );
  const monitorPage = await app.inject(`/api/v1/monitoring/maps/${map.id}?page=1`);
  assert.equal(monitorPage.statusCode, 200, monitorPage.body);
  assert.equal(monitorPage.json().items.length, 2);
  assert.equal((await monitoringRepository.history(computerId)).length, 1);

  const jobs = await Promise.allSettled([
    supportRepository.startJob(computerId, 'spooler_status'),
    supportRepository.startJob(computerId, 'spooler_status'),
  ]);
  assert.equal(
    jobs.filter((item) => item.status === 'fulfilled').length,
    1,
    'Duas operações simultâneas foram aceitas',
  );
  const active = jobs.find((item) => item.status === 'fulfilled');
  assert(active?.status === 'fulfilled');
  const jobId = active.value.id;
  await supportRepository.updateJob(jobId, { status: 'REVIEWED' });
  assert.equal(await prisma.printerAssignment.count({ where: { computerId, printerId } }), 1);

  const removed = await app.inject({ method: 'DELETE', url: `/api/v1/maps/${map.id}` });
  assert.equal(removed.statusCode, 204, removed.body);
  assert.equal(await prisma.mapElement.count({ where: { mapId: map.id } }), 0);
  assert.equal(
    await prisma.device.count({ where: { id: { in: deviceIds } } }),
    2,
    'Excluir mapa apagou inventário',
  );
  assert(
    await prisma.supportJob.findUnique({ where: { id: jobId } }),
    'Excluir mapa apagou histórico',
  );
  assert.equal(await prisma.printerAssignment.count({ where: { computerId, printerId } }), 1);

  const input = printerImportSchema.parse(
    JSON.parse(
      await readFile(
        new URL('../docs/references/cadastro_impressoras_economart.json', import.meta.url),
        'utf8',
      ),
    ),
  );
  importServer = testId;
  input.impressoras = input.impressoras.map((printer, index) => ({
    ...printer,
    nome_amigavel_sugerido: `${testId}-${index}`,
    servidor_impressao: testId,
    nome_compartilhamento: `queue-${index}`,
    caminho_compartilhado: `\\\\${testId}\\queue-${index}`,
    ip: `2001:db8:${randomUUID().slice(0, 4)}::${index + 1}`,
  }));
  const preview = await printerImportService.import(input);
  assert.equal(preview.created, 2);
  assert.equal(
    await prisma.device.count({ where: { printServer: testId } }),
    0,
    'A prévia gravou dados',
  );
  assert.equal((await printerImportService.import(input, true)).created, 2);
  assert.equal((await printerImportService.import(input, true)).skipped, 2);
  const printSnapshot = printSnapshotSchema.parse({
    server: testId,
    source: 'WINDOWS',
    collectedAt: new Date().toISOString(),
    queues: [
      {
        name: 'QUEUE-INTEGRATION',
        shareName: 'SHARE-INTEGRATION',
        driverName: 'DRIVER-WINDOWS',
        portName: 'PORT-INTEGRATION',
        hostAddress: '192.0.2.239',
        protocol: 'RAW',
        portNumber: 9100,
        shared: true,
        location: null,
      },
    ],
    ports: [
      { name: 'PORT-INTEGRATION', hostAddress: '192.0.2.239', protocol: 'RAW', portNumber: 9100 },
    ],
    drivers: [],
    warnings: [],
  });
  const catalogService = createPrintCatalogService({
    client: { available: () => true, collect: async () => printSnapshot },
  });
  for (let index = 0; index < 45; index++)
    printSnapshot.queues.push({
      ...printSnapshot.queues[0],
      name: `QUEUE-PAGE-${String(index).padStart(3, '0')}`,
      shareName: `SHARE-PAGE-${index}`,
    });
  printSnapshot.queues.push({ ...printSnapshot.queues[0], name: 'QUEUE_100%' });
  await catalogService.discover(testId);
  await printCatalogRepository.save({
    ...printSnapshot,
    source: 'REFERENCE',
    referenceDate: '2026-10-23',
  });
  assert.equal(
    await prisma.printCatalogSnapshot.count({ where: { serverKey: testId.toLowerCase() } }),
    2,
    'A coleta substituiu uma origem diferente',
  );
  const catalogResponse = await app.inject(
    `/api/v1/inventory/catalog?kind=PRINTER&server=${testId}`,
  );
  assert.equal(catalogResponse.statusCode, 200, catalogResponse.body);
  assert.equal(catalogResponse.json().snapshots.length, 2);
  assert(!('queues' in catalogResponse.json()), 'O resumo enviou o catálogo inteiro');
  const pageOne = await app.inject(
    `/api/v1/inventory/options?field=printQueue&kind=PRINTER&server=${testId}&page=1&pageSize=20`,
  );
  assert.equal(pageOne.statusCode, 200, pageOne.body);
  const firstPage = pageOne.json();
  assert.equal(firstPage.total, 47);
  assert.equal(firstPage.items.length, 20);
  assert(firstPage.hasNext);
  assert(
    firstPage.items.every((item: { source: string }) => item.source === 'WINDOWS'),
    'Deduplicação perdeu prioridade da coleta',
  );
  const pageTwo = await app.inject(
    `/api/v1/inventory/options?field=printQueue&kind=PRINTER&server=${testId}&page=2&pageSize=20`,
  );
  assert.equal(pageTwo.statusCode, 200, pageTwo.body);
  assert.equal(pageTwo.json().items.length, 20);
  assert(
    !pageTwo
      .json()
      .items.some((item: { key: string }) =>
        firstPage.items.some((first: { key: string }) => first.key === item.key),
      ),
  );
  const lastPage = await app.inject(
    `/api/v1/inventory/options?field=printQueue&kind=PRINTER&server=${testId}&page=3&pageSize=20`,
  );
  assert.equal(lastPage.json().items.length, 7);
  assert.equal(lastPage.json().hasNext, false);
  const literalPercent = await app.inject(
    `/api/v1/inventory/options?field=printQueue&server=${testId}&search=${encodeURIComponent('100%')}`,
  );
  assert.equal(literalPercent.json().total, 1);
  const excessive = await app.inject(`/api/v1/inventory/options?field=printQueue&pageSize=5000`);
  assert.equal(excessive.statusCode, 400);
  const printerChange = await app.inject({
    method: 'PATCH',
    url: `/api/v1/devices/${printerId}`,
    payload: {
      printServer: testId,
      printQueue: 'QUEUE-MANUAL',
      printPort: 'PORT-MANUAL',
      printProtocol: 'CUSTOM',
      printPortNumber: 9101,
      approvedDriver: 'DRIVER-MANUAL',
    },
  });
  assert.equal(printerChange.statusCode, 200, printerChange.body);
  const updatedCatalog = await catalogService.options({
    field: 'approvedDriver',
    kind: 'PRINTER',
    server: testId,
    search: 'DRIVER-MANUAL',
    page: 1,
    pageSize: 20,
  });
  assert(
    updatedCatalog.items.some(
      (item) => item.value === 'DRIVER-MANUAL' && item.source === 'INVENTORY',
    ),
  );
  assert.equal(
    (await prisma.device.findUnique({ where: { id: printerId } }))?.printPortNumber,
    9101,
  );
  console.log(
    'Integração PostgreSQL/API: layout, associações computador/impressora, exclusões, monitoramento com fonte simulada, concorrência, preservação de dados, importação e catálogos passaram.',
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Falha na integração.');
  process.exitCode = 1;
} finally {
  try {
    if (branchId) await prisma.branch.deleteMany({ where: { id: branchId } });
    if (deviceIds.length) await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    if (importServer) await prisma.device.deleteMany({ where: { printServer: importServer } });
    await prisma.printCatalogSnapshot.deleteMany({ where: { serverKey: testId.toLowerCase() } });
  } finally {
    await app.close();
  }
}
