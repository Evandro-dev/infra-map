import '@infra/config';
import { randomUUID } from 'node:crypto';
import { Prisma, prisma } from '@infra/database';

const workflowName = 'ECO-POA-27';
const branchName = 'Pouso Alegre · unidade a confirmar';
const sourceNote =
  'Base inicial ECO-POA-27. Coleta local Windows em 28/10/2026; endereço de porta TCP das filas compartilhadas conferido no inventário de 27/10/2026.';

const devices: Array<{
  key: string;
  elementId: string;
  create: Prisma.DeviceCreateInput;
  position: { xMeters: number; yMeters: number; parentId: string | null };
  monitor?: {
    enabled: boolean;
    intervalSeconds: number;
    timeoutSeconds: number;
    useIsl: boolean;
    useWindows: boolean;
    usePrintServer: boolean;
    useTcp: boolean;
    tcpPort: number | null;
  };
}> = [
  {
    key: 'computer',
    elementId: 'ecopoa27-node-tif01',
    create: {
      name: 'ECO-POA-TIF-01',
      kind: 'COMPUTER',
      manufacturer: 'Dell Inc.',
      model: 'Inspiron 15 3530',
      hostname: 'ECO-POA-TIF-01',
      operatingSystem: 'Microsoft Windows 11 Pro',
      ipAddress: '192.168.27.186',
      macAddress: '3C:EF:A5:F0:39:51',
      notes: `${sourceNote}\nProcessador e memória conforme captura fornecida: Intel Core i5-1334U, 16 GB. Adaptador Wi-Fi; máscara 255.255.255.0; gateway 192.168.27.254; DHCP ativo. DNS observado: 10.106.225.22, 10.106.225.62, 192.168.0.7 e 8.8.8.8. O endereço 192.168.27.201 pertence à impressora PLC, não a este computador.`,
    },
    position: { xMeters: 9, yMeters: 23, parentId: 'ecopoa27-area-unit' },
    monitor: {
      enabled: true,
      intervalSeconds: 60,
      timeoutSeconds: 5,
      useIsl: false,
      useWindows: true,
      usePrintServer: false,
      useTcp: false,
      tcpPort: null,
    },
  },
  {
    key: 'server',
    elementId: 'ecopoa27-node-print-server',
    create: {
      name: 'srv-sky-prt-01',
      kind: 'SERVER',
      hostname: 'srv-sky-prt-01',
      notes: `${sourceNote}\nServidor de impressão observado nas filas compartilhadas ECO-POA-PLC-P01 e ECO-POA-RHU-P01. IP do servidor não coletado nesta execução.`,
    },
    position: { xMeters: 101, yMeters: 28, parentId: null },
  },
  {
    key: 'fca-p01',
    elementId: 'ecopoa27-node-fca-p01',
    create: {
      name: 'ECO-POA-FCA-P01 (WF-M5899 Series)',
      kind: 'PRINTER',
      manufacturer: 'Epson',
      model: 'WF-M5899 Series',
      approvedDriver: 'Microsoft IPP Class Driver',
      printQueue: 'ECO-POA-FCA-P01 (WF-M5899 Series)',
      printPort: 'WSD-c5e2382a-072f-4598-8026-975f20afe4d0',
      printProtocol: 'WSD',
      notes: `${sourceNote}\nInstalada localmente no computador ECO-POA-TIF-01. O Windows usa uma porta WSD; IP físico não informado pela coleta.`,
    },
    position: { xMeters: 34, yMeters: 7, parentId: 'ecopoa27-area-unit' },
  },
  {
    key: 'rme-p01',
    elementId: 'ecopoa27-node-rme-p01',
    create: {
      name: 'ECO-POA-RME-P01 (WF-M5899 Series)',
      kind: 'PRINTER',
      manufacturer: 'Epson',
      model: 'WF-M5899 Series',
      approvedDriver: 'Microsoft IPP Class Driver',
      printQueue: 'ECO-POA-RME-P01 (WF-M5899 Series)',
      printPort: 'WSD-7255fb41-989a-4e8b-a7bf-1c3ef6ac2620',
      printProtocol: 'WSD',
      notes: `${sourceNote}\nInstalada localmente no computador ECO-POA-TIF-01. O Windows usa uma porta WSD; IP físico não informado pela coleta.`,
    },
    position: { xMeters: 34, yMeters: 19, parentId: 'ecopoa27-area-unit' },
  },
  {
    key: 'rme-p02',
    elementId: 'ecopoa27-node-rme-p02',
    create: {
      name: 'ECO-POA-RME-P02 (WF-M5899 Series)',
      kind: 'PRINTER',
      manufacturer: 'Epson',
      model: 'WF-M5899 Series',
      approvedDriver: 'Microsoft IPP Class Driver',
      printQueue: 'ECO-POA-RME-P02 (WF-M5899 Series)',
      printPort: 'WSD-9fd29726-9f2b-4c73-af29-458d115105d4',
      printProtocol: 'WSD',
      notes: `${sourceNote}\nInstalada localmente no computador ECO-POA-TIF-01. O Windows usa uma porta WSD; IP físico não informado pela coleta.`,
    },
    position: { xMeters: 34, yMeters: 31, parentId: 'ecopoa27-area-unit' },
  },
  {
    key: 'plc-p01',
    elementId: 'ecopoa27-node-plc-p01',
    create: {
      name: 'ECO-POA-PLC-P01',
      kind: 'PRINTER',
      manufacturer: 'Epson',
      model: 'WF-C878R Series',
      approvedDriver: 'EPSON WF-C878R Series',
      ipAddress: '192.168.27.201',
      printServer: 'srv-sky-prt-01',
      printShare: 'ECO-POA-PLC-P01',
      printQueue: 'ECO-POA-PLC-P01',
      printPort: '192.168.27.201',
      printProtocol: 'RAW',
      printPortNumber: 9100,
      notes: `${sourceNote}\nFila compartilhada \u005c\u005csrv-sky-prt-01\\ECO-POA-PLC-P01. IP e fila confirmados ao vivo; protocolo RAW e porta 9100 vêm do inventário de portas de 27/10/2026.`,
    },
    position: { xMeters: 50, yMeters: 13, parentId: 'ecopoa27-area-unit' },
    monitor: {
      enabled: true,
      intervalSeconds: 60,
      timeoutSeconds: 15,
      useIsl: false,
      useWindows: false,
      usePrintServer: true,
      useTcp: true,
      tcpPort: 9100,
    },
  },
  {
    key: 'rhu-p01',
    elementId: 'ecopoa27-node-rhu-p01',
    create: {
      name: 'ECO-POA-RHU-P01',
      kind: 'PRINTER',
      manufacturer: 'Epson',
      model: 'WF-M5899 Series',
      approvedDriver: 'EPSON WF-M5899 Series',
      ipAddress: '192.168.27.202',
      printServer: 'srv-sky-prt-01',
      printShare: 'ECO-POA-RHU-P01',
      printQueue: 'RH-EPSON-M5899-SKY',
      printPort: '192.168.27.202',
      printProtocol: 'RAW',
      printPortNumber: 9100,
      notes: `${sourceNote}\nFila compartilhada \u005c\u005csrv-sky-prt-01\\ECO-POA-RHU-P01. IP e fila confirmados ao vivo; protocolo RAW e porta 9100 vêm do inventário de portas de 27/10/2026.`,
    },
    position: { xMeters: 50, yMeters: 37, parentId: 'ecopoa27-area-unit' },
    monitor: {
      enabled: true,
      intervalSeconds: 60,
      timeoutSeconds: 15,
      useIsl: false,
      useWindows: false,
      usePrintServer: true,
      useTcp: true,
      tcpPort: 9100,
    },
  },
];

