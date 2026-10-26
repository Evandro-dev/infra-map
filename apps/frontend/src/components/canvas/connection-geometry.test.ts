import { describe, it, expect } from 'vitest';
import {
  connectionCurve,
  connectionTarget,
  facingEndpoints,
  portEndpoint,
  type ConnectionPortPosition,
} from './connection-geometry';
const source: ConnectionPortPosition = {
  id: 'pc',
  name: 'PC',
  x: 40,
  y: 80,
  width: 60,
  height: 60,
};
const target: ConnectionPortPosition = {
  id: 'printer',
  name: 'Printer',
  x: 300,
  y: 180,
  width: 60,
  height: 60,
};
describe('geometria das conexões', () => {
  it('posiciona o controle no meio da curva com coordenadas de tela', () => {
    const endpoints = facingEndpoints(source, target);
    const curve = connectionCurve(endpoints.from, endpoints.to);
    expect(endpoints).toEqual({
      from: { x: 100, y: 110, side: 'output' },
      to: { x: 300, y: 210, side: 'input' },
    });
    expect(curve.midpoint).toEqual({ x: 200, y: 160 });
    const reverse = facingEndpoints(target, source);
    expect(connectionCurve(reverse.from, reverse.to).midpoint).toEqual(curve.midpoint);
  });
  it('aceita soltar no dispositivo ou em sua alça, recusando a origem e espaço vazio', () => {
    expect(connectionTarget([source, target], { x: 330, y: 210 }, source.id)?.id).toBe('printer');
    expect(connectionTarget([source, target], { x: 294, y: 210 }, source.id)?.id).toBe('printer');
    expect(
      connectionTarget([source, target], portEndpoint(source, 'output'), source.id),
    ).toBeUndefined();
    expect(connectionTarget([source, target], { x: 200, y: 400 }, source.id)).toBeUndefined();
  });
});
