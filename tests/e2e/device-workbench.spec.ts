import { randomUUID } from 'node:crypto';
import { prisma } from '@infra/database';
import { test, expect } from '@playwright/test';

const operatorKey = 'e2e-test-key-at-least-thirty-two-characters';

test('tela do dispositivo aceita o IP inteiro e mostra o resultado do Ping', async ({
  page,
  request,
}) => {
  const testId = `device-workbench-${randomUUID()}`;
  const deviceIds: string[] = [];
  let credentialId: string | undefined;
  let mapId: string | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  try {
    const mapResponse = await request.post('/api/v1/maps', {
      data: { name: testId, widthMeters: 80, heightMeters: 50 },
    });
    expect(mapResponse.ok()).toBe(true);
    mapId = (await mapResponse.json()).id;

    const computerResponse = await request.post('/api/v1/devices', {
      data: { name: `${testId}-computer`, kind: 'COMPUTER', ipAddress: '127.0.0.1' },
    });
    expect(computerResponse.ok()).toBe(true);
    const computerId = (await computerResponse.json()).id as string;
    deviceIds.push(computerId);

    const printerResponse = await request.post('/api/v1/devices', {
      data: {
        name: `${testId}-printer`,
        kind: 'PRINTER',
        ipAddress: '127.0.0.1',
        printServer: 'e2e-print-server',
        printShare: `${testId}-share`,
        printQueue: `${testId}-queue`,
      },
    });
    expect(printerResponse.ok()).toBe(true);
    const printerId = (await printerResponse.json()).id as string;
    deviceIds.push(printerId);
    const credentialResponse = await request.post('/api/v1/credentials', {
      headers: { 'x-support-token': operatorKey },
      data: {
        provider: 'WINDOWS_PRINT_SERVER',
        name: testId,
        targetServer: 'e2e-print-server',
        username: 'e2e-user',
        password: 'test-only-secret',
      },
    });
    expect(credentialResponse.ok()).toBe(true);
    credentialId = (await credentialResponse.json()).id as string;
    const credentialAssignment = await request.patch(`/api/v1/devices/${printerId}`, {
      data: {
        printServer: 'e2e-print-server',
        printShare: `${testId}-share`,
        printQueue: `${testId}-queue`,
        credentialId,
      },
    });
    expect(credentialAssignment.ok(), await credentialAssignment.text()).toBe(true);

    const computerNodeId = `${testId}-computer-node`;
    const printerNodeId = `${testId}-printer-node`;
    const layoutResponse = await request.put(`/api/v1/maps/${mapId}/layout`, {
      data: {
        name: testId,
        widthMeters: 80,
        heightMeters: 50,
        elements: [
          {
            id: computerNodeId,
            deviceId: computerId,
            parentId: null,
            kind: 'DEVICE',
            name: `${testId}-computer`,
            iconKey: null,
            xMeters: 15,
            yMeters: 15,
            widthMeters: 3,
            heightMeters: 3,
            level: 0,
          },
          {
            id: printerNodeId,
            deviceId: printerId,
            parentId: null,
            kind: 'DEVICE',
            name: `${testId}-printer`,
            iconKey: null,
            xMeters: 45,
            yMeters: 15,
            widthMeters: 3,
            heightMeters: 3,
            level: 0,
          },
        ],
      },
    });
    expect(layoutResponse.ok()).toBe(true);

    const connectionResponse = await request.post(`/api/v1/maps/${mapId}/connections`, {
      data: { sourceElementId: computerNodeId, targetElementId: printerNodeId },
    });
    expect(connectionResponse.ok()).toBe(true);

    await page.goto(`/workflow/${mapId}/${printerNodeId}`);
    await expect(page.getByText('INPUTS', { exact: true })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Parameters' })).toBeVisible();
    await expect(page.getByText('OUTPUT', { exact: true })).toBeVisible();
    await expect(page.getByText(`${testId}-computer`, { exact: true })).toBeVisible();

    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByLabel('Chave do operador', { exact: true }).fill(operatorKey);
    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Acesso ao monitoramento liberado' }),
    ).toBeVisible();

    const ipField = page.getByRole('textbox', {
      name: 'Endereço IP do equipamento',
      exact: true,
    });
    await expect(ipField).toHaveValue('127.0.0.1');
    await ipField.fill('192.168.27.201');
    await expect(ipField).toHaveValue('192.168.27.201');

    await page.getByRole('button', { name: 'Ping', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: /respondeu ao ping|Sem resposta ao ping/i }),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('article').filter({ hasText: 'Ping' }).first()).toBeVisible();

    await page.goto(`/workflow/${mapId}/${printerNodeId}`);
    await page.getByRole('tab', { name: 'Settings' }).click();
    await page.getByLabel('Chave do operador', { exact: true }).fill(operatorKey);
    await page.getByRole('button', { name: 'Conectar', exact: true }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Acesso ao monitoramento liberado' }),
    ).toBeVisible();
    await page.getByRole('tab', { name: 'Parameters' }).click();
    const credentialPicker = page.getByRole('combobox', {
      name: 'Credencial do servidor de impressão',
      exact: true,
    });
    await expect(credentialPicker).toHaveValue(credentialId!);
    await expect(credentialPicker).toContainText(testId);
    await expect(page.getByText(/Campos protegidos:/)).toContainText('Usuário Windows');
    await expect(page.getByText(/Campos protegidos:/)).toContainText('Senha Windows');
    expect(errors).toEqual([]);
  } finally {
    if (mapId) await request.delete(`/api/v1/maps/${mapId}`);
    if (deviceIds.length) await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    if (credentialId)
      await request.delete(`/api/v1/credentials/${credentialId}`, {
        headers: { 'x-support-token': operatorKey },
      });
    await prisma.$disconnect();
  }
});
