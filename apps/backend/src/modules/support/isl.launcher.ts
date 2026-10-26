import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors.js';

export const islLauncher = {
  ready: () =>
    process.platform === 'win32' && Boolean(env.ISL_LIGHT_EXE) && existsSync(env.ISL_LIGHT_EXE),
  async open(computerId: string) {
    if (!islLauncher.ready())
      throw new AppError(
        409,
        'Configure o ISL Light instalado no Windows onde a API está rodando.',
      );
    await new Promise<void>((resolve, reject) => {
      // Senhas nunca entram na linha de comando. A janela é interativa por solicitação do operador.
      const child = spawn(env.ISL_LIGHT_EXE, ['--connect', computerId], {
        detached: true,
        stdio: 'ignore',
        windowsHide: false,
      });
      child.once('error', () =>
        reject(
          new AppError(
            502,
            'Não foi possível iniciar o ISL Light. Confira o executável configurado.',
          ),
        ),
      );
      child.once('spawn', () => {
        child.unref();
        resolve();
      });
    });
  },
};
