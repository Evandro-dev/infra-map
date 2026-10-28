import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '@infra/database';

test('arraste acompanha controles em tempo real; ligação de impressão e monitoramento funcionam no editor', async ({
  page,
  request,
}) => {
  const testId = `canvas-${randomUUID()}`;
  const deviceIds: string[] = [];
  let mapId: string | undefined;
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  try {
    const response = await request.post('/api/v1/maps', {
      data: { name: testId, widthMeters: 120, heightMeters: 100 },
    });
    expect(response.ok()).toBe(true);
    mapId = (await response.json()).id;
    const kinds = [
      'COMPUTER',
      'PRINTER',
      'SCALE',
      'CAMERA',
      'SERVER',
      'SWITCH',
      'UPS',
      'PDV',
      'OTHER',
    ];
    for (const kind of kinds) {
      const result = await request.post('/api/v1/devices', {
        data: {
          name: `${testId}-${kind}`,
          kind,
          ...(kind === 'COMPUTER' ? { ipAddress: '127.0.0.1' } : {}),
        },
      });
      expect(result.ok()).toBe(true);
      deviceIds.push((await result.json()).id);
    }
    const elements = deviceIds.map((deviceId, index) => ({
      id: `${testId}-${index}`,
      deviceId,
      parentId: null,
      kind: 'DEVICE',
      name: kinds[index],
      iconKey: null,
      xMeters: 10 + (index % 3) * 34,
      yMeters: 18 + Math.floor(index / 3) * 27,
      widthMeters: 3,
      heightMeters: 3,
      level: 0,
    }));
    const layout = await request.put(`/api/v1/maps/${mapId}/layout`, {
      data: { name: testId, widthMeters: 120, heightMeters: 100, elements },
    });
    expect(layout.ok()).toBe(true);
    await page.goto(`/workflow/${mapId}`);
    await page.getByRole('button', { name: 'Camadas', exact: true }).click();
    await page.getByRole('button', { name: 'COMPUTER', exact: true }).click();
    const ports = page.locator('.device-connection-ports').filter({
      has: page.getByRole('button', { name: 'Iniciar conexão de COMPUTER', exact: true }),
    });
    await expect(ports).toBeVisible();
    const before = (await ports.boundingBox())!;
    await page.mouse.move(before.x + before.width / 2, before.y + before.height / 2);
    const toolbar = page.locator('.context-toolbar-anchor');
    await expect(page.getByRole('toolbar', { name: 'Ações do elemento' })).toBeVisible();
    const toolbarBefore = (await toolbar.boundingBox())!;
    await page.mouse.down();
    await page.mouse.move(before.x + before.width / 2 + 85, before.y + before.height / 2 + 65, {
      steps: 12,
    });
    await expect.poll(async () => (await ports.boundingBox())!.x).toBeGreaterThan(before.x + 50);
    const during = (await ports.boundingBox())!;
    const toolbarDuring = (await toolbar.boundingBox())!;
    expect(during.y).toBeGreaterThan(before.y + 40);
    expect(Math.abs(toolbarDuring.x - toolbarBefore.x - (during.x - before.x))).toBeLessThan(2);
    expect(Math.abs(toolbarDuring.y - toolbarBefore.y - (during.y - before.y))).toBeLessThan(2);
    await page.screenshot({ path: 'artifacts/arraste-em-tempo-real.png' });
    await page.mouse.up();
    await page.keyboard.press('Control+z');
    await expect.poll(async () => (await ports.boundingBox())!.x).toBeCloseTo(before.x, 0);
    await expect.poll(async () => (await ports.boundingBox())!.y).toBeCloseTo(before.y, 0);
    await page.getByRole('button', { name: 'COMPUTER', exact: true }).click();
    await page.screenshot({ path: 'artifacts/dispositivos-outline.png' });
    await page.getByRole('button', { name: 'Iniciar conexão de COMPUTER', exact: true }).click();
    await page.getByRole('button', { name: 'Conectar a PRINTER', exact: true }).click();
    await page.getByRole('button', { name: 'Salvar mapa', exact: true }).click();
    await expect(page.getByText('Salvo', { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        prisma.printerAssignment.count({
          where: { computerId: deviceIds[0], printerId: deviceIds[1] },
        }),
      )
      .toBe(1);
    expect((await prisma.mapConnection.findFirstOrThrow({ where: { mapId } })).kind).toBe(
      'PRINTING',
    );

    await page.getByRole('button', { name: 'Monitorar', exact: true }).click();
    await page
      .getByLabel('Chave do operador', { exact: true })
      .fill('e2e-test-key-at-least-thirty-two-characters');
    await page.getByRole('button', { name: 'Autorizar monitoramento', exact: true }).click();
    await page.getByLabel('Monitoramento automático', { exact: true }).check();
    await page.getByLabel('Verificar uma porta TCP conhecida', { exact: true }).check();
    const ipField = page.getByRole('textbox', {
      name: 'Endereço IP do equipamento',
      exact: true,
    });
    await ipField.fill('192.168.27.201');
    await expect(ipField).toHaveValue('192.168.27.201');
    await ipField.fill('127.0.0.1');
    await page.getByLabel('Porta TCP', { exact: true }).fill('4001');
    await page.getByRole('button', { name: 'Salvar monitoramento', exact: true }).click();
    await expect(page.getByText('Configuração salva.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Coletar agora', exact: true }).click();
    await expect(
      page.getByText('Coleta concluída; confira cada fonte.', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Porta TCP · Sem alertas', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/monitoramento-computador.png' });
    expect(
      'status' in (await prisma.device.findUniqueOrThrow({ where: { id: deviceIds[0] } })),
    ).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    if (mapId) await request.delete(`/api/v1/maps/${mapId}`);
    if (deviceIds.length) await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    await prisma.$disconnect();
  }
});
