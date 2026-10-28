import { describe, it, expect, vi } from 'vitest';
import { monitorConfigSchema, printSnapshotSchema } from '@infra/contracts';
import { monitoringRepository } from './monitoring.repository.js';
import { createMonitoringService } from './monitoring.service.js';
import { credentialsService } from '../credentials/credentials.service.js';

const config = monitorConfigSchema.parse({ enabled: true, useIsl: true, useWindows: true });
function setup() {
  const target = {
    id: 'pc',
    kind: 'COMPUTER',
    ipAddress: '192.0.2.20',
    hostname: 'PC-RH',
    islComputerId: 'isl-pc',
    printServer: null,
    printQueue: null,
    printShare: null,
    printPortNumber: null,
    monitoring: { ...config, lastRunAt: null, nextRunAt: new Date() },
    assignedPrinters: [],
  };
  const repository = {
    ...monitoringRepository,
    target: vi.fn().mockResolvedValue(target),
    claim: vi.fn().mockResolvedValue(true),
    claimDue: vi.fn().mockResolvedValue([{ deviceId: 'pc' }]),
    finish: vi.fn().mockResolvedValue(undefined),
    observe: vi.fn().mockResolvedValue({}),
    latest: vi.fn().mockResolvedValue([]),
    history: vi.fn().mockResolvedValue([]),
    saveConfig: vi.fn().mockResolvedValue({}),
  };
  const isl = {
    list: vi.fn().mockResolvedValue([{ id: 'isl-pc', name: 'PC-RH', status: 'online' }]),
  };
  const windows = { collect: vi.fn().mockRejectedValue(new Error('sensitive provider error')) };
  const tcp = { probe: vi.fn().mockResolvedValue({ connected: true, latencyMs: 1, reason: null }) };
  const service = createMonitoringService({ repository, isl, windows, tcp });
  return { service, repository, isl, windows, tcp, target };
}
describe('orquestração do monitoramento', () => {
  it('executa ping no IP cadastrado e registra o resultado no histórico', async () => {
    const { repository } = setup();
    const ping = {
      probe: vi.fn().mockResolvedValue({ reachable: true, latencyMs: 2, reason: null }),
    };
    const service = createMonitoringService({ repository, ping });

    await expect(service.ping('pc')).resolves.toMatchObject({
      host: '192.0.2.20',
      reachable: true,
      status: 'OK',
    });
    expect(ping.probe).toHaveBeenCalledWith('192.0.2.20', 5);
    expect(repository.observe).toHaveBeenCalledWith(
      'pc',
      'PING',
      'OK',
      expect.any(String),
      expect.objectContaining({ host: '192.0.2.20', reachable: true, latencyMs: 2 }),
    );
  });

  it.each([
    [null, 'UNKNOWN'],
    ['Outro', 'WARNING'],
    ['Epson', 'OK'],
  ] as const)('interpreta fila do servidor com driver %s como %s', async (driverName, status) => {
    const { repository, target } = setup();
    repository.target.mockResolvedValue({
      ...target,
      kind: 'PRINTER',
      approvedDriver: 'Epson',
      printServer: 'SRV-PRINT',
      printQueue: 'RH',
      printShare: 'RH',
      monitoring: { ...target.monitoring, useIsl: false, useWindows: false, usePrintServer: true },
    });
    const snapshot = printSnapshotSchema.parse({
      server: 'SRV-PRINT',
      source: 'WINDOWS',
      collectedAt: new Date().toISOString(),
      queues: [
        {
          name: 'RH',
          shareName: 'RH',
          driverName,
          portName: null,
          hostAddress: '192.0.2.20',
          protocol: null,
          portNumber: null,
          shared: true,
          location: null,
          status: 'Normal',
        },
      ],
      drivers: [],
      ports: [],
      warnings: [],
    });
    const collect = vi.fn().mockResolvedValue(snapshot);
    const saveSnapshot = vi.fn().mockResolvedValue({});
    const service = createMonitoringService({
      repository,
      print: { available: () => true, collect },
      saveSnapshot,
    });
    await service.run('pc');
    expect(repository.observe).toHaveBeenCalledWith(
      'pc',
      'PRINT_SERVER',
      status,
      expect.any(String),
      expect.objectContaining({ queueName: 'RH', driver: driverName }),
    );
    expect(saveSnapshot).toHaveBeenCalledWith(snapshot);
  });
  it('aproveita o diagnóstico de leitura do ISL sem persistir a saída bruta', async () => {
    const { service, repository } = setup();
    await service.diagnostic(
      'pc',
      'spooler_status',
      '{"Name":"Spooler","Status":"Stopped","Extra":"não persistir"}',
    );
    expect(repository.observe).toHaveBeenCalledWith(
      'pc',
      'ISL_DIAGNOSTIC',
      'CRITICAL',
      expect.any(String),
      { spooler: 'Stopped' },
    );
  });
  it('grava fontes independentes e libera a coleta mesmo quando Windows falha', async () => {
    const { service, repository } = setup();
    await service.run('pc');
    expect(repository.observe).toHaveBeenCalledWith('pc', 'ISL', 'OK', expect.any(String), {
      presence: 'online',
    });
    expect(repository.observe).toHaveBeenCalledWith(
      'pc',
      'WINDOWS',
      'UNAVAILABLE',
      expect.not.stringContaining('sensitive'),
      {},
    );
    expect(repository.finish).toHaveBeenCalledWith('pc');
  });
  it('impede coleta duplicada e configuração de alvos sem endereço', async () => {
    const { service, repository, isl, target } = setup();
    repository.claim.mockResolvedValue(false);
    await expect(service.run('pc')).rejects.toMatchObject({ statusCode: 409 });
    expect(isl.list).not.toHaveBeenCalled();
    target.ipAddress = '';
    target.hostname = '';
    await expect(service.configure('pc', config)).rejects.toMatchObject({ statusCode: 400 });
    expect(repository.saveConfig).not.toHaveBeenCalled();
  });
  it('não consulta rede em dispositivos desativados e compartilha a lista ISL entre alvos do lote', async () => {
    const { service, repository, isl, target } = setup();
    target.monitoring.useWindows = false;
    repository.claimDue.mockResolvedValue([{ deviceId: 'pc' }, { deviceId: 'pc-2' }]);
    expect(await service.runDue()).toEqual({ collected: 2, failed: 0 });
    expect(isl.list).toHaveBeenCalledTimes(1);
    isl.list.mockClear();
    target.monitoring.enabled = false;
    await service.runDue();
    expect(isl.list).not.toHaveBeenCalled();
  });
  it('absorve falha de um alvo sem abandonar o restante do lote', async () => {
    const { service, repository } = setup();
    repository.claimDue.mockResolvedValue([{ deviceId: 'removed' }, { deviceId: 'pc' }]);
    repository.target.mockResolvedValueOnce(null);
    expect(await service.runDue()).toEqual({ collected: 1, failed: 1 });
    expect(repository.finish).toHaveBeenCalledWith('removed');
  });
});

