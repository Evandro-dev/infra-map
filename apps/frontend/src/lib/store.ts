'use client';
import { create } from 'zustand';
import type { MapElement } from './types';
type Snapshot = MapElement[];
interface EditorState {
  elements: MapElement[];
  selectedId: string | null;
  dirty: boolean;
  undoStack: Snapshot[];
  redoStack: Snapshot[];
  load: (elements: MapElement[]) => void;
  select: (id: string | null) => void;
  update: (id: string, change: Partial<MapElement>) => void;
  add: (el: MapElement) => void;
  remove: (id: string) => void;
  undo: () => void;
  redo: () => void;
  markSaved: () => void;
  reorder: (id: string, direction: -1 | 1) => void;
  duplicate: (id: string) => void;
  updateDevice: (deviceId: string, change: Partial<import('./types').Device>) => void;
}
const snapshot = (els: MapElement[]) => els.map((e) => ({ ...e }));
export const useEditorStore = create<EditorState>((set) => ({
  elements: [],
  selectedId: null,
  dirty: false,
  undoStack: [],
  redoStack: [],
  load: (elements) =>
    set({
      elements: snapshot(elements),
      selectedId: null,
      dirty: false,
      undoStack: [],
      redoStack: [],
    }),
  select: (selectedId) => set({ selectedId }),
  update: (id, change) =>
    set((s) => {
      const target = s.elements.find((e) => e.id === id);
      if (!target) return s;
      return {
        elements: s.elements.map((e) =>
          e.id === id
            ? { ...e, ...change }
            : target.deviceId && e.deviceId === target.deviceId && change.name !== undefined
              ? { ...e, name: change.name }
              : e,
        ),
        dirty: true,
        undoStack: [...s.undoStack.slice(-39), snapshot(s.elements)],
        redoStack: [],
      };
    }),
  add: (el) =>
    set((s) => ({
      elements: [...s.elements, el],
      selectedId: el.id,
      dirty: true,
      undoStack: [...s.undoStack.slice(-39), snapshot(s.elements)],
      redoStack: [],
    })),
  remove: (id) =>
    set((s) => {
      const removed = new Set([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const e of s.elements)
          if (e.parentId && removed.has(e.parentId) && !removed.has(e.id)) {
            removed.add(e.id);
            changed = true;
          }
      }
      return {
        elements: s.elements.filter((e) => !removed.has(e.id)),
        selectedId: null,
        dirty: true,
        undoStack: [...s.undoStack.slice(-39), snapshot(s.elements)],
        redoStack: [],
      };
    }),
  undo: () =>
    set((s) => {
      if (!s.undoStack.length) return s;
      const items = [...s.undoStack];
      const last = items.pop()!;
      return {
        elements: last,
        undoStack: items,
        redoStack: [snapshot(s.elements), ...s.redoStack],
        selectedId: null,
        dirty: true,
      };
    }),
  redo: () =>
    set((s) => {
      if (!s.redoStack.length) return s;
      const [first, ...rest] = s.redoStack;
      return {
        elements: first,
        redoStack: rest,
        undoStack: [...s.undoStack, snapshot(s.elements)],
        selectedId: null,
        dirty: true,
      };
    }),
  duplicate: (id) =>
    set((s) => {
      const root = s.elements.find((element) => element.id === id);
      if (!root) return s;
      const descendants = new Set([id]);
      let previousSize = -1;
      while (previousSize !== descendants.size) {
        previousSize = descendants.size;
        for (const element of s.elements)
          if (element.parentId && descendants.has(element.parentId)) descendants.add(element.id);
      }
      const copies = s.elements.filter((element) => descendants.has(element.id));
      const mapped = new Map(copies.map((element) => [element.id, crypto.randomUUID()]));
      const duplicated = copies.map((element) => ({
        ...element,
        id: mapped.get(element.id)!,
        parentId:
          element.id === id
            ? element.parentId
            : (mapped.get(element.parentId ?? '') ?? element.parentId),
        name:
          element.id === id && element.kind === 'AREA' ? element.name + ' (cópia)' : element.name,
        xMeters: element.id === id ? element.xMeters + 2 : element.xMeters,
        yMeters: element.id === id ? element.yMeters + 2 : element.yMeters,
        orderIndex: (element.orderIndex ?? 0) + s.elements.length,
      }));
      return {
        elements: [...s.elements, ...duplicated],
        selectedId: mapped.get(id)!,
        dirty: true,
        undoStack: [...s.undoStack.slice(-39), snapshot(s.elements)],
        redoStack: [],
      };
    }),
  reorder: (id, direction) =>
    set((s) => {
      const moving = s.elements.find((e) => e.id === id);
      if (!moving) return s;
      const siblings = s.elements
        .filter((e) => e.parentId === moving.parentId)
        .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
      const current = siblings.findIndex((e) => e.id === id),
        next = current + direction;
      if (current < 0 || next < 0 || next >= siblings.length) return s;
      [siblings[current], siblings[next]] = [siblings[next], siblings[current]];
      const order = new Map(siblings.map((e, index) => [e.id, index]));
      return {
        elements: s.elements.map((e) =>
          order.has(e.id) ? { ...e, orderIndex: order.get(e.id) } : e,
        ),
        dirty: true,
        undoStack: [...s.undoStack.slice(-39), snapshot(s.elements)],
        redoStack: [],
      };
    }),
  updateDevice: (deviceId, change) =>
    set((s) => ({
      elements: s.elements.map((e) =>
        e.deviceId === deviceId && e.device
          ? { ...e, device: { ...e.device, ...change }, name: change.name ?? e.name }
          : e,
      ),
      undoStack: s.undoStack.map((items) =>
        items.map((e) =>
          e.deviceId === deviceId && e.device
            ? { ...e, device: { ...e.device, ...change }, name: change.name ?? e.name }
            : e,
        ),
      ),
      redoStack: s.redoStack.map((items) =>
        items.map((e) =>
          e.deviceId === deviceId && e.device
            ? { ...e, device: { ...e.device, ...change }, name: change.name ?? e.name }
            : e,
        ),
      ),
    })),
  markSaved: () => set({ dirty: false }),
}));
