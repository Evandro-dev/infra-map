import { describe, expect, it, vi } from 'vitest';
import { printSnapshotSchema } from '@infra/contracts';
import { createPrintCatalogService } from './print-catalog.service.js';

const snapshot = printSnapshotSchema.parse({
  server: 'SRV-A',
  source: 'WINDOWS',
  collectedAt: '2026-10-25T22:00:00.000Z',
  queues: [],
  ports: [],
  drivers: [],
  warnings: [],
});
function setup() {
  const repository = {
    save: vi.fn().mockResolvedValue({}),
  };
  const client = { available: () => true, collect: vi.fn().mockResolvedValue(snapshot) };
  return { repository, client, service: createPrintCatalogService({ repository, client }) };
}
describe('coleta do servidor de impressão', () => {
  it('envia credenciais somente ao adaptador e não as persiste', async () => {
    const { service, client, repository } = setup();
    const credentials = { username: 'TEST-DOMAIN\\operator', password: 'temporary-test-only' };
    await service.discover('SRV-A', credentials);
    expect(client.collect).toHaveBeenCalledWith('SRV-A', credentials);
    expect(JSON.stringify(repository.save.mock.calls)).not.toContain(credentials.password);
    expect(JSON.stringify(repository.save.mock.calls)).not.toContain(credentials.username);
  });
  it('salva somente uma coleta concluída', async () => {
    const { repository, client, service } = setup();
    expect(await service.discover('SRV-A')).toEqual(snapshot);
    expect(repository.save).toHaveBeenCalledWith(snapshot);
    expect(client.collect).toHaveBeenCalledWith('SRV-A');
  });
  it('preserva a coleta anterior quando o servidor está indisponível', async () => {
    const { repository, client, service } = setup();
    client.collect.mockRejectedValue(new Error('unavailable'));
    await expect(service.discover('SRV-A')).rejects.toThrow('unavailable');
    expect(repository.save).not.toHaveBeenCalled();
  });
  it('recusa comandos, caminhos e intervalos no lugar do nome de servidor', async () => {
    const { service, client } = setup();
    for (const server of [
      'SRV;Remove-Item',
      '\\\\server\\share',
      '192.168.1.0/24',
      '$(anything)',
      'srv with spaces',
    ])
      await expect(service.discover(server)).rejects.toThrow();
    expect(client.collect).not.toHaveBeenCalled();
  });
  it('bloqueia consultas simultâneas ao mesmo servidor e libera após conclusão', async () => {
    const { service, client } = setup();
    let resolve!: (value: typeof snapshot) => void;
    client.collect.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    const first = service.discover('SRV-A');
    await expect(service.discover('srv-a')).rejects.toMatchObject({ statusCode: 409 });
    resolve(snapshot);
    await first;
    await expect(service.discover('SRV-A')).resolves.toEqual(snapshot);
  });
});
