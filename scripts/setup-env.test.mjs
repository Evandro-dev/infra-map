import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setupEnvironment } from './setup-env-core.mjs';

let workspace;

beforeEach(() => {
  workspace = mkdtempSync(path.join(tmpdir(), 'infra-map-setup-'));
  mkdirSync(path.join(workspace, 'apps', 'backend'), { recursive: true });
});

afterEach(() => {
  rmSync(workspace, { recursive: true, force: true });
});

function envPaths() {
  return {
    rootFile: path.join(workspace, '.env'),
    backendFile: path.join(workspace, 'apps', 'backend', '.env'),
  };
}

function readVariable(contents, name) {
  return contents.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1];
}

const quietLogger = { log: vi.fn() };

describe('local environment setup', () => {
  it('creates missing secrets, then preserves them on later setup runs', () => {
    const paths = envPaths();
    const environment = {
      DB_USER: 'local_user',
      DB_PASSWORD: 'local_password',
      DB_NAME: 'local_db',
    };

    setupEnvironment({ ...paths, environment, logger: quietLogger });
    const originalRoot = readFileSync(paths.rootFile, 'utf8');
    const originalBackend = readFileSync(paths.backendFile, 'utf8');
    const supportToken = readVariable(originalBackend, 'SUPPORT_OPERATOR_TOKEN');
    const encryptionKey = readVariable(originalBackend, 'CREDENTIALS_ENCRYPTION_KEY');

    expect(supportToken).toMatch(/^[a-f\d]{64}$/i);
    expect(Buffer.from(encryptionKey, 'base64')).toHaveLength(32);
    expect(quietLogger.log.mock.calls.flat().join('\n')).not.toContain(supportToken);
    expect(quietLogger.log.mock.calls.flat().join('\n')).not.toContain(encryptionKey);

    setupEnvironment({ ...paths, environment, logger: quietLogger });

    expect(readFileSync(paths.rootFile, 'utf8')).toBe(originalRoot);
    expect(readFileSync(paths.backendFile, 'utf8')).toBe(originalBackend);
  });

  it('fills blank support and encryption keys while preserving other backend settings', () => {
    const paths = envPaths();
    writeFileSync(paths.rootFile, 'DB_USER=user\nDB_PASSWORD=password\nDB_NAME=infra_map\n');
    writeFileSync(
      paths.backendFile,
      'API_PORT=4001\r\nSUPPORT_OPERATOR_TOKEN=  \r\nCREDENTIALS_ENCRYPTION_KEY=\r\n',
    );

    setupEnvironment({
      ...paths,
      environment: { DB_USER: 'user', DB_PASSWORD: 'password', DB_NAME: 'infra_map' },
      logger: quietLogger,
    });

    const backend = readFileSync(paths.backendFile, 'utf8');
    expect(readVariable(backend, 'API_PORT')).toBe('4001');
    expect(readVariable(backend, 'SUPPORT_OPERATOR_TOKEN')).toMatch(/^[a-f\d]{64}$/i);
    expect(Buffer.from(readVariable(backend, 'CREDENTIALS_ENCRYPTION_KEY'), 'base64')).toHaveLength(
      32,
    );
    expect(backend.match(/CREDENTIALS_ENCRYPTION_KEY=[^\r\n]+\r?\n/)).toBeTruthy();
  });

  it('preserves configured secrets and refuses to infer database values from an incomplete setup', () => {
    const paths = envPaths();
    writeFileSync(paths.rootFile, 'DB_USER=user\n');
    writeFileSync(
      paths.backendFile,
      'SUPPORT_OPERATOR_TOKEN=existing-support-token\nCREDENTIALS_ENCRYPTION_KEY=existing-encryption-key\n',
    );

    setupEnvironment({ ...paths, environment: {}, logger: quietLogger });

    expect(readFileSync(paths.backendFile, 'utf8')).toContain(
      'SUPPORT_OPERATOR_TOKEN=existing-support-token',
    );
    expect(readFileSync(paths.backendFile, 'utf8')).toContain(
      'CREDENTIALS_ENCRYPTION_KEY=existing-encryption-key',
    );

    const missingBackend = path.join(workspace, 'apps', 'backend', 'missing.env');
    expect(() =>
      setupEnvironment({
        rootFile: paths.rootFile,
        backendFile: missingBackend,
        environment: {},
        logger: quietLogger,
      }),
    ).toThrow('DB_USER, DB_PASSWORD e DB_NAME');
  });
});
