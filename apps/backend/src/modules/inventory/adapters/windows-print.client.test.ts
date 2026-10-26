import { describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ exec: vi.fn(), end: vi.fn() }));
vi.mock('node:child_process', () => ({ execFile: native.exec }));
import { windowsPrintClient } from './windows-print.client.js';

describe.runIf(process.platform === 'win32')('credenciais temporárias no coletor Windows', () => {
  it('envia o segredo por stdin e mantém argumentos e ambiente sem a senha', async () => {
    native.exec.mockImplementation(
      (
        _file: unknown,
        _args: unknown,
        _options: unknown,
        callback: (error: null, output: string) => void,
      ) => {
        queueMicrotask(() =>
          callback(
            null,
            JSON.stringify({
              server: 'TEST-SERVER',
              source: 'WINDOWS',
              collectedAt: new Date().toISOString(),
              queues: [],
              drivers: [],
              ports: [],
              warnings: [],
            }),
          ),
        );
        return { stdin: { on: vi.fn(), end: native.end } };
      },
    );
    const credentials = { username: 'TEST-DOMAIN\\operator', password: 'test-pipe-only-secret' };
    await windowsPrintClient.collect('TEST-SERVER', credentials);
    expect(JSON.stringify(native.exec.mock.calls[0][1])).not.toContain(credentials.password);
    expect(
      Object.values(native.exec.mock.calls[0][2].env).some(
        (value) => typeof value === 'string' && value.includes(credentials.password),
      ),
    ).toBe(false);
    expect(native.exec.mock.calls[0][2].env.DATABASE_URL).toBeUndefined();
    expect(JSON.parse(native.end.mock.calls[0][0])).toEqual({ credentials });
  });
});
