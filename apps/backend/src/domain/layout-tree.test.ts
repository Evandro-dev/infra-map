import { describe, expect, it } from 'vitest';
import { getTopologicalElements } from './layout-tree.js';
import type { MapElementInput } from '@infra/contracts';
const area = (id: string, parentId: string | null = null): MapElementInput => ({
  id,
  kind: 'AREA',
  parentId,
  deviceId: null,
  name: id,
  iconKey: null,
  xMeters: 0,
  yMeters: 0,
  widthMeters: 10,
  heightMeters: 10,
  level: 0,
});
const device = (id: string, parentId: string | null = null): MapElementInput => ({
  ...area(id, parentId),
  kind: 'DEVICE',
  deviceId: 'device-record',
});
describe('layout tree', () => {
  it('orders nested areas before their children, preserving physical hierarchy', () => {
    expect(
      getTopologicalElements([device('pc', 'room'), area('room', 'floor'), area('floor')]).map(
        (v) => v.id,
      ),
    ).toEqual(['floor', 'room', 'pc']);
  });
  it('rejects nesting anything inside a DEVICE', () =>
    expect(() => getTopologicalElements([device('pc'), area('nested', 'pc')])).toThrow(
      /Somente retângulos/,
    ));
  it('rejects missing parent and cycles', () => {
    expect(() => getTopologicalElements([area('x', 'missing')])).toThrow(/inexistente/);
    expect(() => getTopologicalElements([area('a', 'b'), area('b', 'a')])).toThrow(/Ciclo/);
  });
  it('rejects duplicate IDs and invalid device associations', () => {
    expect(() => getTopologicalElements([area('a'), area('a')])).toThrow(/duplicados/);
    expect(() => getTopologicalElements([device('pc', 'missing')])).toThrow();
    expect(() => getTopologicalElements([{ ...area('a'), deviceId: 'x' }])).toThrow(/Área/);
    expect(() => getTopologicalElements([{ ...device('pc'), deviceId: null }])).toThrow(
      /sem cadastro/,
    );
  });
});
