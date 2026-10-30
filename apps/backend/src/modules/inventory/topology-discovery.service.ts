import {
  printServerSchema,
  type MapTopologyDiscoveryResult,
  type PrintSnapshot,
  type WindowsComputerReport,
} from '@infra/contracts';
import { prisma } from '@infra/database';
import { AppError } from '../../shared/errors.js';
import { credentialsService } from '../credentials/credentials.service.js';
import { deviceIdentityRepository } from '../devices/device-identity.repository.js';
import { monitoringRepository } from '../monitoring/monitoring.repository.js';
import { windowsComputerClient } from '../monitoring/adapters/windows-computer.client.js';
import { windowsPrintClient } from './adapters/windows-print.client.js';
import { printCatalogRepository } from './print-catalog.repository.js';

const MAX_COMPUTERS = 20;
const COMPUTER_TIMEOUT_SECONDS = 10;
const normalize = (value: string | null | undefined) =>
  value?.replace(/^\\\\/, '').trim().toLocaleLowerCase('en-US') ?? '';
const normalizeQueue = (value: string | null | undefined) =>
  value
    ?.trim()
    .replace(/^\\\\[^\\]+\\/, '')
    .toLocaleLowerCase('en-US') ?? '';

interface PrinterNode {
  elementId: string;
  id: string;
  name: string;
  printServer: string | null;
  printQueue: string | null;
  printShare: string | null;
}
interface ObservedPrinter {
  Name: string;
  DriverName: string | null;
  PortName: string | null;
  ComputerName: string | null;
  ShareName: string | null;
}

export function isVirtualOrFaxQueue(printer: ObservedPrinter) {
  const name = printer.Name.trim().toLocaleLowerCase('en-US');
  const port = printer.PortName?.trim().toLocaleLowerCase('en-US') ?? '';
  return (
    ['nul:', 'portprompt:', 'file:'].includes(port) ||
    /^(microsoft print to pdf|microsoft xps document writer|onenote \(desktop\))/.test(name) ||
    /\(fax\)$/.test(name) ||
    /^fax(?:\s|$)/.test(name)
  );
}

function uncParts(value: string | null | undefined) {
  const match = value?.trim().match(/^\\\\([^\\]+)\\([^\\]+)$/);
  return match ? { server: match[1], share: match[2] } : null;
}

export function matchObservedPrinter(
  observed: ObservedPrinter,
  printers: PrinterNode[],
): { status: 'MATCHED' | 'UNMATCHED' | 'AMBIGUOUS'; printer?: PrinterNode } {
  const path = uncParts(observed.Name);
  // Get-Printer's ComputerName names the computer being queried, not necessarily
  // the remote print server for a client-side installed queue. Trust the UNC path.
  const observedServer = normalize(path?.server);
  const observedShare = normalizeQueue(path?.share ?? observed.ShareName);
  const observedName = normalizeQueue(observed.Name);
  const matches = printers.filter((printer) => {
    if (printer.printServer) {
      if (!observedServer || observedServer !== normalize(printer.printServer)) return false;
      return [printer.printQueue, printer.printShare, printer.name].some(
        (value) => value && [observedName, observedShare].includes(normalizeQueue(value)),
      );
    }
    if (observedServer || observed.ShareName) return false;
    return [printer.printQueue, printer.name].some(
      (value) => value && normalizeQueue(value) === observedName,
    );
  });
  if (!matches.length) return { status: 'UNMATCHED' };
  if (matches.length > 1) return { status: 'AMBIGUOUS' };
  return { status: 'MATCHED', printer: matches[0] };
}

function findQueueForDevice(snapshot: PrintSnapshot, printer: PrinterNode) {
  const serverMatch = normalize(snapshot.server) === normalize(printer.printServer);
  if (!serverMatch) return null;
  const matches = snapshot.queues.filter((queue) =>
    [printer.printQueue, printer.printShare, printer.name].some(
      (value) =>
        value &&
        [normalizeQueue(queue.name), normalizeQueue(queue.shareName)].includes(
          normalizeQueue(value),
        ),
    ),
  );
  return matches.length === 1 ? matches[0] : null;
}

