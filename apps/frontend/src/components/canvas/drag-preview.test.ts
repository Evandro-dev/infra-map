import { expect, it } from 'vitest';
import type { MapElement } from '@/lib/types';
import { createPreviewBounds } from './drag-preview';
const element = (
  id: string,
  parentId: string | null,
  xMeters: number,
  yMeters: number,
): MapElement => ({
  id,
  parentId,
  kind: 'AREA',
  name: id,
  iconKey: null,
  deviceId: null,
  device: null,
  xMeters,
  yMeters,
  widthMeters: 4,
  heightMeters: 4,
  level: 0,
});
it('propaga o deslocamento provisório por salas aninhadas sem alterar layout ou criar histórico', () => {
  const elements = [
    element('a', null, 10, 15),
    element('b', 'a', 2, 3),
    element('pc', 'b', 1, 2),
    element('other', null, 7, 8),
  ];
  const original = structuredClone(elements);
  const preview = createPreviewBounds(elements, { id: 'a', x: 20, y: 25 });
  expect(preview(elements[2])).toMatchObject({ x: 23, y: 30 });
  expect(preview(elements[1])).toMatchObject({ x: 22, y: 28 });
  expect(preview(elements[3])).toMatchObject({ x: 7, y: 8 });
  expect(elements).toEqual(original);
  expect(createPreviewBounds(elements, null)(elements[2])).toMatchObject({ x: 13, y: 20 });
});
