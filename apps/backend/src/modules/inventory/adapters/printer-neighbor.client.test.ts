import { describe, expect, it, vi } from 'vitest';
import { createPrinterNeighborClient } from './printer-neighbor.client.js';

describe('consulta limitada de vizinhos de impressora', () => {
  it('envia somente IPs IPv4 deduplicados ao script fixo de leitura', async () => {
    const run = vi.fn().mockResolvedValue(
      '[{"ipAddress":"192.0.2.20","reachable":true,"macAddress":"02:11:22:33:44:55","interfaceAlias":"Ethernet","neighborState":"Reachable"}]',
    );
    const client = createPrinterNeighborClient(run, 'win32');
    await expect(client.collect(['192.0.2.20', '192.0.2.20'])).resolves.toMatchObject([
      { ipAddress: '192.0.2.20', reachable: true, macAddress: '02:11:22:33:44:55' },
    ]);
    expect(run).toHaveBeenCalledWith(
      expect.any(URL),
      { INFRA_MAP_NEIGHBOR_IPS: '["192.0.2.20"]' },
      {},
      5000,
    );
  });

  it('rejeita destinos que não sejam IPs IPv4 cadastrados', async () => {
    const client = createPrinterNeighborClient(vi.fn(), 'win32');
    await expect(client.collect(['srv-sky-prt-01'])).rejects.toMatchObject({ statusCode: 400 });
  });

  it('não inicia consultas sem uma lista explícita de alvos', async () => {
    const run = vi.fn();
    const client = createPrinterNeighborClient(run, 'win32');
    await expect(client.collect([])).resolves.toEqual([]);
    expect(run).not.toHaveBeenCalled();
  });
});
