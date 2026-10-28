import {
  monitorConfigSchema,
  type MonitorConfig,
  type MonitorSource,
  type MonitorDetail,
  type ObservationStatus,
  type IslComputer,
  type PrintSnapshot,
} from '@infra/contracts';
import { monitoringRepository } from './monitoring.repository.js';
import {
  defaultMonitorConfig,
  deviceHealth,
  compareExpectedPrinters,
  computerHealth,
  printerQueueStatus,
  monitorSources,
} from './monitoring.domain.js';
import { isl } from '../support/isl.client.js';
import { windowsComputerClient, validateMonitorHost } from './adapters/windows-computer.client.js';
import { windowsPrintClient } from '../inventory/adapters/windows-print.client.js';
import { printCatalogRepository } from '../inventory/print-catalog.repository.js';
import { credentialsService } from '../credentials/credentials.service.js';
import { tcpClient } from './adapters/tcp.client.js';
import { pingClient } from './adapters/ping.client.js';
import { AppError } from '../../shared/errors.js';

interface Dependencies {
  repository: typeof monitoringRepository;
  isl: Pick<typeof isl, 'list'>;
  windows: typeof windowsComputerClient;
  print: typeof windowsPrintClient;
  tcp: typeof tcpClient;
  ping: typeof pingClient;
  saveSnapshot: typeof printCatalogRepository.save;
  credentials: typeof credentialsService;
}
export function createMonitoringService(input: Partial<Dependencies> = {}) {
  const deps: Dependencies = {
    repository: monitoringRepository,
    isl,
    windows: windowsComputerClient,
    print: windowsPrintClient,
    tcp: tcpClient,
    ping: pingClient,
    saveSnapshot: (snapshot) => printCatalogRepository.save(snapshot),
    credentials: credentialsService,
    ...input,
  };
  const get = async (id: string) => {
    const target = await deps.repository.target(id);
    if (!target) throw new AppError(404, 'Equipamento não encontrado.');
    return target;
  };
  type Target = NonNullable<Awaited<ReturnType<typeof get>>>;
  const configuration = (
    target: Pick<Target, 'monitoring'> & Parameters<typeof defaultMonitorConfig>[0],
  ): MonitorConfig => {
    const defaults = defaultMonitorConfig(target);
    return target.monitoring
      ? monitorConfigSchema.parse(
          Object.fromEntries(
            Object.keys(defaults).map((key) => [
              key,
              target.monitoring![key as keyof NonNullable<Target['monitoring']>],
            ]),
          ),
        )
      : defaults;
  };
  const validate = (target: Target, config: MonitorConfig) => {
    if (config.useIsl && (!target.islComputerId || target.kind !== 'COMPUTER'))
      throw new AppError(400, 'Vincule o computador ao ISL antes de selecionar essa fonte.');
    if (config.useWindows && !['COMPUTER', 'SERVER', 'PDV'].includes(target.kind))
      throw new AppError(400, 'A coleta Windows é destinada a computadores, servidores ou PDVs.');
    if (config.useWindows || config.useTcp)
      validateMonitorHost(target.ipAddress || target.hostname || '');
    if (
      config.usePrintServer &&
      (target.kind !== 'PRINTER' ||
        !target.printServer ||
        (!target.printQueue && !target.printShare))
    )
      throw new AppError(400, 'Cadastre servidor e fila da impressora para monitorá-la.');
  };
  const cache = () => ({
    isl: null as Promise<IslComputer[]> | null,
    servers: new Map<string, Promise<PrintSnapshot>>(),
  });
  const collect = async (target: Target, shared: ReturnType<typeof cache>) => {
    const config = configuration(target);
    const write = async (
      source: MonitorSource,
      task: () => Promise<{
        status: ObservationStatus;
        summary: string;
        data?: Record<string, unknown>;
      }>,
    ) => {
      let result: { status: ObservationStatus; summary: string; data?: Record<string, unknown> };
      try {
        result = await task();
      } catch (error) {
        result = {
          status: 'UNAVAILABLE',
          summary:
            error instanceof AppError
              ? error.message
              : 'A fonte de monitoramento não respondeu. Confira acesso e permissões.',
        };
      }
      await deps.repository.observe(
        target.id,
        source,
        result.status,
        result.summary,
        result.data ?? {},
      );
    };
    try {
      for (const source of monitorSources(config)) {
        await write(source, async () => {
          if (source === 'ISL') {
            shared.isl ??= deps.isl.list('');
            const computer = (await shared.isl).find((row) => row.id === target.islComputerId);
            if (!computer)
              return { status: 'UNKNOWN', summary: 'Computador ausente da lista ISL autorizada.' };
            const state = computer.status.toLowerCase();
            return {
              status: ['online', 'active', 'connected'].includes(state)
                ? 'OK'
                : state === 'offline'
                  ? 'CRITICAL'
                  : 'UNKNOWN',
              summary: `Presença ISL: ${computer.status}.`,
              data: { presence: computer.status },
            };
          }
          if (source === 'WINDOWS') {
            const report = await deps.windows.collect(
              target.ipAddress || target.hostname || '',
              config.timeoutSeconds,
            );
            const relations = compareExpectedPrinters(
              target.assignedPrinters.map((row) => row.printer),
              report.printers,
              report.printersAvailable,
            );
            return {
              ...computerHealth(report, relations),
              data: {
                spooler: report.spooler,
                osCaption: report.osCaption,
                uptimeHours: report.uptimeHours,
                freeMemoryPercent: report.freeMemoryPercent,
                disks: report.disks,
                warnings: report.warnings,
                printersAvailable: report.printersAvailable,
                printers: report.printers.map((printer) => ({
                  name: printer.Name,
                  driver: printer.DriverName,
                  port: printer.PortName,
                  server: printer.ComputerName,
                  share: printer.ShareName,
                })),
                relations,
              },
            };
          }
          if (source === 'PRINT_SERVER') {
            const server = target.printServer!;
            const key = server.toLowerCase();
            if (!shared.servers.has(key))
              shared.servers.set(
                key,
                deps.print
                  .collect(
                    server,
                    target.credentialId
                      ? await deps.credentials.resolveWindowsPrintServer(
                          target.credentialId,
                          server,
                        )
                      : undefined,
                    config.timeoutSeconds * 1000 + 3000,
                  )
                  .then(async (snapshot) => {
                    await deps.saveSnapshot(snapshot);
                    return snapshot;
                  }),
              );
            const snapshot = await shared.servers.get(key)!;
            const queue = snapshot.queues.find(
              (row) =>
                (target.printQueue && row.name.toLowerCase() === target.printQueue.toLowerCase()) ||
                (target.printShare &&
                  row.shareName?.toLowerCase() === target.printShare.toLowerCase()),
            );
            if (!queue)
              return {
                status: 'WARNING',
                summary: 'Fila esperada não encontrada no servidor cadastrado.',
              };
            const data = {
              server,
              queueName: queue.name,
              shareName: queue.shareName,
              driver: queue.driverName,
              queueStatus: queue.status ?? null,
              portName: queue.portName,
              hostAddress: queue.hostAddress,
              protocol: queue.protocol,
              portNumber: queue.portNumber,
            };
            const result = printerQueueStatus(queue.status);
            if (target.approvedDriver && !queue.driverName)
              return {
                status: result.status === 'WARNING' ? 'WARNING' : 'UNKNOWN',
                summary: `${result.summary} Driver não informado para comparação.`,
                data,
              };
            if (
              target.approvedDriver &&
              queue.driverName?.toLowerCase() !== target.approvedDriver.toLowerCase()
            )
              return {
                status: 'WARNING',
                summary: 'Driver da fila difere do padrão cadastrado.',
                data,
              };
            const expectedHost = target.ipAddress || target.printPort;
            if (
              expectedHost &&
              queue.hostAddress &&
              expectedHost.toLowerCase() !== queue.hostAddress.toLowerCase()
            )
              return {
                status: 'WARNING',
                summary: 'Fila e driver encontrados, mas a porta aponta para outro endereço.',
                data: { ...data, expectedHost },
              };
            if (
              target.printProtocol &&
              queue.protocol &&
              target.printProtocol.toLowerCase() !== queue.protocol.toLowerCase()
            )
              return {
                status: 'WARNING',
                summary: 'O protocolo observado na porta difere do cadastro.',
                data: { ...data, expectedProtocol: target.printProtocol },
              };
            if (
              target.printPortNumber &&
              queue.portNumber &&
              target.printPortNumber !== queue.portNumber
            )
              return {
                status: 'WARNING',
                summary: 'A porta TCP observada na fila difere do cadastro.',
                data: { ...data, expectedPortNumber: target.printPortNumber },
              };
            if (
              result.status === 'OK' &&
              ((expectedHost && !queue.hostAddress) ||
                (target.printPortNumber && !queue.portNumber) ||
                (target.printProtocol && !queue.protocol))
            )
              return {
                status: 'UNKNOWN',
                summary: 'Fila observada, mas faltam dados da porta para validar o destino.',
                data: {
                  ...data,
                  expectedHost: expectedHost ?? null,
                  expectedProtocol: target.printProtocol,
                  expectedPortNumber: target.printPortNumber,
                },
              };
            return {
              ...result,
              data,
            };
          }
          const probe = await deps.tcp.probe(
            target.ipAddress || target.hostname || '',
            config.tcpPort!,
            config.timeoutSeconds,
          );
          return {
            status: probe.connected ? 'OK' : 'WARNING',
            summary: probe.connected
              ? 'Porta TCP respondeu; isso não verifica todos os serviços.'
              : 'A porta TCP não respondeu. Isso não comprova que o equipamento inteiro está offline.',
            data: { ...probe, port: config.tcpPort },
          };
        });
      }
    } finally {
      await deps.repository.finish(target.id);
    }
  };
  return {
    async ping(id: string) {
      const target = await get(id);
      const host = validateMonitorHost(target.ipAddress || target.hostname || '');
      const result = await deps.ping.probe(host, target.monitoring?.timeoutSeconds ?? 5);
      const summary = result.reachable
        ? 'O equipamento respondeu ao ping.'
        : 'Sem resposta ao ping; isso não confirma que o equipamento esteja desligado.';
      const status = result.reachable ? 'OK' : 'WARNING';
      await deps.repository.observe(id, 'PING', status, summary, {
        host,
        reachable: result.reachable,
        latencyMs: result.latencyMs,
        reason: result.reason,
      });
      return {
        host,
        ...result,
        status,
        summary,
        checkedAt: new Date().toISOString(),
      };
    },
    async detail(id: string): Promise<MonitorDetail> {
      const target = await get(id);
      const config = configuration(target);
      const [latest, history] = await Promise.all([
        deps.repository.latest([id]),
        deps.repository.history(id),
      ]);
      return {
        config,
        saved: Boolean(target.monitoring),
        health: deviceHealth(id, config, latest),
        history: history.map((row) => ({
          ...row,
          source: row.source as MonitorSource,
          status: row.status as ObservationStatus,
          checkedAt: row.checkedAt.toISOString(),
          data: row.data as Record<string, unknown>,
        })),
        lastRunAt: target.monitoring?.lastRunAt?.toISOString() ?? null,
        nextRunAt: target.monitoring?.enabled ? target.monitoring.nextRunAt.toISOString() : null,
      };
    },
    async configure(id: string, body: unknown) {
      const target = await get(id);
      const config = monitorConfigSchema.parse(body);
      validate(target, config);
      await deps.repository.saveConfig(id, config);
      return this.detail(id);
    },
    async run(id: string) {
      const target = await get(id);
      if (!target.monitoring) throw new AppError(409, 'Salve a configuração antes de coletar.');
      const config = configuration(target);
      validate(target, config);
      if (!monitorSources(config).length)
        throw new AppError(400, 'Selecione pelo menos uma fonte antes de coletar.');
      if (!(await deps.repository.claim(id)))
        throw new AppError(409, 'Já existe uma coleta em andamento.');
      await collect(target, cache());
      return this.detail(id);
    },
    async runDue() {
      const due = await deps.repository.claimDue();
      const shared = cache();
      let collected = 0;
      let failed = 0;
      for (let offset = 0; offset < due.length; offset += 3)
        await Promise.all(
          due.slice(offset, offset + 3).map(async (row) => {
            try {
              const target = await get(row.deviceId);
              if (!target.monitoring?.enabled) {
                await deps.repository.finish(row.deviceId);
                return;
              }
              await collect(target, shared);
              collected++;
            } catch {
              failed++;
              await deps.repository.finish(row.deviceId);
            }
          }),
        );
      return { collected, failed };
    },
    async map(mapId: string, page: number) {
      const result = await deps.repository.mapPage(mapId, page);
      const observations = await deps.repository.latest(result.devices.map((device) => device.id));
      return {
        items: result.devices.map((target) =>
          deviceHealth(
            target.id,
            configuration(target),
            observations.filter((row) => row.deviceId === target.id),
          ),
        ),
        total: result.total,
        page,
        hasNext: page * 100 < result.total,
      };
    },
    async diagnostic(id: string, action: string, content: string) {
      if (!['printer_inventory', 'spooler_status'].includes(action)) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(content.replace(/^\uFEFF/, ''));
      } catch {
        return;
      }
      const target = await get(id);
      if (action === 'printer_inventory') {
        const rows = Array.isArray(parsed) ? parsed : parsed ? [parsed] : [];
        if (rows.length > 2000) return;
        if (
          rows.some(
            (row) =>
              typeof row !== 'object' ||
              row === null ||
              !('Name' in row) ||
              typeof row.Name !== 'string',
          )
        )
          return;
        const printers = rows.map((value) => {
          const row = value as Record<string, unknown>;
          return {
            Name: String(row.Name),
            DriverName: typeof row.DriverName === 'string' ? row.DriverName : null,
            PortName: typeof row.PortName === 'string' ? row.PortName : null,
            ComputerName: typeof row.ComputerName === 'string' ? row.ComputerName : null,
            ShareName: typeof row.ShareName === 'string' ? row.ShareName : null,
          };
        });
        const relations = compareExpectedPrinters(
          target.assignedPrinters.map((row) => row.printer),
          printers,
          true,
        );
        await deps.repository.observe(
          id,
          'ISL_DIAGNOSTIC',
          relations.some((row) => row.status === 'WARNING')
            ? 'WARNING'
            : relations.some((row) => row.status === 'UNKNOWN')
              ? 'UNKNOWN'
              : 'OK',
          'Relatório de filas coletado via ISL no contexto SYSTEM.',
          { relations },
        );
      } else if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'Status' in parsed &&
        typeof parsed.Status === 'string' &&
        parsed.Status.length <= 50
      )
        await deps.repository.observe(
          id,
          'ISL_DIAGNOSTIC',
          parsed.Status.toLowerCase() === 'running'
            ? 'OK'
            : parsed.Status.toLowerCase() === 'stopped'
              ? 'CRITICAL'
              : 'UNKNOWN',
          `Spooler informado pelo ISL: ${parsed.Status}.`,
          { spooler: parsed.Status },
        );
    },
  };
}
export const monitoringService = createMonitoringService();
