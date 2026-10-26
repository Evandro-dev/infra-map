import { expect, it, vi } from 'vitest';
import { runMonitorLoop } from './monitor-loop.js';
it('aguarda cada ciclo, continua após falha e encerra sem iniciar uma nova coleta', async () => {
  const controller = new AbortController();
  let cycles = 0;
  const collect = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  const onFailure = vi.fn();
  await runMonitorLoop({
    signal: controller.signal,
    collect,
    onFailure,
    pause: async () => {
      cycles++;
      if (cycles === 2) controller.abort();
    },
  });
  expect(collect).toHaveBeenCalledTimes(2);
  expect(onFailure).toHaveBeenCalledTimes(1);
});
