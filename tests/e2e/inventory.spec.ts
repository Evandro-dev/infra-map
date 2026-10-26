import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '@infra/database';

test('posiciona inventário, descarta rascunho, salva cadastro e mantém suporte separado', async ({
  page,
  request,
}) => {
  const testId = `e2e-${randomUUID()}`;
  let mapId: string | undefined;
  let deviceId: string | undefined;
  const pageErrors: string[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  try {
    const mapResponse = await request.post('/api/v1/maps', {
      data: { name: testId, widthMeters: 120, heightMeters: 80 },
    });
    expect(mapResponse.ok()).toBe(true);
    mapId = (await mapResponse.json()).id;
    const deviceResponse = await request.post('/api/v1/devices', {
      data: { name: testId, kind: 'COMPUTER' },
    });
    expect(deviceResponse.ok()).toBe(true);
    deviceId = (await deviceResponse.json()).id;

    await page.goto(`/workflow/${mapId}`);
    await page.getByRole('button', { name: 'Consultar inventário cadastrado' }).click();
    await page.getByLabel('Equipamento existente').selectOption(deviceId!);
    await page.getByRole('button', { name: 'Posicionar no mapa' }).click();
    await page.getByRole('button', { name: 'Salvar mapa', exact: true }).click();
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Inventário', exact: true }).click();
    const name = page.getByLabel('Nome do equipamento', { exact: true });
    await name.fill('rascunho a descartar');
    await page.getByRole('button', { name: 'Descartar alterações', exact: true }).click();
    await expect(name).toHaveValue(testId);
    await name.fill(`${testId}-updated`);
    await page.getByLabel('Endereço IP', { exact: true }).fill('192.0.2.230');
    await page.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
    await expect(page.getByText('Dados salvos no inventário.')).toBeVisible();

    await page.getByRole('button', { name: 'Suporte', exact: true }).click();
    await page
      .getByLabel('Chave do operador (somente nesta sessão)')
      .fill('e2e-test-key-at-least-thirty-two-characters');
    await page.getByRole('button', { name: 'Autorizar suporte', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Buscar computadores', exact: true }),
    ).toBeDisabled();
    await expect(
      page.getByRole('button', { name: 'Solicitar execução', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: 'Encerrar acesso de suporte', exact: true }).click();
    await expect(page.getByLabel('Chave do operador (somente nesta sessão)')).toHaveValue('');

    await page.reload();
    expect((await prisma.device.findUnique({ where: { id: deviceId } }))?.name).toBe(
      `${testId}-updated`,
    );
    expect(await prisma.mapElement.count({ where: { mapId, deviceId } })).toBe(1);
    expect(pageErrors).toEqual([]);
  } finally {
    if (mapId) await request.delete(`/api/v1/maps/${mapId}`);
    if (deviceId) await prisma.device.deleteMany({ where: { id: deviceId } });
    await prisma.$disconnect();
  }
});

test('configuração salva no suporte aparece no inventário sem sobrescrever outros rascunhos', async ({
  page,
  request,
}) => {
  const testId = `e2e-printer-${randomUUID()}`;
  let mapId: string | undefined;
  let deviceId: string | undefined;
  try {
    const mapResponse = await request.post('/api/v1/maps', {
      data: { name: testId, widthMeters: 120, heightMeters: 80 },
    });
    expect(mapResponse.ok()).toBe(true);
    mapId = (await mapResponse.json()).id;
    const deviceResponse = await request.post('/api/v1/devices', {
      data: { name: testId, kind: 'PRINTER' },
    });
    expect(deviceResponse.ok()).toBe(true);
    deviceId = (await deviceResponse.json()).id;
    await page.goto(`/workflow/${mapId}`);
    await page.getByRole('button', { name: 'Consultar inventário cadastrado' }).click();
    await page.getByLabel('Equipamento existente').selectOption(deviceId!);
    await page.getByRole('button', { name: 'Posicionar no mapa' }).click();
    await page.getByRole('button', { name: 'Inventário', exact: true }).click();
    await page
      .getByRole('textbox', { name: 'Observações', exact: true })
      .fill('Rascunho de manutenção');
    await page.getByRole('button', { name: 'Suporte', exact: true }).click();
    await page
      .getByLabel('Chave do operador (somente nesta sessão)')
      .fill('e2e-test-key-at-least-thirty-two-characters');
    await page.getByRole('button', { name: 'Autorizar suporte', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Padrão corporativo' })).toBeVisible();
    await page
      .getByRole('region', { name: 'Central de suporte' })
      .getByLabel('Servidor de impressão', { exact: true })
      .fill('PRINT-SERVER-TEST');
    await page
      .getByRole('region', { name: 'Central de suporte' })
      .getByLabel('Nome da fila compartilhada', { exact: true })
      .fill('QUEUE-TEST');
    await page
      .getByRole('button', { name: 'Salvar configuração da impressora', exact: true })
      .click();
    await expect(page.getByText('Configuração salva.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Inventário', exact: true }).click();
    await expect(page.getByLabel('Servidor de impressão', { exact: true })).toHaveValue(
      'PRINT-SERVER-TEST',
    );
    await expect(page.getByRole('textbox', { name: 'Observações', exact: true })).toHaveValue(
      'Rascunho de manutenção',
    );
  } finally {
    if (mapId) await request.delete(`/api/v1/maps/${mapId}`);
    if (deviceId) await prisma.device.deleteMany({ where: { id: deviceId } });
    await prisma.$disconnect();
  }
});
