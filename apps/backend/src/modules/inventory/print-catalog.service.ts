import { printServerSchema, type WindowsCredentials, type CatalogSearch } from '@infra/contracts';
import { catalogSearchRepository } from './catalog-search.repository.js';
import { AppError } from '../../shared/errors.js';
import { printCatalogRepository } from './print-catalog.repository.js';
import { windowsPrintClient } from './adapters/windows-print.client.js';

export function createPrintCatalogService(
  dependencies: {
    repository?: typeof printCatalogRepository;
    client?: typeof windowsPrintClient;
  } = {},
) {
  const repository = dependencies.repository ?? printCatalogRepository;
  const client = dependencies.client ?? windowsPrintClient;
  const inFlight = new Map<string, Promise<unknown>>();
  return {
    options: (query: CatalogSearch) => catalogSearchRepository.page(query),
    summary: (server: string) => catalogSearchRepository.summary(server),
    capabilities: () => ({
      available: client.available(),
      method: 'WINDOWS_PRINT_MANAGEMENT',
      timeoutSeconds: 20,
    }),
    async discover(serverName: string, credentials?: WindowsCredentials) {
      const server = printServerSchema.parse(serverName);
      const key = server.toLowerCase();
      if (inFlight.has(key))
        throw new AppError(409, 'Já existe uma coleta deste servidor em andamento.');
      if (inFlight.size >= 2)
        throw new AppError(
          429,
          'Aguarde a conclusão das coletas atuais antes de consultar outro servidor.',
        );
      const operation = (async () => {
        const snapshot = await (credentials
          ? client.collect(server, credentials)
          : client.collect(server));
        await repository.save(snapshot);
        return snapshot;
      })();
      inFlight.set(key, operation);
      try {
        return await operation;
      } finally {
        inFlight.delete(key);
      }
    },
  };
}
export const printCatalogService = createPrintCatalogService();
