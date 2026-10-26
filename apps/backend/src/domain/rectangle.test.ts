import { describe, expect, it } from 'vitest';
import { RectangleDimensions } from './rectangle.js';
describe('RectangleDimensions', () => {
  it('guarda medidas reais com getters e setters', () => {
    const room = new RectangleDimensions(10, 5);
    expect(room.area).toBe(50);
    room.width = 12;
    expect(room.area).toBe(60);
  });
  it('rejeita dimensoes nao validas', () => {
    expect(() => new RectangleDimensions(0, 5)).toThrow();
    expect(() => new RectangleDimensions(2, NaN)).toThrow();
  });
});
