import { describe, expect, it } from 'vitest';
import { useEditorStore } from './store';
import type { Device, MapElement } from './types';

const device: Device = {
  id: 'same-device',
  name: 'PC-RH',
  kind: 'COMPUTER',
  model: null,
  printServer: null,
  printShare: null,
  approvedDriver: null,
  printQueue: null,
  printPort: null,
  printProtocol: null,
  printPortNumber: null,
  ipAddress: null,
  assetTag: null,
  manufacturer: null,
  serialNumber: null,
  macAddress: null,
  hostname: null,
  operatingSystem: null,
  assignedUser: null,
  notes: null,
  credentialId: null,
};

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
  device: { ...device },
});
describe('identidade do inventário no editor', () => {
  it('mantém Ctrl+clique aditivo e permite remover itens da seleção', () => {
    useEditorStore.getState().load([placement('first'), placement('second'), placement('third')]);
    useEditorStore.getState().select('first');
    useEditorStore.getState().select('second', true);
    useEditorStore.getState().select('third', true);
    useEditorStore.getState().select('second', true);

    expect(useEditorStore.getState().selectedIds).toEqual(['first', 'third']);
    expect(useEditorStore.getState().selectedId).toBe('third');
  });

  it('duplicar posição cria identidade de inventário separada', () => {
    useEditorStore.getState().load([placement('first')]);
    const copy: Device = {
      ...device,
      id: 'copied-device',
      name: 'PC-RH (cópia)',
    };
    useEditorStore.getState().duplicate('first', { [device.id]: copy });
    expect(useEditorStore.getState().elements.map((element) => element.name)).toEqual([
      'PC-RH',
      'PC-RH (cópia)',
    ]);
    expect(
      new Set(useEditorStore.getState().elements.map((element) => element.deviceId)).size,
    ).toBe(2);
    useEditorStore.getState().updateDevice(copy.id, { model: 'Modelo independente' });
    expect(useEditorStore.getState().elements[0].device?.model).toBeNull();
    expect(useEditorStore.getState().elements[1].device?.model).toBe('Modelo independente');
  });
  it('renomeia somente a posição editada e desfaz a alteração', () => {
    useEditorStore.getState().load([placement('first'), placement('second')]);
    useEditorStore.getState().update('first', { name: 'PC-TI' });
    expect(useEditorStore.getState().elements.map((element) => element.name)).toEqual([
      'PC-TI',
      'PC-RH',
    ]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().elements.every((element) => element.name === 'PC-RH')).toBe(
      true,
    );
  });

  it('desfaz e refaz uma movimentação de vários objetos como uma única ação', () => {
    useEditorStore
      .getState()
      .load([
        placement('first'),
        { ...placement('second'), xMeters: 5 },
        { ...placement('third'), xMeters: 9 },
      ]);
    useEditorStore.getState().updateMany([
      { id: 'first', change: { xMeters: 11, yMeters: 12 } },
      { id: 'second', change: { xMeters: 15, yMeters: 12 } },
    ]);

    expect(useEditorStore.getState().elements.map(({ xMeters }) => xMeters)).toEqual([11, 15, 9]);
    useEditorStore.getState().undo();
    expect(useEditorStore.getState().elements.map(({ xMeters }) => xMeters)).toEqual([1, 5, 9]);
    useEditorStore.getState().redo();
    expect(useEditorStore.getState().elements.map(({ xMeters }) => xMeters)).toEqual([11, 15, 9]);
  });

  it('duplica nós sem compartilhar o objeto local do equipamento', () => {
    useEditorStore.getState().load([placement('first')]);
    const copy: Device = {
      ...device,
      id: 'copied-device',
      name: 'PC-RH (cópia)',
    };
    useEditorStore.getState().duplicate('first', { [device.id]: copy });
    const [original, duplicate] = useEditorStore.getState().elements;
    expect(duplicate.device).not.toBe(original.device);
    expect(duplicate.deviceId).not.toBe(original.deviceId);
    useEditorStore.getState().update(duplicate.id, { name: 'PC-CÓPIA' });
    expect(useEditorStore.getState().elements.map((element) => element.name)).toEqual([
      'PC-RH',
      'PC-CÓPIA',
    ]);
  });

  it('copia vários nós e cola o conjunto centrado no ponto do mapa', () => {
    useEditorStore.getState().load([placement('first'), { ...placement('second'), xMeters: 5 }]);
    useEditorStore.getState().select('first');
    useEditorStore.getState().select('second', true);
    const selectedIds = useEditorStore.getState().selectedIds;
    const payload = useEditorStore.getState().copy(selectedIds);
    expect(payload).not.toBeNull();
    expect(JSON.parse(payload!).elements[0]).not.toHaveProperty('device');
    expect(useEditorStore.getState().restoreClipboard(payload!)).toBe(true);
    const copy: Device = {
      ...device,
      id: 'pasted-device',
      name: 'PC-RH (cópia)',
    };
    useEditorStore.getState().pasteAt({ x: 20, y: 20 }, undefined, { [device.id]: copy });

    const state = useEditorStore.getState();
    expect(state.elements).toHaveLength(4);
    expect(state.selectedIds).toHaveLength(2);
    expect(state.elements.slice(2).map((element) => element.xMeters)).toEqual([16.5, 20.5]);
    expect(state.elements[2].device).not.toBe(state.elements[0].device);
    expect(state.elements.slice(2).every((element) => element.deviceId === copy.id)).toBe(true);
  });
});
