import { describe, it, expect } from 'vitest';
import { parseComputers } from './isl.parser.js';
describe('ISL computer parser', () => {
  it('não transforma resposta incompatível em uma lista vazia de computadores', () => {
    expect(() => parseComputers([{ unknown_id: 'pc' }])).toThrow(/identificadores/);
    expect(parseComputers({ computers: [] })).toEqual([]);
  });
  it('reads official co_id field', () =>
    expect(
      parseComputers({
        data: { computers: [{ co_id: 'abc123', alias: 'PC-RH', status: 'online' }] },
      })[0],
    ).toMatchObject({ id: 'abc123', name: 'PC-RH' }));
  it('refuses unexpected output instead of inventing computers', () =>
    expect(() => parseComputers({ data: { unrecognized: true } })).toThrow(/desconhecido/));
});
