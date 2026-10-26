import { describe, it, expect, vi } from 'vitest';
import { monitorConfigSchema, printSnapshotSchema } from '@infra/contracts';
import { monitoringRepository } from './monitoring.repository.js';
import { createMonitoringService } from './monitoring.service.js';

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
          hostAddress: null,
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
