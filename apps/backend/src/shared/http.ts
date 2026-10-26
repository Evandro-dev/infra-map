import { AppError } from './errors.js';

/** Enforce a byte limit even when the upstream response has no Content-Length. */
export async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > maxBytes) {
    await response.body?.cancel();
    throw new AppError(502, 'Resposta do provedor indisponível ou acima do limite de tamanho.');
  }
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new AppError(502, 'Resposta do provedor excedeu o limite de tamanho.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString('utf8');
}
