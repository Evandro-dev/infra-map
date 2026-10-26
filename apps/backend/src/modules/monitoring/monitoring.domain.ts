import type {
  DeviceHealth,
  MonitorConfig,
  MonitorObservation,
  MonitorSource,
  ObservationStatus,
  PrinterRelationHealth,
  WindowsComputerReport,
} from '@infra/contracts';

interface Target {
  id: string;
  kind: string;
  hostname: string | null;
  ipAddress: string | null;
  islComputerId: string | null;
  printServer: string | null;
  printQueue: string | null;
  printShare: string | null;
  printPortNumber: number | null;
}
interface ExpectedPrinter {
  id: string;
  name: string;
  printServer: string | null;
  printShare: string | null;
  approvedDriver: string | null;
}
export function defaultMonitorConfig(device: Target): MonitorConfig {
  return {
    enabled: false,
    intervalSeconds: 60,
    timeoutSeconds: 5,
    useIsl: device.kind === 'COMPUTER' && Boolean(device.islComputerId),
    useWindows: false,
    usePrintServer:
      device.kind === 'PRINTER' &&
      Boolean(device.printServer && (device.printQueue || device.printShare)),
    useTcp: false,
    tcpPort: device.printPortNumber,
  };
}
export function monitorSources(config: MonitorConfig): MonitorSource[] {
  return [
    ...(config.useIsl ? ['ISL' as const] : []),
    ...(config.useWindows ? ['WINDOWS' as const] : []),
    ...(config.usePrintServer ? ['PRINT_SERVER' as const] : []),
    ...(config.useTcp ? ['TCP' as const] : []),
  ];
}

