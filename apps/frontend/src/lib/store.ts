'use client';
import { create } from 'zustand';
import { absoluteOrigin } from './spatial';
import type { Device, MapElement } from './types';

type Snapshot = MapElement[];

interface EditorState {
  elements: MapElement[];
  selectedId: string | null;
  selectedIds: string[];
  clipboard: MapElement[];
  dirty: boolean;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  load: (elements: MapElement[]) => void;
  select: (id: string | null, additive?: boolean) => void;
  selectMany: (ids: string[], activeId?: string | null) => void;
  copy: (ids: string[]) => string | null;
  restoreClipboard: (payload: string) => boolean;
  pasteAt: (
    point: { x: number; y: number },
    deviceSizeMeters?: number,
    deviceCopies?: Record<string, Device>,
  ) => void;
  update: (id: string, change: Partial<MapElement>) => void;
  updateMany: (changes: Array<{ id: string; change: Partial<MapElement> }>) => void;
  add: (el: MapElement) => void;
  remove: (ids: string | string[]) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  reorder: (id: string, direction: -1 | 1) => void;
  duplicate: (ids: string | string[], deviceCopies?: Record<string, Device>) => void;
  updateDevice: (deviceId: string, change: Partial<import('./types').Device>) => void;
}

const cloneElement = (element: MapElement): MapElement => ({
  ...element,
  device: element.device ? { ...element.device } : element.device,
});
const snapshot = (elements: MapElement[]) => elements.map(cloneElement);

export function selectionRoots(elements: MapElement[], ids: string[]) {
  const selected = new Set(ids);
  const byId = new Map(elements.map((element) => [element.id, element]));
  return elements.filter((element) => {
    if (!selected.has(element.id)) return false;
    const visited = new Set<string>();
    let parentId = element.parentId;
    while (parentId && !visited.has(parentId)) {
      if (selected.has(parentId)) return false;
      visited.add(parentId);
      parentId = byId.get(parentId)?.parentId ?? null;
    }
    return true;
  });
}

function collectSubtreeIds(elements: MapElement[], roots: string[]) {
  const included = new Set(roots);
  let previousSize = -1;
  while (previousSize !== included.size) {
    previousSize = included.size;
    for (const element of elements)
      if (element.parentId && included.has(element.parentId)) included.add(element.id);
  }
  return included;
}

export function deviceIdsForSelection(elements: MapElement[], ids: string[]) {
  const included = collectSubtreeIds(elements, ids);
  return [
    ...new Set(
      elements.flatMap((element) =>
        included.has(element.id) && element.deviceId ? [element.deviceId] : [],
      ),
    ),
  ];
}

