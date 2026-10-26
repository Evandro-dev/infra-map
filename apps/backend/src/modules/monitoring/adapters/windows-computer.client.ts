import { windowsComputerReportSchema } from '@infra/contracts';
import { runWindowsScript } from '../../../shared/windows-powershell.js';
import { AppError } from '../../../shared/errors.js';
import { isIP } from 'node:net';

export function validateMonitorHost(host: string) {
  if (!host || host.length > 180 || (!isIP(host) && !/^[a-z\d](?:[a-z\d.-]*[a-z\d])?$/i.test(host)))
    throw new AppError(400, 'Informe um hostname ou IP válido no cadastro.');
  return host;
}
export const windowsComputerClient = {
  async collect(host: string, timeoutSeconds: number) {
    validateMonitorHost(host);
    if (process.platform !== 'win32')
      throw new AppError(503, 'A coleta Windows exige que a API rode no Windows.');
    try {
      const stdout = await runWindowsScript(
        new URL('./collect-computer-health.ps1', import.meta.url),
        { INFRA_MAP_COMPUTER: host },
        {},
        timeoutSeconds * 1000 + 3000,
      );
      return windowsComputerReportSchema.parse(JSON.parse(stdout.replace(/^\uFEFF/, '').trim()));
    } catch {
      throw new AppError(
        502,
        'Coleta Windows indisponível. Confira acesso ao domínio, permissões CIM/DCOM e o computador de destino.',
      );
    }
  },
};
