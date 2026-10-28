import { describe, expect, it, vi } from 'vitest';
import { createSupportService } from './support.service.js';
import { supportRepository } from './support.repository.js';

const device = {
  id: 'device',
  name: 'PC-RH',
  kind: 'COMPUTER',
  islComputerId: 'co-id',
  islComputerName: 'PC-RH',
  model: null,
  ipAddress: null,
  assetTag: null,
  manufacturer: null,
  serialNumber: null,
  macAddress: null,
  hostname: null,
  operatingSystem: null,
  assignedUser: null,
  notes: null,
  printServer: null,
  printShare: null,
  approvedDriver: null,
  createdAt: new Date(),
};
const record = {
  id: 'job',
  deviceId: device.id,
  action: 'spooler_status',
  status: 'STARTING',
  providerActionId: null,
  resultSummary: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const execution = {
  action: 'spooler_status' as const,
  accessPassword: 'never-persist',
  confirm: true as const,
  confirmDataLoss: false,
};
function setup(enabled = true) {
  const repository = {
    ...supportRepository,
    byId: vi.fn().mockResolvedValue(device),
    startJob: vi.fn().mockResolvedValue(record),
    job: vi.fn().mockResolvedValue(record),
    updateJob: vi.fn().mockImplementation(async (_id, change) => ({ ...record, ...change })),
  };
  const client = {
    list: vi.fn().mockResolvedValue([]),
    actionStart: vi.fn().mockResolvedValue({ action_id: 'remote-id' }),
    actionInfo: vi.fn().mockResolvedValue({ computers: [{ chmd5: 'challenge' }] }),
    actionAuthenticate: vi.fn().mockResolvedValue({}),
    downloadResult: vi.fn().mockResolvedValue('{}'),
  };
  const wait = vi.fn().mockResolvedValue(undefined);
  const service = createSupportService({
    repository,
    client,
    wait,
    recordDiagnostic: vi.fn().mockResolvedValue(undefined),
    config: {
      ISL_MODE: 'hosted',
      ISL_API_USERNAME: 'integration',
      ISL_API_PASSWORD: 'password',
      ISL_SERVER_URL: '',
      ISL_REMOTE_EXEC_ENABLED: enabled ? 'true' : 'false',
    },
  });
  return { service, repository, client, wait };
}

describe('regras do suporte', () => {
  it('bloqueia execução desabilitada antes de tocar no banco ou ISL', async () => {
    const { service, repository, client } = setup(false);
    await expect(service.execute('device', execution)).rejects.toMatchObject({ statusCode: 403 });
    expect(repository.startJob).not.toHaveBeenCalled();
    expect(client.actionStart).not.toHaveBeenCalled();
  });
  it('exige confirmação adicional para apagar trabalhos de impressão', async () => {
    const { service, client } = setup();
    await expect(
      service.execute('device', { ...execution, action: 'clear_spooler' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(client.actionStart).not.toHaveBeenCalled();
  });
  it('aguarda desafio assíncrono, preserva ID e não persiste senhas', async () => {
    const { service, client, repository, wait } = setup();
    client.actionInfo.mockResolvedValueOnce({ computers: [] });
    await expect(service.execute('device', execution)).resolves.toMatchObject({
      status: 'SUBMITTED',
    });
    expect(wait).toHaveBeenCalledTimes(1);
    expect(repository.updateJob.mock.calls[0]).toEqual(['job', { providerActionId: 'remote-id' }]);
    expect(JSON.stringify(repository.updateJob.mock.calls)).not.toContain('never-persist');
    expect(client.actionAuthenticate).toHaveBeenCalledWith(
      'co-id',
      'remote-id',
      'challenge',
      'never-persist',
    );
  });
  it('mantém operação inconclusiva para conferência e não registra mensagens de erro sensíveis', async () => {
    const { service, client, repository } = setup();
    client.actionAuthenticate.mockRejectedValue(new Error('never-persist'));
    await expect(service.execute('device', execution)).rejects.toMatchObject({ statusCode: 502 });
    expect(repository.updateJob).toHaveBeenCalledWith(
      'job',
      expect.objectContaining({ status: 'REVIEW_REQUIRED' }),
    );
    expect(JSON.stringify(repository.updateJob.mock.calls)).not.toContain('never-persist');
  });
  it('não transforma erro histórico em execução enviada ao consultar status', async () => {
    const { service, client, repository } = setup();
    repository.job.mockResolvedValue({
      ...record,
      status: 'FAILED',
      providerActionId: 'remote-id',
    });
    expect((await service.job('job')).status).toBe('FAILED');
    expect(client.actionInfo).not.toHaveBeenCalled();
  });
  it('ausência na lista autorizada não significa OFFLINE', async () => {
    const { service, repository } = setup();
    expect(await service.presence('device')).toMatchObject({ source: 'ISL', computer: null });
    expect(repository.updateJob).not.toHaveBeenCalled();
  });
});
