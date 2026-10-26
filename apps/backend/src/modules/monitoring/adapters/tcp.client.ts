import { createConnection } from 'node:net';
import { validateMonitorHost } from './windows-computer.client.js';

export const tcpClient = {
  probe(host: string, port: number, timeoutSeconds: number) {
    validateMonitorHost(host);
    return new Promise<{ connected: boolean; latencyMs: number | null; reason: string | null }>(
      (resolve) => {
        const started = Date.now();
        const socket = createConnection({ host, port });
        let settled = false;
        const done = (connected: boolean, reason: string | null) => {
          if (settled) return;
          settled = true;
          clearTimeout(deadline);
          socket.destroy();
          resolve({ connected, latencyMs: connected ? Date.now() - started : null, reason });
        };
        const deadline = setTimeout(() => done(false, 'TIMEOUT'), timeoutSeconds * 1000);
        socket.once('connect', () => done(true, null));
        socket.once('error', (error: NodeJS.ErrnoException) =>
          done(false, error.code ?? 'NETWORK_ERROR'),
        );
      },
    );
  },
};
