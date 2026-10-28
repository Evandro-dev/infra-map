import { expect, test } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:4001/api/v1';
const operatorKey = 'e2e-test-key-at-least-thirty-two-characters';

test('Workflows preserva o editor e Credentials gerencia segredos protegidos', async ({
  page,
  request,
}) => {
  let workflowId = '';
  let credentialId = '';

  try {
    await page.goto('/workflows');
    await expect(page.getByRole('heading', { name: 'Workflows', level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Credentials' }).click();
    await expect(page).toHaveURL(/\/credentials$/);
    await page.getByLabel('Chave de suporte').fill(operatorKey);
    await page.getByRole('button', { name: 'Acessar credenciais' }).click();
    await expect(page.getByRole('button', { name: 'Nova credencial' })).toBeVisible();

    await page.getByRole('button', { name: 'Nova credencial' }).click();
    await page.getByRole('button', { name: /Windows Print Server/ }).click();
    await page.getByLabel('Nome da credencial').fill('E2E Print Server');
    await page.getByLabel('Servidor permitido (opcional)').fill('SRV-SKY-PRT-01');
    await page.getByLabel('Usuário Windows').fill('E2E\\operator');
    await page.getByLabel('Senha Windows').fill('test-only-password');
    await page.getByRole('button', { name: 'Salvar credencial' }).click();
    await expect(page.getByText('E2E Print Server', { exact: true })).toBeVisible();

    const listResponse = await request.get(`${apiOrigin}/credentials`, {
      headers: { 'x-support-token': operatorKey },
    });
    expect(listResponse.ok()).toBeTruthy();
    const listBody = await listResponse.text();
    expect(listBody).toContain('E2E Print Server');
    expect(listBody).not.toContain('test-only-password');
    const listed = JSON.parse(listBody) as { credentials: { id: string; name: string }[] };
    credentialId = listed.credentials.find((item) => item.name === 'E2E Print Server')?.id ?? '';
    expect(credentialId).not.toBe('');

    await page.getByRole('link', { name: 'Workflows' }).click();
    await expect(page).toHaveURL(/\/workflows$/);
    await page.getByRole('button', { name: 'Novo workflow' }).click();
    await page.getByLabel('Nome').fill('Workflow E2E temporário');
    await page.getByRole('button', { name: 'Criar workflow' }).click();
    await expect(page).toHaveURL(/\/workflow\/[^/]+$/);
    workflowId = new URL(page.url()).pathname.split('/').at(-1) ?? '';

    await page.getByRole('link', { name: 'Workflows' }).click();
    const workflowCard = page.locator('article').filter({ hasText: 'Workflow E2E temporário' });
    await expect(workflowCard).toBeVisible();
    page.on('dialog', (dialog) => void dialog.accept());
    await workflowCard
      .getByRole('button', { name: 'Excluir workflow Workflow E2E temporário' })
      .click();
    await expect(workflowCard).toHaveCount(0);
    workflowId = '';

    await page.getByRole('link', { name: 'Credentials' }).click();
    await page.getByLabel('Chave de suporte').fill(operatorKey);
    await page.getByRole('button', { name: 'Acessar credenciais' }).click();
    await page.getByRole('button', { name: `Excluir credencial E2E Print Server` }).click();
    await expect(page.getByText('E2E Print Server', { exact: true })).toHaveCount(0);
    credentialId = '';
  } finally {
    if (workflowId)
      await request.delete(`${apiOrigin}/maps/${encodeURIComponent(workflowId)}`).catch(() => null);
    if (credentialId)
      await request
        .delete(`${apiOrigin}/credentials/${encodeURIComponent(credentialId)}`, {
          headers: { 'x-support-token': operatorKey },
        })
        .catch(() => null);
  }
});