async function ensureDevice(tx: Prisma.TransactionClient, seed: Prisma.DeviceCreateInput) {
  const kind = String(seed.kind);
  const name = String(seed.name);
  const hostname = typeof seed.hostname === 'string' ? seed.hostname : null;
  const ipAddress = typeof seed.ipAddress === 'string' ? seed.ipAddress : null;
  const existing = await tx.device.findFirst({
    where:
      kind === 'COMPUTER' && hostname
        ? { kind, hostname }
        : ipAddress
          ? { kind, name, ipAddress }
          : { kind, name },
  });
  if (!existing) return tx.device.create({ data: seed });
  const existingNotes = existing.notes?.trim();
  const currentNotes = typeof seed.notes === 'string' ? seed.notes : '';
  return tx.device.update({
    where: { id: existing.id },
    data: {
      ...seed,
      notes:
        existingNotes && !existingNotes.includes(currentNotes)
          ? `${existingNotes}\n${currentNotes}`
          : existingNotes || currentNotes,
    },
  });
}

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    const existingMap = await tx.map.findFirst({ where: { name: workflowName } });
    if (existingMap) {
      const currentElements = await tx.mapElement.count({ where: { mapId: existingMap.id } });
      return { id: existingMap.id, created: false, elements: currentElements };
    }

    const branch =
      (await tx.branch.findFirst({ where: { name: branchName } })) ??
      (await tx.branch.create({ data: { name: branchName } }));
    const map = await tx.map.create({
      data: {
        id: `ecopoa27-${randomUUID().slice(0, 8)}`,
        branchId: branch.id,
        name: workflowName,
        widthMeters: 120,
        heightMeters: 80,
        originXMeters: 0,
        originYMeters: 0,
        hasTerritory: true,
      },
    });

    await tx.mapElement.create({
      data: {
        id: 'ecopoa27-area-unit',
        mapId: map.id,
        kind: 'AREA',
        name: 'Pouso Alegre · unidade a confirmar',
        iconKey: 'door-open',
        xMeters: 5,
        yMeters: 7,
        widthMeters: 82,
        heightMeters: 62,
        level: 0,
        orderIndex: 0,
      },
    });

    const elementByKey = new Map<string, string>();
    const deviceByKey = new Map<string, string>();
    for (const [index, item] of devices.entries()) {
      const device = await ensureDevice(tx, item.create);
      elementByKey.set(item.key, item.elementId);
      deviceByKey.set(item.key, device.id);
      await tx.mapElement.create({
        data: {
          id: item.elementId,
          mapId: map.id,
          parentId: item.position.parentId,
          deviceId: device.id,
          kind: 'DEVICE',
          name: String(item.create.name),
          iconKey:
            item.key === 'server' ? 'server' : item.key === 'computer' ? 'monitor' : 'printer',
          xMeters: item.position.xMeters,
          yMeters: item.position.yMeters,
          widthMeters: 1.4,
          heightMeters: 1.4,
          level: item.position.parentId ? 1 : 0,
          orderIndex: index + 1,
        },
      });
      if (item.monitor && !(await tx.deviceMonitor.findUnique({ where: { deviceId: device.id } })))
        await tx.deviceMonitor.create({
          data: {
            deviceId: device.id,
            ...item.monitor,
            nextRunAt: new Date(),
          },
        });
    }

    const connect = async (sourceKey: string, targetKey: string, printing: boolean) => {
      const sourceElementId = elementByKey.get(sourceKey)!;
      const targetElementId = elementByKey.get(targetKey)!;
      const [firstId, secondId] = [sourceElementId, targetElementId].sort();
      const sourceDevice = devices.find((item) => item.key === sourceKey)?.create;
      const targetDevice = devices.find((item) => item.key === targetKey)?.create;
      const sourceHostname = String(sourceDevice?.hostname ?? '')
        .replaceAll(String.fromCharCode(92), '')
        .trim()
        .toLowerCase();
      const targetPrintServer = String(targetDevice?.printServer ?? '')
        .replaceAll(String.fromCharCode(92), '')
        .trim()
        .toLowerCase();
      const serves = Boolean(
        sourceHostname && targetPrintServer && sourceHostname === targetPrintServer,
      );
      let printerAssignmentId: string | null = null;
      if (printing) {
        const computerId = deviceByKey.get('computer')!;
        const printerId = deviceByKey.get(targetKey)!;
        const assignment = await tx.printerAssignment.upsert({
          where: { computerId_printerId: { computerId, printerId } },
          create: { computerId, printerId },
          update: {},
        });
        printerAssignmentId = assignment.id;
      }
      await tx.mapConnection.upsert({
        where: {
          mapId_sourceElementId_targetElementId: {
            mapId: map.id,
            sourceElementId: firstId,
            targetElementId: secondId,
          },
        },
        create: {
          mapId: map.id,
          sourceElementId: firstId,
          targetElementId: secondId,
          kind: printing ? 'PRINTING' : serves ? 'SERVES' : 'NETWORK',
          printerAssignmentId,
        },
        update: {},
      });
    };

    for (const printerKey of ['fca-p01', 'rme-p01', 'rme-p02', 'plc-p01', 'rhu-p01'])
      await connect('computer', printerKey, true);
    await connect('server', 'plc-p01', false);
    await connect('server', 'rhu-p01', false);

    return { id: map.id, created: true, elements: devices.length + 1 };
  });

  console.log(
    JSON.stringify({
      workflow: workflowName,
      workflowId: result.id,
      created: result.created,
      elementCount: result.elements,
      url: `http://localhost:3000/workflow/${result.id}`,
    }),
  );
}

