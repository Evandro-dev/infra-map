import { describe, expect, it, vi } from 'vitest';
import { IslClient, inspectIslResponse } from './isl.client.js';

const config = {
  ISL_MODE: 'hosted' as const,
  ISL_SERVER_URL: '',
  ISL_API_USERNAME: 'operator',
  ISL_API_PASSWORD: 'integration-secret',
};
const response = (data: unknown, extra = {}) =>
  Response.json({ result: { code: 'OK', ...extra }, data });

describe('adaptador ISL', () => {
  it('compartilha login concorrente, utiliza hs rotacionado e envia credenciais somente via POST', async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async (_url, options) => {
      const body = options?.body as URLSearchParams;
      if (body.get('method') === 'utils/login/1')
        return response({ sid: 'initial-session' }, { hs: 'rotated-session' });
      expect(body.get('hs')).toBe('rotated-session');
      expect(body.get('method')).toBe('islalwayson/computer/search/1');
      return response({ computers: [{ co_id: 'abc', alias: 'PC-RH', status: 'online' }] });
    });
    const client = new IslClient(config, request);
    const lists = await Promise.all([client.list('RH'), client.list('TI')]);
    expect(lists[0][0].id).toBe('abc');
    expect(request).toHaveBeenCalledTimes(3);
    for (const [url, options] of request.mock.calls) {
      expect(String(url)).toBe('https://islonline.net/webapi2');
      expect(options?.method).toBe('POST');
      expect(options?.redirect).toBe('error');
    }
  });
  it('não reflete segredos que apareçam em erros do provedor', async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        result: { code: 'USER_ERROR', description: 'integration-secret access-password' },
      }),
    );
    await expect(new IslClient(config, request).list('')).rejects.toThrow('O ISL recusou');
  });
  it('lê desafios e IDs dentro de arrays de computadores e eventos', () => {
    expect(inspectIslResponse({ computers: [{ events: [{ chmd5: 'challenge' }] }] }, 'chmd5')).toBe(
      'challenge',
    );
    expect(inspectIslResponse({ events: [{ fid: 123 }] }, 'fid')).toBe('123');
  });
  it('recusa URL de relatório externo antes do download', async () => {
    const request = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ sid: 'session' }))
      .mockResolvedValueOnce(response({ url: 'https://other.example/result' }));
    await expect(new IslClient(config, request).downloadResult('id', 'file')).rejects.toThrow(
      /externo/,
    );
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('recusa origem self-hosted com caminho ou HTTP', async () => {
    const request = vi.fn<typeof fetch>();
    await expect(
      new IslClient(
        { ...config, ISL_MODE: 'self-hosted', ISL_SERVER_URL: 'http://isl.example/path' },
        request,
      ).list(''),
    ).rejects.toThrow(/HTTPS/);
    expect(request).not.toHaveBeenCalled();
  });
});
