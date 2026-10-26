'use client';
import { useEffect, useState } from 'react';
import type { DeviceHealth } from '@infra/contracts';
import { api } from '@/lib/api';
export function useMapMonitoring(mapId: string | undefined, revision: number) {
  const [result, setResult] = useState<{ mapId: string; items: Record<string, DeviceHealth> }>({
    mapId: '',
    items: {},
  });
  useEffect(() => {
    if (!mapId) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const items: Record<string, DeviceHealth> = {};
        let page = 1;
        let more = true;
        while (more && !controller.signal.aborted) {
          const response = await api<{ items: DeviceHealth[]; hasNext: boolean }>(
            `/monitoring/maps/${encodeURIComponent(mapId)}?page=${page}`,
            { signal: controller.signal, cache: 'no-store' },
          );
          for (const health of response.items) items[health.deviceId] = health;
          more = response.hasNext;
          page++;
        }
        if (!controller.signal.aborted) setResult({ mapId, items });
      } catch {
        if (!controller.signal.aborted)
          setResult((previous) =>
            previous.mapId !== mapId
              ? previous
              : {
                  ...previous,
                  items: Object.fromEntries(
                    Object.entries(previous.items).map(([id, health]) => [
                      id,
                      health.enabled
                        ? {
                            ...health,
                            state: 'STALE',
                            summary:
                              'Não foi possível atualizar as leituras. Exibindo a última coleta.',
                          }
                        : health,
                    ]),
                  ),
                },
          );
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 15_000);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [mapId, revision]);
  return result.mapId === mapId ? result.items : {};
}