async function check() {
  const [workflowCount, workflow, computerCount, printerCount] = await Promise.all([
    prisma.map.count(),
    prisma.map.findFirst({
      where: { name: workflowName },
      include: { elements: { include: { device: true } }, connections: true },
    }),
    prisma.device.count({ where: { kind: 'COMPUTER', hostname: 'ECO-POA-TIF-01' } }),
    prisma.device.count({
      where: {
        kind: 'PRINTER',
        name: {
          in: [
            'ECO-POA-FCA-P01 (WF-M5899 Series)',
            'ECO-POA-RME-P01 (WF-M5899 Series)',
            'ECO-POA-RME-P02 (WF-M5899 Series)',
            'ECO-POA-PLC-P01',
            'ECO-POA-RHU-P01',
          ],
        },
      },
    }),
  ]);
  console.log(
    JSON.stringify({
      workflowCount,
      ecoPoa27Exists: Boolean(workflow),
      workflowId: workflow?.id ?? null,
      elementCount: workflow?.elements.length ?? 0,
      computerNodes:
        workflow?.elements.filter((element) => element.device?.kind === 'COMPUTER').length ?? 0,
      printerNodes:
        workflow?.elements.filter((element) => element.device?.kind === 'PRINTER').length ?? 0,
      serverNodes:
        workflow?.elements.filter((element) => element.device?.kind === 'SERVER').length ?? 0,
      printConnections:
        workflow?.connections.filter((connection) => connection.kind === 'PRINTING').length ?? 0,
      servesConnections:
        workflow?.connections.filter((connection) => connection.kind === 'SERVES').length ?? 0,
      networkConnections:
        workflow?.connections.filter((connection) => connection.kind === 'NETWORK').length ?? 0,
      existingComputerCount: computerCount,
      existingPrinterCount: printerCount,
    }),
  );
}

try {
  if (process.argv.includes('--check')) await check();
  else await main();
} finally {
  await prisma.$disconnect();
}