/** A coleta remota não representa necessariamente o perfil interativo do funcionário. */
export function compareExpectedPrinters(
  expected: ExpectedPrinter[],
  rows: WindowsComputerReport['printers'],
  available: boolean,
): PrinterRelationHealth[] {
  return expected.map((printer) => {
    const result: PrinterRelationHealth = {
      printerId: printer.id,
      printerName: printer.name,
      status: 'UNKNOWN',
      summary: 'Cadastre servidor e compartilhamento para comparar.',
      expectedDriver: printer.approvedDriver,
      observedDriver: null,
    };
    if (!available)
      return {
        ...result,
        summary:
          'Filas indisponíveis para a coleta remota; conferir no perfil do usuário pelo ISL.',
      };
    if (!printer.printServer || !printer.printShare) return result;
    const server = printer.printServer.replace(/^\\+/, '').toLowerCase();
    const share = printer.printShare.toLowerCase();
    const match = rows.find(
      (row) =>
        row.Name.toLowerCase() === `\\\\${server}\\${share}` ||
        (row.ComputerName?.replace(/^\\+/, '').toLowerCase() === server &&
          (row.Name.toLowerCase() === share || row.ShareName?.toLowerCase() === share)),
    );
    if (!match)
      return {
        ...result,
        summary: 'Fila não vista pela coleta remota. Isso não prova ausência no perfil do usuário.',
      };
    if (printer.approvedDriver && !match.DriverName)
      return {
        ...result,
        summary: 'Fila encontrada, mas a coleta não informou o driver para comparação.',
      };
    if (
      printer.approvedDriver &&
      match.DriverName?.toLowerCase() !== printer.approvedDriver.toLowerCase()
    )
      return {
        ...result,
        status: 'WARNING',
        observedDriver: match.DriverName,
        summary: 'O driver observado difere do padrão cadastrado.',
      };
    return {
      ...result,
      status: 'OK',
      observedDriver: match.DriverName,
      summary:
        'Servidor, fila e driver correspondem ao cadastro; impressão física não foi testada.',
    };
  });
}
export function computerHealth(
  report: WindowsComputerReport,
  relations: PrinterRelationHealth[],
): { status: ObservationStatus; summary: string } {
  if (report.spooler?.toLowerCase() === 'stopped')
    return { status: 'CRITICAL', summary: 'O serviço Spooler está parado.' };
  if (report.spooler && report.spooler.toLowerCase() !== 'running')
    return { status: 'WARNING', summary: `O serviço Spooler informou o estado ${report.spooler}.` };
  if (report.disks.some((disk) => disk.freePercent < 5))
    return { status: 'CRITICAL', summary: 'Pelo menos um disco tem menos de 5% de espaço livre.' };
  if (
    report.disks.some((disk) => disk.freePercent < 10) ||
    (report.freeMemoryPercent !== null && report.freeMemoryPercent < 10)
  )
    return { status: 'WARNING', summary: 'Disco ou memória com pouca capacidade livre.' };
  if (relations.some((relation) => relation.status === 'WARNING'))
    return {
      status: 'WARNING',
      summary: 'Há divergência entre driver observado e padrão esperado.',
    };
  if (
    report.warnings.length ||
    !report.spooler ||
    relations.some((relation) => relation.status === 'UNKNOWN')
  )
    return {
      status: 'WARNING',
      summary: 'Coleta parcial; há verificações de impressão pendentes.',
    };
  return {
    status: 'OK',
    summary: 'Serviço, métricas coletadas e configurações verificadas sem alertas.',
  };
}
export function printerQueueStatus(status: string | null | undefined): {
  status: ObservationStatus;
  summary: string;
} {
  if (!status)
    return {
      status: 'UNKNOWN',
      summary: 'Fila encontrada; o servidor não informou um estado reconhecido.',
    };
  const value = status.toLowerCase();
  if (value === 'normal' || value === 'ready' || value === 'idle')
    return {
      status: 'OK',
      summary: 'Fila sem alerta no servidor de impressão. Isso não confirma a impressão física.',
    };
  if (/offline|error|paperout|paperjam|paused|toner|dooropen|notavailable|blocked/.test(value))
    return { status: 'WARNING', summary: `O servidor informou alerta na fila: ${status}.` };
  return { status: 'UNKNOWN', summary: `Estado da fila informado pelo servidor: ${status}.` };
}
export function deviceHealth(
  deviceId: string,
  config: MonitorConfig,
  observations: MonitorObservation[],
  now = new Date(),
): DeviceHealth {
  const selected = monitorSources(config);
  const ageLimit = Math.max(config.intervalSeconds * 3, 90) * 1000;
  const relevant = observations.filter(
    (row) => selected.includes(row.source) || row.source === 'ISL_DIAGNOSTIC',
  );
  const fresh = relevant.filter(
    (row) => now.getTime() - new Date(row.checkedAt).getTime() <= ageLimit,
  );
  const latest =
    relevant
      .map((row) => row.checkedAt)
      .sort()
      .at(-1) ?? null;
  const relationByPrinter = new Map<string, PrinterRelationHealth>();
  for (const row of [...fresh].sort((a, b) => a.checkedAt.localeCompare(b.checkedAt)))
    if (Array.isArray(row.data.relations))
      for (const relation of row.data.relations as PrinterRelationHealth[])
        relationByPrinter.set(relation.printerId, relation);
  const relations = [...relationByPrinter.values()];
  const base = {
    deviceId,
    enabled: config.enabled,
    checkedAt: latest,
    observations: relevant,
    relations,
  };
  if (!config.enabled)
    return { ...base, state: 'DISABLED', summary: 'Monitoramento automático desativado.' };
  if (!fresh.length)
    return {
      ...base,
      state: relevant.length ? 'STALE' : 'UNKNOWN',
      summary: relevant.length
        ? 'Dados antigos; aguardando nova coleta.'
        : 'Aguardando a primeira coleta.',
    };
  const critical = fresh.find((row) => row.status === 'CRITICAL');
  if (critical) return { ...base, state: 'CRITICAL', summary: critical.summary };
  const warning = fresh.find((row) => row.status === 'WARNING');
  if (warning) return { ...base, state: 'WARNING', summary: warning.summary };
  if (selected.some((source) => !fresh.some((row) => row.source === source && row.status === 'OK')))
    return {
      ...base,
      state: fresh.some((row) => row.status === 'OK') ? 'PARTIAL' : 'UNKNOWN',
      summary: 'Há fontes sem leitura válida; confira os detalhes.',
    };
  return { ...base, state: 'OK', summary: 'Fontes configuradas sem alertas na última coleta.' };
}
