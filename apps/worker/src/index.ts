import '@infra/config';
import { setTimeout } from 'node:timers/promises';
import { runMonitorLoop } from './monitor-loop.js';

const stop = new AbortController();
process.once('SIGINT', () => stop.abort());
process.once('SIGTERM', () => stop.abort());
const port = Number(process.env.API_PORT ?? 4000);
const token = process.env.SUPPORT_OPERATOR_TOKEN ?? '';
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('API_PORT inválida.');
if (!token) {
  console.log('[monitor] Configure SUPPORT_OPERATOR_TOKEN no backend para iniciar o agendador.');
} else {
  let fullBatch = false;
  console.log(
    '[monitor] Agendador iniciado. Apenas equipamentos com monitoramento habilitado serão consultados.',
  );
  await runMonitorLoop({
    signal: stop.signal,
    collect: async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/v1/monitoring/run-due`, {
        method: 'POST',
        headers: { 'x-support-token': token },
        signal: AbortSignal.any([stop.signal, AbortSignal.timeout(100_000)]),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result = (await response.json()) as { collected: number; failed: number };
      fullBatch = result.collected + result.failed >= 3;
      if (result.failed) throw new Error('Há coletas pendentes. Confira a API e as configurações.');
    },
    pause: () => setTimeout(fullBatch ? 1_000 : 15_000, undefined, { signal: stop.signal }),
    onFailure: () =>
      console.log(
        '[monitor] API indisponível ou coleta incompleta; nova tentativa no próximo ciclo.',
      ),
  });
}
