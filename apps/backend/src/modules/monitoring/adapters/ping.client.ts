import { execFile } from 'node:child_process';
import { AppError } from '../../../shared/errors.js';

function extractLatency(output: string) {
  const match = output.match(/time[=<]\s*([\d.]+)\s*ms/i);
  return match ? Number(match[1]) : null;
}

export const pingClient = {
  async probe(host: string, timeoutSeconds: number) {
    const windows = process.platform === 'win32';
    const args = windows
      ? ['-n', '1', '-w', String(timeoutSeconds * 1000), host]
      : ['-c', '1', '-W', String(timeoutSeconds), host];
    try {
      const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>(
        (resolve, reject) => {
          execFile(
            'ping',
            args,
            {
              timeout: timeoutSeconds * 1000 + 1000,
              windowsHide: true,
              maxBuffer: 8192,
              encoding: 'utf8',
            },
            (error, output, errorOutput) => {
              if (error) {
                Object.assign(error, {
                  stdout: String(output),
                  stderr: String(errorOutput),
                });
                reject(error);
                return;
              }
              resolve({ stdout: String(output), stderr: String(errorOutput) });
            },
          );
        },
      );
      const output = `${stdout}\n${stderr}`;
      return { reachable: true, latencyMs: extractLatency(output), reason: null };
    } catch (error) {
      const commandError = error as NodeJS.ErrnoException & {
        killed?: boolean;
        stdout?: string;
        stderr?: string;
      };
      if (typeof commandError.code === 'number' || commandError.killed)
        return {
          reachable: false,
          latencyMs: null,
          reason: commandError.killed ? 'timeout' : 'no_reply',
        };
      if (commandError.code === 'ENOENT')
        throw new AppError(503, 'O comando de ping não está disponível no servidor da API.');
      throw new AppError(503, 'Não foi possível executar o ping neste ambiente.');
    }
  },
};
