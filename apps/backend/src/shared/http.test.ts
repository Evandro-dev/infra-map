import { describe, expect, it } from 'vitest';
import { readLimitedText } from './http.js';

describe('limite de respostas do provedor', () => {
  it('limita bytes mesmo sem Content-Length e cancela o stream', async () => {
    let cancelled = false;
    const stream = new ReadableStream({
      pull(controller) {
        controller.enqueue(new Uint8Array(6));
      },
      cancel() {
        cancelled = true;
      },
    });
    await expect(readLimitedText(new Response(stream), 10)).rejects.toThrow(/limite/);
    expect(cancelled).toBe(true);
  });
  it('mantém caracteres UTF-8 divididos entre chunks', async () => {
    const bytes = new TextEncoder().encode('impressão');
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(bytes.slice(0, 8));
        controller.enqueue(bytes.slice(8));
        controller.close();
      },
    });
    expect(await readLimitedText(new Response(stream), 100)).toBe('impressão');
  });
});
