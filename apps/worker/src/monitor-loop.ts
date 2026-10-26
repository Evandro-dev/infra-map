/** Um ciclo por vez: timeouts e falhas não iniciam coletas concorrentes no mesmo worker. */
export async function runMonitorLoop({
  signal,
  collect,
  pause,
  onFailure,
}: {
  signal: AbortSignal;
  collect: () => Promise<void>;
  pause: () => Promise<void>;
  onFailure: () => void;
}) {
  let failed = false;
  while (!signal.aborted) {
    try {
      await collect();
      failed = false;
    } catch {
      if (signal.aborted) break;
      if (!failed) onFailure();
      failed = true;
    }
    try {
      await pause();
    } catch {
      if (signal.aborted) break;
      throw new Error('Falha ao aguardar o próximo ciclo de monitoramento.');
    }
  }
}
