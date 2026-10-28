import { afterAll, describe, expect, it, vi } from 'vitest';

vi.mock('./config/env.js', () => ({
  env: {
    CORS_ORIGIN: 'http://localhost:3000',
    ISL_MODE: 'disabled',
    ISL_API_USERNAME: '',
    ISL_API_PASSWORD: '',
    ISL_REMOTE_EXEC_ENABLED: 'false',
    SUPPORT_OPERATOR_TOKEN: 'test-operator-key-at-least-32-characters',
    CREDENTIALS_ENCRYPTION_KEY: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    ISL_LIGHT_EXE: '',
  },
}));
vi.mock('@infra/database', () => ({
  prisma: {
    $disconnect: vi.fn().mockResolvedValue(undefined),
    $queryRaw: vi.fn().mockResolvedValue([{ value: 1 }]),
    device: { findUnique: vi.fn().mockResolvedValue(null) },
    managedCredential: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({
        id: 'credential-1',
        provider: 'WINDOWS_PRINT_SERVER',
        name: 'Print Server account',
        targetServer: 'srv-sky-prt-01',
        createdAt: new Date('2026-10-28T12:00:00.000Z'),
        updatedAt: new Date('2026-10-28T12:00:00.000Z'),
      }),
    },
  },
}));
import { buildApp } from './app.js';
import { prisma } from '@infra/database';
import { printCatalogService } from './modules/inventory/print-catalog.service.js';

const app = await buildApp({ logger: false });
afterAll(() => app.close());
const headers = { 'x-support-token': 'test-operator-key-at-least-32-characters' };

describe('API HTTP', () => {
  it('explains which local secret authorizes the credentials vault', async () => {
    const missingToken = await app.inject({ url: '/api/v1/credentials' });
    const encryptionKey = await app.inject({
      url: '/api/v1/credentials',
      headers: { 'x-support-token': 'test-only-encryption-key' },
    });
    const supportToken = await app.inject({ url: '/api/v1/credentials', headers });

    expect(missingToken.statusCode).toBe(401);
    expect(missingToken.json().error).toContain('SUPPORT_OPERATOR_TOKEN');
    expect(missingToken.json().error).not.toContain('CREDENTIALS_ENCRYPTION_KEY');
    expect(encryptionKey.statusCode).toBe(401);
    expect(supportToken.statusCode).toBe(200);
    expect(supportToken.json()).toEqual({ credentials: [] });
  });
  it('accepts UNC print server names and UPN style Windows accounts', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/credentials',
      headers,
      payload: {
        provider: 'WINDOWS_PRINT_SERVER',
        name: 'Print Server account',
        targetServer: '\\\\srv-sky-prt-01',
        username: 'operator@corp.example',
        password: 'test-only-secret',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: 'credential-1',
      targetServer: 'srv-sky-prt-01',
    });
    expect(response.json()).not.toHaveProperty('username');
    expect(response.json()).not.toHaveProperty('password');
  });
  it('protege configuração e execução do monitoramento e limita a paginação', async () => {
    for (const [method, url] of [
      ['GET', '/devices/pc'],
      ['PUT', '/devices/pc'],
      ['POST', '/devices/pc/run'],
      ['POST', '/run-due'],
    ] as const) {
      expect((await app.inject({ method, url: '/api/v1/monitoring' + url })).statusCode).toBe(401);
    }
    expect((await app.inject('/api/v1/monitoring/maps/map?page=0')).statusCode).toBe(400);
  });
  it('retorna apenas contagens da coleta, sem enviar as listas completas ao navegador', async () => {
    vi.spyOn(printCatalogService, 'discover').mockResolvedValueOnce({
      server: 'TEST-SERVER',
      source: 'WINDOWS',
      collectedAt: '2026-10-25T22:00:00.000Z',
      referenceDate: null,
      queues: [],
      ports: [],
      drivers: [],
      warnings: [],
    });
    const result = await app.inject({
      method: 'POST',
      url: '/api/v1/inventory/print-discovery',
      headers,
      payload: { server: 'TEST-SERVER' },
    });
    expect(result.statusCode).toBe(200);
    expect(result.json()).toMatchObject({ queueCount: 0, driverCount: 0, portCount: 0 });
    expect(result.json()).not.toHaveProperty('queues');
  });
  it('protege todos os caminhos administrativos antes de consultar o inventário', async () => {
    for (const url of [
      '/settings',
      '/computers',
      '/devices/pc',
      '/devices/pc/presence',
      '/jobs/job',
      '/jobs/job/result',
    ]) {
      expect((await app.inject({ method: 'GET', url: '/api/v1/support' + url })).statusCode).toBe(
        401,
      );
    }
    expect(prisma.device.findUnique).not.toHaveBeenCalled();
  });
  it('aceita POST sem corpo para abrir ISL e responde 404 para dispositivo ausente', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/support/devices/absent/open-isl',
      headers,
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: 'Equipamento não encontrado.' });
  });
  it('valida o contrato antes de iniciar uma ação remota', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/support/devices/pc/actions',
      headers,
      payload: { action: 'shell', command: 'anything' },
    });
    expect(response.statusCode).toBe(400);
  });
  it('exige chave para consultar o Windows e recusa alvos inválidos', async () => {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/inventory/print-discovery',
          payload: { server: 'SRV-A' },
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/inventory/print-discovery',
          headers,
          payload: { server: 'SRV;CMD' },
        })
      ).statusCode,
    ).toBe(400);
    expect(
      (await app.inject({ url: '/api/v1/inventory/print-discovery/capabilities' })).statusCode,
    ).toBe(401);
  });
  it('relata readiness do banco separada da existência do processo', async () => {
    expect((await app.inject('/health')).json()).toMatchObject({ ok: true });
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error('database unavailable'));
    expect((await app.inject('/health/ready')).statusCode).toBe(503);
  });
});
