import { test, expect, type Locator, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { prisma } from '@infra/database';

async function midpoint(line: Locator) {
  return line.evaluate((element) => {
    const path = element as SVGPathElement;
    const point = path.getPointAtLength(path.getTotalLength() / 2);
    const result = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM()!);
    return { x: result.x, y: result.y };
  });
}
async function hoverLine(page: Page, line: Locator) {
  const point = await midpoint(line);
  await page.mouse.move(point.x - 20, point.y - 20);
  await page.mouse.move(point.x, point.y, { steps: 3 });
  try {
    await expect(
      page.getByRole('toolbar', { name: 'Ações da conexão', exact: true }),
    ).toBeVisible();
  } catch (error) {
    console.log(
      await page.evaluate(
        (point) => ({
          point,
          under: document
            .elementsFromPoint(point.x, point.y)
            .slice(0, 5)
            .map((element) => ({
              tag: element.tagName,
              cls: element.getAttribute('class'),
              pe: getComputedStyle(element).pointerEvents,
              d: element.getAttribute('d'),
            })),
          preview: document.querySelector('.connection-preview')?.getAttribute('d'),
        }),
        point,
      ),
    );
    throw error;
  }
  return point;
}
test('arrasta conexões com prévia, cancela destinos inválidos e exclui somente a linha escolhida', async ({
  page,
  request,
}) => {
  const testId = `lines-${randomUUID()}`;
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
    const kinds = ['COMPUTER', 'PRINTER', 'SERVER', 'SWITCH'];
    for (const kind of kinds) {
      const result = await request.post('/api/v1/devices', {
        data: { name: `${testId}-${kind}`, kind },
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
      xMeters: 12 + (index % 2) * 62,
      yMeters: 22 + Math.floor(index / 2) * 40,
      widthMeters: 3,
      heightMeters: 3,
      level: 0,
    }));
    expect(
      (
        await request.put(`/api/v1/maps/${mapId}/layout`, {
          data: { name: testId, widthMeters: 120, heightMeters: 100, elements },
        })
      ).ok(),
    ).toBe(true);
    await page.goto(`/workflow/${mapId}`);
    await page.getByRole('button', { name: 'Camadas', exact: true }).click();
    await page.getByRole('button', { name: 'COMPUTER', exact: true }).click();
    const output = page.getByRole('button', { name: 'Iniciar conexão de COMPUTER', exact: true });
    const start = (await output.boundingBox())!;
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2);
    await page.mouse.down();
    const target = page.getByRole('button', { name: 'Conectar a PRINTER', exact: true });
    await expect(target).toBeVisible();
    const end = (await target.boundingBox())!;
    await page.mouse.move((start.x + end.x) / 2, start.y + 40, { steps: 8 });
    const preview = page.getByTestId('connection-preview');
    await expect(preview).toBeVisible();
    const firstPath = await preview.getAttribute('d');
    await page.mouse.move(end.x + 35, end.y + end.height / 2, { steps: 8 });
    await expect(preview).not.toHaveAttribute('d', firstPath!);
    await expect(preview).toHaveAttribute('stroke', '#23815b');
    expect(await prisma.mapConnection.count({ where: { mapId } })).toBe(0);
    await page.screenshot({ path: 'artifacts/conexao-durante-arraste.png' });
    await page.mouse.up();
    const printLine = page.getByRole('button', {
      name: 'Conexão entre COMPUTER e PRINTER',
      exact: true,
    });
    await expect(printLine).toBeAttached();
    await expect(preview).toHaveCount(0);
    await expect
      .poll(() =>
        prisma.printerAssignment.count({
          where: { computerId: deviceIds[0], printerId: deviceIds[1] },
        }),
      )
      .toBe(1);
    const positions = await prisma.mapElement.findMany({
      where: { mapId },
      orderBy: { id: 'asc' },
    });
    expect(positions.map((el) => [el.xMeters, el.yMeters])).toEqual(
      elements.map((el) => [el.xMeters, el.yMeters]),
    );

    await page.getByRole('button', { name: 'SERVER', exact: true }).click();
    await page.getByRole('button', { name: 'Iniciar conexão de SERVER', exact: true }).click();
    await page.getByRole('button', { name: 'Conectar a SWITCH', exact: true }).click();
    const networkLine = page.getByRole('button', {
      name: 'Conexão entre SERVER e SWITCH',
      exact: true,
    });
    await expect(networkLine).toBeAttached();
    const center = await hoverLine(page, printLine);
    const toolbar = (await page
      .getByRole('toolbar', { name: 'Ações da conexão', exact: true })
      .boundingBox())!;
    expect(Math.abs(toolbar.x + toolbar.width / 2 - center.x)).toBeLessThan(1);
    expect(Math.abs(toolbar.y + toolbar.height / 2 - center.y)).toBeLessThan(1);
    await page.screenshot({ path: 'artifacts/conexao-lixeira-central.png' });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Excluir conexão entre computer e printer/i }).click();
    await expect(printLine).toHaveCount(0);
    await expect(networkLine).toBeAttached();
    await expect.poll(() => prisma.mapConnection.count({ where: { mapId } })).toBe(1);
    expect(
      await prisma.printerAssignment.count({
        where: { computerId: deviceIds[0], printerId: deviceIds[1] },
      }),
    ).toBe(0);

    await page.reload();
    await expect(networkLine).toBeAttached();
    await page.getByRole('button', { name: 'Camadas', exact: true }).click();
    await page.getByRole('button', { name: 'SERVER', exact: true }).click();
    await networkLine.focus();
    await page.keyboard.press('Delete');
    await expect(networkLine).toHaveCount(0);
    await page.getByRole('button', { name: 'Camadas', exact: true }).click();
    await page.getByRole('button', { name: 'COMPUTER', exact: true }).click();
    const again = (await output.boundingBox())!;
    const canvas = (await page.locator('.canvas').boundingBox())!;
    await page.mouse.move(again.x + again.width / 2, again.y + again.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvas.x + canvas.width - 25, canvas.y + 65, { steps: 8 });
    await expect(preview).toBeVisible();
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
    await output.click();
    await expect(preview).toBeAttached();
    await page.keyboard.press('Escape');
    await expect(preview).toHaveCount(0);

    // Associações criadas no suporte também têm uma linha, com a mesma autorização exigida pelo inventário.
    await prisma.printerAssignment.create({
      data: { computerId: deviceIds[0], printerId: deviceIds[1] },
    });
    await page.getByRole('button', { name: 'COMPUTER', exact: true }).click();
    await expect(printLine).toBeAttached();
    await hoverLine(page, printLine);
    await page.getByRole('button', { name: /Excluir conexão entre computer e printer/i }).click();
    await expect(
      page.getByText(
        'Autorize o acesso na aba Suporte para remover esta associação do inventário.',
      ),
    ).toBeVisible();
    expect(
      await prisma.printerAssignment.count({
        where: { computerId: deviceIds[0], printerId: deviceIds[1] },
      }),
    ).toBe(1);
    await page.getByRole('button', { name: 'Suporte', exact: true }).click();
    await page
      .getByLabel('Chave do operador (somente nesta sessão)')
      .fill('e2e-test-key-at-least-thirty-two-characters');
    await page.getByRole('button', { name: 'Autorizar suporte', exact: true }).click();
    await hoverLine(page, printLine);
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: /Excluir conexão entre computer e printer/i }).click();
    await expect(printLine).toHaveCount(0);

    // Remover uma conexão em rascunho não cria associação nem envia exclusão para o banco.
    await page.getByRole('button', { name: 'Camadas', exact: true }).click();
    await page.getByRole('button', { name: 'COMPUTER', exact: true }).click();
    const port = (await output.boundingBox())!;
    await page.mouse.move(port.x - 25, port.y + port.height / 2);
    await page.mouse.down();
    await page.mouse.move(port.x + 5, port.y + port.height / 2 + 45, { steps: 8 });
    await page.mouse.up();
    await output.click();
    await page.getByRole('button', { name: 'Conectar a PRINTER', exact: true }).click();
    await expect(printLine).toBeAttached();
    expect(await prisma.mapConnection.count({ where: { mapId } })).toBe(0);
    await hoverLine(page, printLine);
    await page.getByRole('button', { name: /Excluir conexão entre computer e printer/i }).click();
    await expect(printLine).toHaveCount(0);
    expect(
      await prisma.printerAssignment.count({
        where: { computerId: deviceIds[0], printerId: deviceIds[1] },
      }),
    ).toBe(0);
    expect(await prisma.mapConnection.count({ where: { mapId } })).toBe(0);
    expect(await prisma.device.count({ where: { id: { in: deviceIds } } })).toBe(4);
    expect(errors).toEqual([]);
  } finally {
    if (mapId) await request.delete(`/api/v1/maps/${mapId}`);
    if (deviceIds.length) await prisma.device.deleteMany({ where: { id: { in: deviceIds } } });
    await prisma.$disconnect();
  }
});
