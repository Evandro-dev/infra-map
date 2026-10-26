import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Executa somente arquivos fixos dos adaptadores; valores nunca entram no script/argv. */
export async function runWindowsScript(
  file: URL,
  variables: Record<string, string>,
  input: unknown = {},
  timeout = 20_000,
) {
  const script = await readFile(file, 'utf8');
  const allowed = new Set([
    'systemroot',
    'systemdrive',
    'windir',
    'temp',
    'tmp',
    'path',
    'psmodulepath',
    'userprofile',
    'appdata',
    'localappdata',
    'programfiles',
    'programfiles(x86)',
    'programw6432',
    'comspec',
    'processor_architecture',
    'username',
    'userdomain',
    'logonserver',
    'homedrive',
    'homepath',
  ]);
  const environment: NodeJS.ProcessEnv = { ...variables };
  for (const [key, value] of Object.entries(process.env))
    if (allowed.has(key.toLowerCase())) environment[key] = value;
  return new Promise<string>((resolve, reject) => {
    const child = execFile(
      join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'System32',
        'WindowsPowerShell',
        'v1.0',
        'powershell.exe',
      ),
      [
        '-NoProfile',
        '-NonInteractive',
        '-EncodedCommand',
        Buffer.from(script, 'utf16le').toString('base64'),
      ],
      { windowsHide: true, timeout, maxBuffer: 2_000_000, encoding: 'utf8', env: environment },
      (error, output) =>
        error ? reject(Object.assign(error, { stdout: output })) : resolve(output),
    );
    child.stdin?.on('error', () => {
      /* A falha é tratada pelo callback do processo. */
    });
    child.stdin?.end(JSON.stringify(input), 'utf8');
  });
}