async function saveQueueIdentity(printer: PrinterNode, snapshot: PrintSnapshot) {
  const queue = findQueueForDevice(snapshot, printer);
  if (!queue) return { queue: null, fieldsFilled: [] as string[] };
  const hostAddress = queue.hostAddress?.trim() || null;
  const { isIP } = await import('node:net');
  const existing = await prisma.device.findUnique({
    where: { id: printer.id },
    select: {
      ipAddress: true,
      hostname: true,
      printQueue: true,
      printShare: true,
      approvedDriver: true,
      printPort: true,
      printProtocol: true,
      printPortNumber: true,
    },
  });
  if (!existing) return { queue, fieldsFilled: [] as string[] };
  const candidates = {
    ipAddress: hostAddress && isIP(hostAddress) ? hostAddress : null,
    hostname: hostAddress && !isIP(hostAddress) ? hostAddress : null,
    printQueue: queue.name,
    printShare: queue.shareName,
    approvedDriver: queue.driverName,
    printPort: queue.portName,
    printProtocol: queue.protocol,
    printPortNumber: queue.portNumber,
  };
  const data: Record<string, string | number> = {};
  for (const key of Object.keys(candidates) as (keyof typeof candidates)[]) {
    if (existing[key] === null && candidates[key]) data[key] = candidates[key]!;
  }
  if (Object.keys(data).length) await prisma.device.update({ where: { id: printer.id }, data });
  return { queue, fieldsFilled: Object.keys(data) };
}

async function saveObservedRelation(
  mapId: string,
  computer: { elementId: string; id: string; name: string },
  printer: PrinterNode,
) {
  return prisma.$transaction(async (tx) => {
    const existingAssignment = await tx.printerAssignment.findUnique({
      where: { computerId_printerId: { computerId: computer.id, printerId: printer.id } },
      select: { id: true },
    });
    const assignment = await tx.printerAssignment.upsert({
      where: { computerId_printerId: { computerId: computer.id, printerId: printer.id } },
      create: { computerId: computer.id, printerId: printer.id },
      update: {},
    });
    const [sourceElementId, targetElementId] = [computer.elementId, printer.elementId].sort();
    const connection = await tx.mapConnection.findUnique({
      where: { mapId_sourceElementId_targetElementId: { mapId, sourceElementId, targetElementId } },
      select: { id: true },
    });
    if (connection)
      await tx.mapConnection.update({
        where: { id: connection.id },
        data: { kind: 'PRINTING', printerAssignmentId: assignment.id },
      });
    else
      await tx.mapConnection.create({
        data: {
          mapId,
          sourceElementId,
          targetElementId,
          kind: 'PRINTING',
          printerAssignmentId: assignment.id,
        },
      });
    return Boolean(existingAssignment);
  });
}

async function saveServesConnection(mapId: string, serverElementId: string, printer: PrinterNode) {
  const [sourceElementId, targetElementId] = [serverElementId, printer.elementId].sort();
  await prisma.mapConnection.upsert({
    where: { mapId_sourceElementId_targetElementId: { mapId, sourceElementId, targetElementId } },
    create: { mapId, sourceElementId, targetElementId, kind: 'SERVES' },
    update: { kind: 'SERVES', printerAssignmentId: null },
  });
}