export const useEditorStore = create<EditorState>((set) => ({
  elements: [],
  selectedId: null,
  selectedIds: [],
  clipboard: [],
  dirty: false,
  undoStack: [],
  redoStack: [],
  load: (elements) =>
    set({
      elements: snapshot(elements),
      selectedId: null,
      selectedIds: [],
      dirty: false,
      undoStack: [],
      redoStack: [],
    }),
  select: (id, additive = false) =>
    set((state) => {
      if (id === null) return { selectedId: null, selectedIds: [] };
      if (!additive) return { selectedId: id, selectedIds: [id] };
      const selectedIds = state.selectedIds.includes(id)
        ? state.selectedIds.filter((selected) => selected !== id)
        : [...state.selectedIds, id];
      return {
        selectedIds,
        selectedId: selectedIds.includes(id) ? id : (selectedIds.at(-1) ?? null),
      };
    }),
  selectMany: (ids, activeId) =>
    set((state) => {
      const available = new Set(state.elements.map((element) => element.id));
      const selectedIds = [...new Set(ids)].filter((id) => available.has(id));
      return {
        selectedIds,
        selectedId:
          activeId && selectedIds.includes(activeId) ? activeId : (selectedIds.at(-1) ?? null),
      };
    }),
  copy: (ids) => {
    let result: string | null = null;
    set((state) => {
      const available = new Set(state.elements.map((element) => element.id));
      const roots = selectionRoots(
        state.elements,
        [...new Set(ids)].filter((id) => available.has(id)),
      );
      if (!roots.length) return state;
      const included = collectSubtreeIds(
        state.elements,
        roots.map((element) => element.id),
      );
      const rootIds = new Set(roots.map((element) => element.id));
      const clipboard = state.elements
        .filter((element) => included.has(element.id))
        .map((element) => {
          const clone = cloneElement(element);
          if (rootIds.has(element.id)) {
            const origin = absoluteOrigin(state.elements, element.parentId);
            clone.parentId = null;
            clone.xMeters += origin.x;
            clone.yMeters += origin.y;
          }
          return clone;
        });
      // The OS clipboard contains only map placement data; inventory details stay in app state.
      result = JSON.stringify({
        format: 'infra-map-nodes',
        version: 1,
        elements: clipboard.map((element) => {
          const placement = cloneElement(element);
          delete placement.device;
          return placement;
        }),
      });
      return { clipboard };
    });
    return result;
  },
  restoreClipboard: (payload) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return false;
    }
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('format' in parsed) ||
      parsed.format !== 'infra-map-nodes' ||
      !('version' in parsed) ||
      parsed.version !== 1 ||
      !('elements' in parsed) ||
      !Array.isArray(parsed.elements) ||
      parsed.elements.length === 0 ||
      parsed.elements.length > 3000
    )
      return false;

    const rows = parsed.elements;
    const validRows = rows.every(
      (row) =>
        row &&
        typeof row === 'object' &&
        'id' in row &&
        typeof row.id === 'string' &&
        'parentId' in row &&
        (typeof row.parentId === 'string' || row.parentId === null) &&
        'deviceId' in row &&
        (typeof row.deviceId === 'string' || row.deviceId === null) &&
        'kind' in row &&
        (row.kind === 'AREA' || row.kind === 'DEVICE') &&
        'name' in row &&
        typeof row.name === 'string' &&
        'iconKey' in row &&
        (typeof row.iconKey === 'string' || row.iconKey === null) &&
        'xMeters' in row &&
        typeof row.xMeters === 'number' &&
        Number.isFinite(row.xMeters) &&
        'yMeters' in row &&
        typeof row.yMeters === 'number' &&
        Number.isFinite(row.yMeters) &&
        'widthMeters' in row &&
        typeof row.widthMeters === 'number' &&
        Number.isFinite(row.widthMeters) &&
        row.widthMeters > 0 &&
        'heightMeters' in row &&
        typeof row.heightMeters === 'number' &&
        Number.isFinite(row.heightMeters) &&
        row.heightMeters > 0 &&
        'level' in row &&
        typeof row.level === 'number' &&
        Number.isInteger(row.level) &&
        row.level >= 0,
    );
    if (!validRows) return false;
    const ids = new Set(rows.map((row) => row.id as string));
    if (
      ids.size !== rows.length ||
      !rows.some((row) => row.parentId === null) ||
      rows.some((row) => typeof row.parentId === 'string' && !ids.has(row.parentId))
    )
      return false;

    set((state) => ({
      clipboard: rows.map((row) => {
        const deviceId = row.deviceId as string | null;
        const device = deviceId
          ? (state.elements.find((element) => element.deviceId === deviceId)?.device ?? null)
          : null;
        return {
          id: row.id as string,
          parentId: row.parentId as string | null,
          deviceId,
          kind: row.kind as MapElement['kind'],
          name: row.name as string,
          iconKey: row.iconKey as string | null,
          xMeters: row.xMeters as number,
          yMeters: row.yMeters as number,
          widthMeters: row.widthMeters as number,
          heightMeters: row.heightMeters as number,
          level: row.level as number,
          orderIndex:
            'orderIndex' in row && typeof row.orderIndex === 'number' ? row.orderIndex : undefined,
          hidden: 'hidden' in row && typeof row.hidden === 'boolean' ? row.hidden : false,
          locked: 'locked' in row && typeof row.locked === 'boolean' ? row.locked : false,
          device: device ? { ...device } : null,
        };
      }),
    }));
    return true;
  },
  pasteAt: (point, deviceSizeMeters, deviceCopies = {}) =>
    set((state) => {
      if (!state.clipboard.length) return state;
      if (state.clipboard.some((element) => element.deviceId && !deviceCopies[element.deviceId]))
        return state;
      const roots = state.clipboard.filter((element) => element.parentId === null);
      if (!roots.length) return state;
      const minX = Math.min(...roots.map((element) => element.xMeters));
      const minY = Math.min(...roots.map((element) => element.yMeters));
      const maxX = Math.max(
        ...roots.map(
          (element) =>
            element.xMeters +
            (element.kind === 'DEVICE' && deviceSizeMeters !== undefined
              ? deviceSizeMeters
              : element.widthMeters),
        ),
      );
      const maxY = Math.max(
        ...roots.map(
          (element) =>
            element.yMeters +
            (element.kind === 'DEVICE' && deviceSizeMeters !== undefined
              ? deviceSizeMeters
              : element.heightMeters),
        ),
      );
      const offsetX = point.x - (minX + maxX) / 2;
      const offsetY = point.y - (minY + maxY) / 2;
      const mapped = new Map(state.clipboard.map((element) => [element.id, crypto.randomUUID()]));
      const nextOrder = state.elements.reduce(
        (max, element) => Math.max(max, element.orderIndex ?? 0),
        -1,
      );
      const pasted = state.clipboard.map((element, index) => {
        const root = element.parentId === null;
        const copiedDevice = element.deviceId ? deviceCopies[element.deviceId] : undefined;
        return {
          ...cloneElement(element),
          id: mapped.get(element.id)!,
          parentId: element.parentId ? (mapped.get(element.parentId) ?? null) : null,
          deviceId: copiedDevice?.id ?? element.deviceId,
          device: copiedDevice ? { ...copiedDevice } : cloneElement(element).device,
          name:
            copiedDevice && (!element.device || element.name === element.device.name)
              ? copiedDevice.name
              : element.name,
          xMeters: element.xMeters + (root ? offsetX : 0),
          yMeters: element.yMeters + (root ? offsetY : 0),
          orderIndex: nextOrder + index + 1,
        };
      });
      const selectedIds = roots.map((element) => mapped.get(element.id)!);
      return {
        elements: [...state.elements, ...pasted],
        selectedId: selectedIds[0] ?? null,
        selectedIds,
        dirty: true,
        undoStack: [...state.undoStack.slice(-39), snapshot(state.elements)],
        redoStack: [],
      };
    }),
  update: (id, change) =>
    set((state) => {
      if (!state.elements.some((element) => element.id === id)) return state;
      return {
        elements: state.elements.map((element) =>
          element.id === id
            ? {
                ...element,
                ...change,
                ...(change.device ? { device: { ...element.device, ...change.device } } : {}),
              }
            : element,
        ),
        dirty: true,
        undoStack: [...state.undoStack.slice(-39), snapshot(state.elements)],
        redoStack: [],
      };
    }),
  updateMany: (changes) =>
    set((state) => {
      const updates = new Map(changes.map(({ id, change }) => [id, change]));
      if (!state.elements.some((element) => updates.has(element.id))) return state;
      return {
        elements: state.elements.map((element) => {
          const change = updates.get(element.id);
          return change
            ? {
                ...element,
                ...change,
                ...(change.device ? { device: { ...element.device, ...change.device } } : {}),
              }
            : element;
        }),
        dirty: true,
        undoStack: [...state.undoStack.slice(-39), snapshot(state.elements)],
        redoStack: [],
      };
    }),
  add: (element) =>
    set((state) => ({
      elements: [...state.elements, cloneElement(element)],
      selectedId: element.id,
      selectedIds: [element.id],
      dirty: true,
      undoStack: [...state.undoStack.slice(-39), snapshot(state.elements)],
      redoStack: [],
    })),
  remove: (ids) =>
    set((state) => {
      const requested = Array.isArray(ids) ? ids : [ids];
      const removed = collectSubtreeIds(state.elements, requested);
      if (!state.elements.some((element) => removed.has(element.id))) return state;
      return {
        elements: state.elements.filter((element) => !removed.has(element.id)),
        selectedId: null,
        selectedIds: [],
        dirty: true,
        undoStack: [...state.undoStack.slice(-39), snapshot(state.elements)],
        redoStack: [],
      };
    }),
  undo: () =>
    set((state) => {
      if (!state.undoStack.length) return state;
      const undoStack = [...state.undoStack];
      const last = undoStack.pop()!;
      return {
        elements: last,
        undoStack,
        redoStack: [snapshot(state.elements), ...state.redoStack],
        selectedId: null,
        selectedIds: [],
        dirty: true,
      };
    }),
  redo: () =>
    set((state) => {
      if (!state.redoStack.length) return state;
      const [first, ...redoStack] = state.redoStack;
      return {
        elements: first,
        redoStack,
        undoStack: [...state.undoStack, snapshot(state.elements)],
        selectedId: null,
        selectedIds: [],
        dirty: true,
      };
    }),
  duplicate: (ids, deviceCopies = {}) =>
    set((state) => {
      const requested = Array.isArray(ids) ? ids : [ids];
      const available = new Set(state.elements.map((element) => element.id));
      const roots = selectionRoots(
        state.elements,
        [...new Set(requested)].filter((id) => available.has(id)),
      );
      if (!roots.length) return state;
      const rootIds = new Set(roots.map((element) => element.id));
      const included = collectSubtreeIds(
        state.elements,
        roots.map((element) => element.id),
      );
      const copies = state.elements.filter((element) => included.has(element.id));
      if (copies.some((element) => element.deviceId && !deviceCopies[element.deviceId]))
        return state;
      const mapped = new Map(copies.map((element) => [element.id, crypto.randomUUID()]));
      const nextOrder = state.elements.reduce(
        (max, element) => Math.max(max, element.orderIndex ?? 0),
        -1,
      );
      const duplicated = copies.map((element, index) => {
        const root = rootIds.has(element.id);
        const copiedDevice = element.deviceId ? deviceCopies[element.deviceId] : undefined;
        return {
          ...cloneElement(element),
          id: mapped.get(element.id)!,
          parentId: root ? element.parentId : (mapped.get(element.parentId ?? '') ?? null),
          deviceId: copiedDevice?.id ?? element.deviceId,
          device: copiedDevice ? { ...copiedDevice } : cloneElement(element).device,
          name:
            root && element.kind === 'AREA'
              ? `${element.name} (cópia)`
              : copiedDevice && (!element.device || element.name === element.device.name)
                ? copiedDevice.name
                : element.name,
          xMeters: element.xMeters + (root ? 2 : 0),
          yMeters: element.yMeters + (root ? 2 : 0),
          orderIndex: nextOrder + index + 1,
        };
      });
      const selectedIds = roots.map((element) => mapped.get(element.id)!);
      return {
        elements: [...state.elements, ...duplicated],
        selectedId: selectedIds[0] ?? null,
        selectedIds,
        dirty: true,
        undoStack: [...state.undoStack.slice(-39), snapshot(state.elements)],
        redoStack: [],
      };
    }),
  reorder: (id, direction) =>
    set((state) => {
      const moving = state.elements.find((element) => element.id === id);
      if (!moving) return state;
      const siblings = state.elements
        .filter((element) => element.parentId === moving.parentId)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      const current = siblings.findIndex((element) => element.id === id);
      const next = current + direction;
      if (current < 0 || next < 0 || next >= siblings.length) return state;
      [siblings[current], siblings[next]] = [siblings[next], siblings[current]];
      const order = new Map(siblings.map((element, index) => [element.id, index]));
      return {
        elements: state.elements.map((element) =>
          order.has(element.id) ? { ...element, orderIndex: order.get(element.id) } : element,
        ),
        dirty: true,
        undoStack: [...state.undoStack.slice(-39), snapshot(state.elements)],
        redoStack: [],
      };
    }),
  updateDevice: (deviceId, change) =>
    set((state) => ({
      elements: state.elements.map((element) => {
        if (element.deviceId !== deviceId || !element.device) return element;
        const followsInventoryName = element.name === element.device.name;
        return {
          ...element,
          device: { ...element.device, ...change },
          name: change.name !== undefined && followsInventoryName ? change.name : element.name,
        };
      }),
      undoStack: state.undoStack.map((items) =>
        items.map((element) => {
          if (element.deviceId !== deviceId || !element.device) return element;
          const followsInventoryName = element.name === element.device.name;
          return {
            ...element,
            device: { ...element.device, ...change },
            name: change.name !== undefined && followsInventoryName ? change.name : element.name,
          };
        }),
      ),
      redoStack: state.redoStack.map((items) =>
        items.map((element) => {
          if (element.deviceId !== deviceId || !element.device) return element;
          const followsInventoryName = element.name === element.device.name;
          return {
            ...element,
            device: { ...element.device, ...change },
            name: change.name !== undefined && followsInventoryName ? change.name : element.name,
          };
        }),
      ),
    })),
  markSaved: () => set({ dirty: false }),
}));