describe('credential-aware print server monitoring', () => {
  it('resolves the credential linked to a device before reading its queue', async () => {
    const { repository, target } = setup();
    repository.target.mockResolvedValue({
      ...target,
      kind: 'PRINTER',
      credentialId: 'credential-id',
      printServer: 'SRV-PRINT',
      printQueue: 'RH',
      printShare: 'RH',
      approvedDriver: 'Epson',
      monitoring: {
        ...target.monitoring,
        useIsl: false,
        useWindows: false,
        usePrintServer: true,
        useTcp: false,
      },
    });
    const snapshot = printSnapshotSchema.parse({
      server: 'SRV-PRINT',
      source: 'WINDOWS',
      collectedAt: new Date().toISOString(),
      queues: [
        {
          name: 'RH',
          shareName: 'RH',
          driverName: 'Epson',
          portName: '192.0.2.20',
          hostAddress: '192.0.2.20',
          protocol: 'RAW',
          portNumber: 9100,
          shared: true,
          location: null,
          status: 'Normal',
        },
      ],
      drivers: [],
      ports: [],
      warnings: [],
    });
    const resolve = vi.fn().mockResolvedValue({
      username: 'DOMAIN\\svc-print',
      password: 'test-only-secret',
    });
    const collect = vi.fn().mockResolvedValue(snapshot);
    const service = createMonitoringService({
      repository,
      credentials: { ...credentialsService, resolveWindowsPrintServer: resolve },
      print: { available: () => true, collect },
      saveSnapshot: vi.fn().mockResolvedValue({}),
    });

    await service.run('pc');

    expect(resolve).toHaveBeenCalledWith('credential-id', 'SRV-PRINT');
    expect(collect).toHaveBeenCalledWith(
      'SRV-PRINT',
      {
        username: 'DOMAIN\\svc-print',
        password: 'test-only-secret',
      },
      8000,
    );
    expect(repository.observe).toHaveBeenCalledWith(
      'pc',
      'PRINT_SERVER',
      'OK',
      expect.any(String),
      expect.objectContaining({ queueName: 'RH', driver: 'Epson' }),
    );
  });
});

describe('print server endpoint verification', () => {
  it('warns when a confirmed queue points to an IP different from inventory', async () => {
    const { repository, target } = setup();
    repository.target.mockResolvedValue({
      ...target,
      kind: 'PRINTER',
      ipAddress: '192.0.2.99',
      printServer: 'SRV-PRINT',
      printQueue: 'RH',
      printShare: 'RH',
      printPort: '192.0.2.99',
      printProtocol: 'RAW',
      printPortNumber: 9100,
      approvedDriver: 'Epson',
      monitoring: {
        ...target.monitoring,
        useIsl: false,
        useWindows: false,
        usePrintServer: true,
        useTcp: false,
      },
    });
    const snapshot = printSnapshotSchema.parse({
      server: 'SRV-PRINT',
      source: 'WINDOWS',
      collectedAt: new Date().toISOString(),
      queues: [
        {
          name: 'RH',
          shareName: 'RH',
          driverName: 'Epson',
          portName: 'IP_192.0.2.20',
          hostAddress: '192.0.2.20',
          protocol: 'RAW',
          portNumber: 9100,
          shared: true,
          location: null,
          status: 'Normal',
        },
      ],
      drivers: [],
      ports: [],
      warnings: [],
    });
    const service = createMonitoringService({
      repository,
      print: { available: () => true, collect: vi.fn().mockResolvedValue(snapshot) },
      saveSnapshot: vi.fn().mockResolvedValue({}),
    });

    await service.run('pc');

    expect(repository.observe).toHaveBeenCalledWith(
      'pc',
      'PRINT_SERVER',
      'WARNING',
      expect.any(String),
      expect.objectContaining({
        server: 'SRV-PRINT',
        queueName: 'RH',
        shareName: 'RH',
        hostAddress: '192.0.2.20',
        expectedHost: '192.0.2.99',
      }),
    );
  });
});