export function createTopologyDiscoveryService(
  dependencies: {
    computerClient?: typeof windowsComputerClient;
    printClient?: typeof windowsPrintClient;
    saveSnapshot?: typeof printCatalogRepository.save;
    credentials?: typeof credentialsService;
  } = {},
) {
  const computerClient = dependencies.computerClient ?? windowsComputerClient;
  const printClient = dependencies.printClient ?? windowsPrintClient;
  const saveSnapshot = dependencies.saveSnapshot ?? printCatalogRepository.save;
  const credentials = dependencies.credentials ?? credentialsService;

  return {
    async discover(mapId: string): Promise<MapTopologyDiscoveryResult> {
      const map = await prisma.map.findUnique({
        where: { id: mapId },
        include: {
          elements: {
            where: { kind: 'DEVICE', deviceId: { not: null } },
            include: { device: true },
          },
        },
      });
      if (!map) throw new AppError(404, 'Workflow não encontrado.');
      const nodes = map.elements.flatMap((element) =>
        element.device ? [{ elementId: element.id, device: element.device }] : [],
      );
      const printers: PrinterNode[] = nodes
        .filter((node) => node.device.kind === 'PRINTER')
        .map((node) => ({
          elementId: node.elementId,
          id: node.device.id,
          name: node.device.name,
          printServer: node.device.printServer,
          printQueue: node.device.printQueue,
          printShare: node.device.printShare,
        }));
      const computers = nodes
        .filter(
          (node) =>
            node.device.kind === 'COMPUTER' && (node.device.ipAddress || node.device.hostname),
        )
        .slice(0, MAX_COMPUTERS);
      const serverNode = nodes.find((node) => node.device.kind === 'SERVER');
      const serverName =
        serverNode?.device.hostname ||
        serverNode?.device.name ||
        printers.find((printer) => printer.printServer)?.printServer ||
        null;
      const warnings: string[] = [];
      const serverResult: MapTopologyDiscoveryResult['server'] = {
        name: serverName,
        status: 'NOT_CONFIGURED',
        queueCount: 0,
        identityFieldsFilled: [],
        printers: [],
        warnings: [],
      };
      let snapshot: PrintSnapshot | null = null;

      if (serverName) {
        try {
          const server = printServerSchema.parse(serverName);
          const credentialSource = printers.find(
            (printer) =>
              nodes.find((node) => node.device.id === printer.id)?.device.credentialId &&
              normalize(printer.printServer) === normalize(server),
          );
          const credentialId = credentialSource
            ? nodes.find((node) => node.device.id === credentialSource.id)?.device.credentialId
            : null;
          const account = credentialId
            ? await credentials.resolveWindowsPrintServer(credentialId, server)
            : undefined;
          snapshot = await printClient.collect(server, account, 20_000);
          await saveSnapshot(snapshot);
          serverResult.status = 'OK';
          serverResult.queueCount = snapshot.queues.length;
          serverResult.warnings = snapshot.warnings;
          if (serverNode && snapshot.serverIdentity) {
            const observedHost = normalize(snapshot.serverIdentity.hostname);
            const requestedHost = normalize(server);
            if (!observedHost || observedHost.split('.')[0] === requestedHost.split('.')[0])
              serverResult.identityFieldsFilled = await deviceIdentityRepository.fillMissing(
                serverNode.device.id,
                deviceIdentityRepository.fromPrintServerIdentity(snapshot.serverIdentity),
              );
            else
              serverResult.warnings.push(
                'A identidade retornada não coincide com o nome do servidor consultado; os campos não foram alterados.',
              );
          }
          for (const printer of printers) {
            const { queue, fieldsFilled } = await saveQueueIdentity(printer, snapshot);
            if (!queue) continue;
            const queueStatus = queue.status?.trim() || null;
            const normalizedStatus = queueStatus?.toLocaleLowerCase('en-US') ?? '';
            const status = ['normal', 'ready', 'idle'].includes(normalizedStatus)
              ? 'OK'
              : /offline|error|paperout|paperjam|paused|toner|dooropen|blocked/.test(
                    normalizedStatus,
                  )
                ? 'WARNING'
                : 'UNKNOWN';
            const summary =
              status === 'OK'
                ? 'Fila sem alerta informado pelo servidor; impressão física não foi testada.'
                : status === 'WARNING'
                  ? `O servidor informou alerta na fila: ${queueStatus}.`
                  : 'O servidor não informou um estado de fila reconhecido.';
            await monitoringRepository.observe(printer.id, 'PRINT_SERVER', status, summary, {
              server,
              queueName: queue.name,
              shareName: queue.shareName,
              driver: queue.driverName,
              queueStatus,
              portName: queue.portName,
              hostAddress: queue.hostAddress,
              protocol: queue.protocol,
              portNumber: queue.portNumber,
            });
            serverResult.printers.push({
              deviceId: printer.id,
              name: printer.name,
              status,
              queueStatus,
              ipAddress: queue.hostAddress,
              fieldsFilled,
              summary,
            });
            if (serverNode && normalize(printer.printServer) === normalize(server))
              await saveServesConnection(mapId, serverNode.elementId, printer);
          }
        } catch (error) {
          serverResult.status = 'UNAVAILABLE';
          serverResult.warnings.push(
            error instanceof Error ? error.message : 'A leitura do servidor falhou.',
          );
        }
      } else {
        serverResult.warnings.push(
          'Não há servidor ou endereço de servidor cadastrado neste workflow.',
        );
      }

      if (nodes.filter((node) => node.device.kind === 'COMPUTER').length > MAX_COMPUTERS)
        warnings.push(
          `Limite de segurança: foram selecionados no máximo ${MAX_COMPUTERS} computadores deste workflow.`,
        );

      const computerResults: MapTopologyDiscoveryResult['computers'] = [];
      const relations: MapTopologyDiscoveryResult['relations'] = [];
      for (let offset = 0; offset < computers.length; offset += 2) {
        const batch = computers.slice(offset, offset + 2);
        const results = await Promise.all(
          batch.map(async (node) => {
            const host = node.device.ipAddress || node.device.hostname || '';
            try {
              const report: WindowsComputerReport = await computerClient.collect(
                host,
                COMPUTER_TIMEOUT_SECONDS,
              );
              const identityFieldsFilled = await deviceIdentityRepository.fillMissing(
                node.device.id,
                deviceIdentityRepository.fromComputerReport(report),
              );
              const summary = report.printersAvailable
                ? 'Filas instaladas lidas no computador.'
                : 'O computador respondeu, mas as filas instaladas não puderam ser lidas.';
              await monitoringRepository.observe(
                node.device.id,
                'WINDOWS',
                report.printersAvailable ? 'OK' : 'WARNING',
                summary,
                {
                  target: host,
                  identity: report.identity ?? null,
                  networkAdapters: report.networkAdapters ?? [],
                  spooler: report.spooler,
                  printersAvailable: report.printersAvailable,
                  printers: report.printers,
                  warnings: report.warnings,
                },
              );
              const computer = {
                elementId: node.elementId,
                id: node.device.id,
                name: node.device.name,
              };
              const seen = new Set<string>();
              const physicalCandidates = report.printers.filter(
                (printer) => !isVirtualOrFaxQueue(printer),
              );
              if (report.printersAvailable) {
                for (const observed of physicalCandidates) {
                  const signature = `${observed.Name.toLowerCase()}|${observed.ShareName?.toLowerCase() ?? ''}|${observed.ComputerName?.toLowerCase() ?? ''}`;
                  if (seen.has(signature)) continue;
                  seen.add(signature);
                  const match = matchObservedPrinter(observed, printers);
                  if (match.status === 'MATCHED' && match.printer) {
                    const alreadyLinked = await saveObservedRelation(
                      mapId,
                      computer,
                      match.printer,
                    );
                    relations.push({
                      computerId: computer.id,
                      computerName: computer.name,
                      printerId: match.printer.id,
                      printerName: match.printer.name,
                      status: alreadyLinked ? 'ALREADY_LINKED' : 'LINKED',
                      observationStatus: 'OK',
                      summary: `Fila ${observed.Name} observada no computador; vínculo de impressão ${alreadyLinked ? 'já existia' : 'criado'} com base em nome/compartilhamento exato.`,
                    });
                  } else {
                    relations.push({
                      computerId: computer.id,
                      computerName: computer.name,
                      printerId: null,
                      printerName: observed.Name,
                      status: match.status === 'AMBIGUOUS' ? 'AMBIGUOUS' : 'UNMATCHED',
                      observationStatus: match.status === 'AMBIGUOUS' ? 'UNKNOWN' : null,
                      summary:
                        match.status === 'AMBIGUOUS'
                          ? 'Mais de um equipamento cadastrado corresponde à fila; nenhum vínculo automático foi criado.'
                          : 'Fila observada, mas não existe equipamento com identidade suficiente para vinculá-la com segurança.',
                    });
                  }
                }
              }
              return {
                deviceId: node.device.id,
                name: node.device.name,
                host,
                status: report.printersAvailable ? ('OK' as const) : ('PARTIAL' as const),
                installedQueueCount: report.printersAvailable ? report.printers.length : 0,
                ignoredQueueCount: report.printersAvailable
                  ? report.printers.length - physicalCandidates.length
                  : 0,
                identityFieldsFilled,
                warnings: report.warnings,
              };
            } catch (error) {
              return {
                deviceId: node.device.id,
                name: node.device.name,
                host,
                status: 'UNAVAILABLE' as const,
                installedQueueCount: 0,
                ignoredQueueCount: 0,
                identityFieldsFilled: [],
                warnings: [
                  error instanceof Error ? error.message : 'A leitura do computador falhou.',
                ],
              };
            }
          }),
        );
        computerResults.push(...results);
      }
      if (!computers.length)
        warnings.push('Nenhum computador com IP ou hostname está colocado neste workflow.');

      return {
        mapId,
        readOnlySources: true,
        completedAt: new Date().toISOString(),
        server: serverResult,
        computers: computerResults,
        relations,
        warnings,
      };
    },
  };
}

export const topologyDiscoveryService = createTopologyDiscoveryService();
