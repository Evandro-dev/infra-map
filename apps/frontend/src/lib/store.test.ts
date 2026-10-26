import { describe, expect, it } from 'vitest';
import { useEditorStore } from './store';
import type { MapElement } from './types';

const placement = (id: string): MapElement => ({
  id,
  deviceId: 'same-device',
  parentId: null,
  kind: 'DEVICE',
  name: 'PC-RH',
  iconKey: null,
  xMeters: 1,
  yMeters: 1,
  widthMeters: 3,
  heightMeters: 3,
  level: 0,
});
describe('identidade do inventário no editor', () => {
  it('duplicar posição não renomeia o equipamento físico', () => {
    useEditorStore.getState().load([placement('first')]);
    useEditorStore.getState().duplicate('first');
    expect(useEditorStore.getState().elements.map((element) => element.name)).toEqual([
      'PC-RH',
      'PC-RH',
    ]);
    expect(
      new Set(useEditorStore.getState().elements.map((element) => element.deviceId)).size,
    ).toBe(1);
  });
  it('renomeia todas as posições do equipamento em um único passo de desfazer', () => {
    useEditorStore.getState().load([placement('first'), placement('second')]);
    useEditorStore.getState().update('first', { name: 'PC-TI' });
    expect(useEditorStore.getState().elements.every((element) => element.name === 'PC-TI')).toBe(
      true,
    );
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().elements.every((element) => element.name === 'PC-RH')).toBe(
      true,
    );
  });
});
