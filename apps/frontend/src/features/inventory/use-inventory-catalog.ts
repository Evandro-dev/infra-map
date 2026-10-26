'use client';
import { useEffect, useState } from 'react';
import type { CatalogSummary, DeviceKind } from '@infra/contracts';
import { api } from '@/lib/api';
import { catalogChangedEvent } from './catalog-events';

export function useInventoryCatalog(kind: DeviceKind, server = '') {
  const scope = `${kind}:${server.trim().toLowerCase()}`;
  const [response, setResponse] = useState<{
    scope: string;
    catalog: CatalogSummary | null;
    error: string;
  } | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener(catalogChangedEvent, reload);
    return () => window.removeEventListener(catalogChangedEvent, reload);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      const query = new URLSearchParams({ kind, server: server.trim() });
      void api<CatalogSummary>(`/inventory/catalog?${query}`, { signal: controller.signal })
        .then((value) => {
          if (!controller.signal.aborted) setResponse({ scope, catalog: value, error: '' });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResponse({
              scope,
              catalog: null,
              error: error instanceof Error ? error.message : 'Catálogo indisponível.',
            });
        });
    }, 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [kind, server, scope, revision]);
  return response?.scope === scope
    ? { catalog: response.catalog, error: response.error }
    : { catalog: null, error: '' };
}
