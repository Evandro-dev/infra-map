import { afterEach, describe, expect, it, vi } from 'vitest';
import { api } from './api';
import { secureRequest } from '../features/support/api';

afterEach(() => vi.unstubAllGlobals());
describe('cliente HTTP', () => {
  it('não envia Content-Type em POST sem corpo e aceita 204 sem tentar ler JSON', async () => {
    const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetch);
    expect(
      await secureRequest('/devices/device/open-isl', 'operator-key', { method: 'POST' }),
    ).toBeUndefined();
    const headers = fetch.mock.calls[0][1].headers as Headers;
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('x-support-token')).toBe('operator-key');
  });
  it('mostra o erro estruturado retornado pelo backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json({ error: 'Equipamento inexistente' }, { status: 404 })),
    );
    await expect(api('/devices/id')).rejects.toThrow('Equipamento inexistente');
  });
  it('shows the validation detail returned with a generic backend error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json(
          {
            error: 'Invalid data',
            issues: [
              { path: ['targetServer'], message: 'Use a server name without a share path.' },
            ],
          },
          { status: 400 },
        ),
      ),
    );
    await expect(api('/credentials')).rejects.toThrow('Use a server name without a share path.');
  });
});
