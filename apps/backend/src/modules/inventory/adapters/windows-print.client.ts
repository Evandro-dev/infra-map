import { runWindowsScript } from '../../../shared/windows-powershell.js';
import {
  printServerSchema,
  printSnapshotSchema,
  type PrintSnapshot,
  type WindowsCredentials,
} from '@infra/contracts';
import { AppError } from '../../../shared/errors.js';

export const windowsPrintClient = {
  available: () => process.platform === 'win32',
  async collect(
    serverName: string,
    credentials?: WindowsCredentials,
    timeout = 20_000,
  ): Promise<PrintSnapshot> {
    const server = printServerSchema.parse(serverName);
    if (!windowsPrintClient.available())
      throw new AppError(
        503,
        'A consulta direta precisa de Windows com o módulo de gerenciamento de impressão. Você pode continuar com o cadastro manual.',
      );
    let stdout: string;
    try {
      stdout = await runWindowsScript(
        new URL('./collect-print-server.ps1', import.meta.url),
        { INFRA_MAP_PRINT_SERVER: server },
        credentials ? { credentials } : {},
        timeout,
      );
    } catch (error) {
      // Não devolver stderr/credenciais/nomes de usuário ao navegador ou ao banco.
      let errorCode: unknown;
      if (
        typeof error === 'object' &&
        error !== null &&
        'stdout' in error &&
        typeof error.stdout === 'string' &&
        error.stdout.length < 4096
      ) {
        try {
          const payload: unknown = JSON.parse(error.stdout.replace(/^\uFEFF/, '').trim());
          if (typeof payload === 'object' && payload !== null && 'errorCode' in payload)
            errorCode = payload.errorCode;
        } catch {
          /* Somente os códigos conhecidos abaixo são publicados. */
        }
      }
      if (errorCode === 'MODULE_UNAVAILABLE')
        throw new AppError(
          503,
          'O módulo PrintManagement não está disponível no Windows que executa o sistema. Use um computador com gerenciamento de impressão para a coleta; a entrada manual continua disponível.',
        );
      if (errorCode === 'WINDOWS_ACCESS_DENIED')
        throw new AppError(
          403,
          'A conta Windows deste computador não tem permissão para consultar o servidor de impressão.',
        );
      if (errorCode === 'SERVER_QUERY_FAILED')
        throw new AppError(
          502,
          'O Windows não conseguiu consultar as filas desse servidor. Confira nome, conexão à rede/VPN, acesso ao domínio e serviço de impressão.',
        );
      throw new AppError(
        502,
        'Não foi possível consultar o servidor. Confira nome, conexão à rede/VPN, permissões do Windows e disponibilidade do módulo PrintManagement. A coleta possui limite de tempo.',
      );
    }
    try {
      const snapshot = printSnapshotSchema.parse(JSON.parse(stdout.replace(/^\uFEFF/, '').trim()));
      if (snapshot.server.toLowerCase() !== server.toLowerCase() || snapshot.source !== 'WINDOWS')
        throw new Error('Fonte divergente');
      return snapshot;
    } catch {
      throw new AppError(
        502,
        'O servidor retornou dados de impressão em formato inesperado. A coleta anterior foi preservada.',
      );
    }
  },
};
