import { isIP } from 'node:net';
import { z } from 'zod';
import { AppError } from '../../../shared/errors.js';
import { runWindowsScript } from '../../../shared/windows-powershell.js';

const neighborResultSchema = z
  .object({
    ipAddress: z.ipv4(),
    reachable: z.boolean(),
    macAddress: z.string().max(40).nullable(),
    interfaceAlias: z.string().max(180).nullable(),
    neighborState: z.string().max(40).nullable(),
  })
  .strict();

export function createPrinterNeighborClient(
  run: typeof runWindowsScript = runWindowsScript,
  platform = process.platform,
) {
  return {
    available: () => platform === 'win32',
    async collect(addresses: string[]) {
      const targets = [...new Set(addresses)];
      if (targets.length > 20) throw new AppError(400, 'A consulta de vizinhança aceita até 20 IPs.');
      if (targets.some((address) => isIP(address) !== 4))
        throw new AppError(400, 'A consulta de vizinhança aceita somente endereços IPv4 cadastrados.');
      if (!targets.length) return [];
      if (platform !== 'win32')
        throw new AppError(503, 'A leitura da tabela de vizinhos exige que a API rode no Windows.');
      try {
        const stdout = await run(
          new URL('./collect-printer-neighbors.ps1', import.meta.url),
          { INFRA_MAP_NEIGHBOR_IPS: JSON.stringify(targets) },
          {},
          targets.length * 2000 + 3000,
        );
        const payload = JSON.parse(stdout.replace(/^\uFEFF/, '').trim()) as unknown;
        const rows = Array.isArray(payload) ? payload : payload ? [payload] : [];
        return z.array(neighborResultSchema).max(20).parse(rows);
      } catch {
        throw new AppError(
          502,
          'Não foi possível consultar os vizinhos dos IPs informados no Windows da API.',
        );
      }
    },
  };
}

export const printerNeighborClient = createPrinterNeighborClient();
