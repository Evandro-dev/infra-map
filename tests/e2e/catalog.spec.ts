import { test, expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '@infra/database';

test('pesquisa uma fila, aplica dados relacionados e salva novos valores manuais', async ({
  page,
  request,
}) => {
  const testId = `catalog-${randomUUID()}`;
  const server = `PRINT-${randomUUID().slice(0, 8)}`;
  let mapId: string | undefined;
  let deviceId: string | undefined;
  try {
    await prisma.printCatalogSnapshot.create({
      data: {
        serverKey: server.toLowerCase(),
        serverName: server,
        source: 'WINDOWS',
        collectedAt: new Date(),
        payload: {
          server,
          source: 'WINDOWS',
          collectedAt: new Date().toISOString(),
          referenceDate: null,
          queues: [
            {
              name: 'QUEUE-RH-TEST',
              shareName: 'SHARE-RH-TEST',
              driverName: 'DRIVER-OBSERVED',
              portName: 'PORT-RH-TEST',
              hostAddress: '192.0.2.235',
              protocol: 'RAW',
              portNumber: 9100,
              shared: true,
              location: 'RH',
            },
            ...Array.from({ length: 45 }, (_, index) => ({
              name: `QUEUE-PAGE-${String(index).padStart(3, '0')}`,
              shareName: `SHARE-PAGE-${index}`,
              driverName: 'DRIVER-OBSERVED',
              portName: 'PORT-RH-TEST',
              hostAddress: '192.0.2.235',
              protocol: 'RAW',
              portNumber: 9100,
              shared: true,
              location: 'RH',
            })),
          ],
          drivers: [{ name: 'DRIVER-OBSERVED', manufacturer: null, environment: null }],
          ports: [
            { name: 'PORT-RH-TEST', hostAddress: '192.0.2.235', protocol: 'RAW', portNumber: 9100 },
          ],
          warnings: [],
        },
      },
    });
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
    const hostname = page.getByRole('combobox', { name: 'Hostname / DNS', exact: true });
    const hostnameToggle = page.getByRole('button', {
      name: 'Mostrar opções de hostname / dns',
      exact: true,
    });
    await hostnameToggle.scrollIntoViewIfNeeded();
    const inputBox = await hostname.boundingBox();
    const toggleBox = await hostnameToggle.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(toggleBox).not.toBeNull();
    expect(toggleBox!.x).toBeGreaterThanOrEqual(inputBox!.x);
    expect(toggleBox!.x + toggleBox!.width).toBeLessThanOrEqual(inputBox!.x + inputBox!.width);
    expect(toggleBox!.y).toBeGreaterThanOrEqual(inputBox!.y);
    expect(toggleBox!.y + toggleBox!.height).toBeLessThanOrEqual(inputBox!.y + inputBox!.height);
    await hostnameToggle.click();
    await expect(
      page.getByRole('listbox', { name: 'Opções de hostname / dns', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: 'artifacts/dropdown-corrigido.png' });
    await hostname.press('Escape');
    await page.getByRole('combobox', { name: 'Servidor de impressão', exact: true }).fill(server);
    const queueField = page.getByRole('combobox', { name: 'Fila no servidor', exact: true });
    await page
      .getByRole('button', { name: 'Mostrar opções de fila no servidor', exact: true })
      .click();
    await expect(queueField).toBeFocused();
    await expect(page.getByText('Página 1 de 3 · 46 opções', { exact: true })).toBeVisible();
    await page.screenshot({ path: 'artifacts/dropdown-paginado.png' });
    await page
      .getByRole('button', { name: 'Próxima página de fila no servidor', exact: true })
      .click();
    await expect(page.getByText('Página 2 de 3 · 46 opções', { exact: true })).toBeVisible();
    expect(
      await page
        .getByRole('listbox', { name: 'Opções de fila no servidor' })
        .getByRole('option')
        .count(),
    ).toBeLessThanOrEqual(20);
    await queueField.fill('SHARE-RH');
    await expect(
      page
        .getByRole('listbox', { name: 'Opções de fila no servidor', exact: true })
        .getByRole('option', { name: /QUEUE-RH-TEST/ }),
    ).toBeVisible();
    await queueField.press('ArrowDown');
    await queueField.press('Enter');
    await expect(
      page.getByRole('combobox', { name: 'Nome da fila compartilhada', exact: true }),
    ).toHaveValue('SHARE-RH-TEST');
    await expect(
      page.getByRole('combobox', { name: 'Driver homologado', exact: true }),
    ).toHaveValue('DRIVER-OBSERVED');
    await expect(
      page.getByRole('combobox', { name: 'Nome da porta de impressão', exact: true }),
    ).toHaveValue('PORT-RH-TEST');
    await expect(page.getByLabel('Porta TCP (número)', { exact: true })).toHaveValue('9100');
    await expect(page.getByLabel('Endereço IP', { exact: true })).toHaveValue('192.0.2.235');

    const driver = page.getByRole('combobox', { name: 'Driver homologado', exact: true });
    await driver.fill('DRIVER-MANUAL-TEST');
    await page
      .getByRole('option', { name: 'Usar “DRIVER-MANUAL-TEST” como valor manual', exact: true })
      .click();
    await page.getByRole('button', { name: 'Salvar cadastro', exact: true }).click();
    await expect(page.getByText('Dados salvos no inventário.')).toBeVisible();
    const saved = await prisma.device.findUnique({ where: { id: deviceId } });
    expect(saved).toMatchObject({
      printServer: server,
      printQueue: 'QUEUE-RH-TEST',
      printPort: 'PORT-RH-TEST',
      printProtocol: 'RAW',
      printPortNumber: 9100,
      approvedDriver: 'DRIVER-MANUAL-TEST',
    });
    const catalog = await (
      await request.get(
        `/api/v1/inventory/options?field=approvedDriver&kind=PRINTER&server=${server}`,
      )
    ).json();
    expect(catalog.items).toContainEqual(
      expect.objectContaining({ value: 'DRIVER-MANUAL-TEST', source: 'INVENTORY' }),
    );

    // A coleta falha, mas os dados e o rascunho continuam disponíveis.
    await page.route('**/api/v1/inventory/print-discovery/capabilities', (route) =>
      route.fulfill({ json: { available: true } }),
    );
    let collectionAttempts = 0;
    await page.route('**/api/v1/inventory/print-discovery', (route) => {
      expect(route.request().postDataJSON().credentials).toEqual({
        username: 'TEST-DOMAIN\\operator',
        password: 'temporary-ui-test',
      });
      collectionAttempts++;
      return collectionAttempts === 1
        ? route.fulfill({ status: 502, json: { error: 'Servidor indisponível (teste)' } })
        : route.fulfill({
            json: {
              server,
              source: 'WINDOWS',
              collectedAt: new Date().toISOString(),
              queueCount: 46,
              driverCount: 1,
              portCount: 1,
              warnings: [],
            },
          });
    });
    await page.getByRole('button', { name: 'Suporte', exact: true }).click();
    await page
      .getByLabel('Chave do operador (somente nesta sessão)')
      .fill('e2e-test-key-at-least-thirty-two-characters');
    await page.getByRole('button', { name: 'Autorizar suporte', exact: true }).click();
    await page
      .getByRole('checkbox', { name: 'Usar outra conta Windows somente nesta consulta' })
      .check();
    await page
      .getByLabel('Usuário Windows para consulta', { exact: true })
      .fill('TEST-DOMAIN\\operator');
    await page.getByLabel('Senha Windows temporária', { exact: true }).fill('temporary-ui-test');
    await page
      .getByRole('button', { name: 'Consultar servidor de impressão', exact: true })
      .click();
    await expect(
      page.getByRole('region', { name: 'Central de suporte' }).getByRole('alert'),
    ).toHaveText('Servidor indisponível (teste)');
    await expect(page.getByLabel('Senha Windows temporária', { exact: true })).toHaveValue('');
    await page.getByLabel('Senha Windows temporária', { exact: true }).fill('temporary-ui-test');
    await page
      .getByRole('button', { name: 'Consultar servidor de impressão', exact: true })
      .click();
    await expect(
      page.getByText(
        '46 filas, 1 drivers e 1 portas coletados. As opções já estão disponíveis nos campos de cadastro.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(page.getByLabel('Senha Windows temporária', { exact: true })).toHaveValue('');
    await expect(
      page
        .getByRole('region', { name: 'Central de suporte' })
        .getByRole('combobox', { name: 'Driver homologado', exact: true }),
    ).toHaveValue('DRIVER-MANUAL-TEST');
  } finally {
    if (mapId) await request.delete(`/api/v1/maps/${mapId}`);
    if (deviceId) await prisma.device.deleteMany({ where: { id: deviceId } });
    await prisma.printCatalogSnapshot.deleteMany({ where: { serverKey: server.toLowerCase() } });
    await prisma.$disconnect();
  }
});
