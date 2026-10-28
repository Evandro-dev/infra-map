'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Stage, Layer, Group, Rect, Text, Line, Shape } from 'react-konva';
import Konva from 'konva';
import {
  Layers3,
  Move,
  X,
  ArrowDownToLine,
  ArrowUpFromLine,
  Link2,
  LockKeyhole,
  LockKeyholeOpen,
  Trash2,
  PenLine,
  ScanSearch,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Copy,
  CopyPlus,
  Grid3X3,
  XCircle,
  Plus,
} from 'lucide-react';
import { EditorNode } from './canvas/editor-node';
import { ConnectionPorts } from './canvas/connection-ports';
import { ConnectionLayer } from './canvas/connection-layer';
import { useConnectionGesture } from './canvas/use-connection-gesture';
import {
  connectionCurve,
  connectionTarget,
  facingEndpoints,
  portEndpoint,
  type CanvasConnection,
} from './canvas/connection-geometry';
import { CanvasNavigation } from './canvas/canvas-navigation';
import { CanvasActionBar } from './canvas/canvas-action-bar';
import { CanvasNodePanel } from './canvas/canvas-node-panel';
import { ContextToolbar } from './canvas/context-toolbar';
import { createPreviewBounds, type DragPreview } from './canvas/drag-preview';
import type { ContextMenuActionId, ContextMenuAction } from './canvas/context-actions';
import { deviceIdsForSelection, selectionRoots, useEditorStore } from '@/lib/store';
import { cloneInventoryDevices } from '@/features/inventory/clone-devices';
import {
  absoluteBounds,
  absoluteOrigin,
  findOverlap,
  floorsFor,
  footprintKey,
  containingArea,
  localPositionFor,
  snapToGuides,
} from '@/lib/spatial';
import {
  type Device,
  type DeviceKind,
  type MapElement,
  type MapRecord,
  type MapConnection,
} from '@/lib/types';
import type { DeviceHealth } from '@infra/contracts';
import { healthColor } from '@/features/monitoring/status';

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
type ActiveEdit = { id: string; value: string };
type Overlap = { movingId: string; targetId: string; x: number; y: number };
interface CanvasProps {
  map: MapRecord;
  zoom: number;
  setZoom: (value: number) => void;
  onDropItem: (kind: string, x: number, y: number, parentId: string | null) => string | null;
  onRenameElement: (id: string, name: string) => void;
  onRenameMap: (name: string) => void;
  onDeleteElement: (id: string | string[]) => void;
  onDeleteTerritory: () => void;
  onCreateTerritory: () => void;
  onMoveTerritory: (point: { x: number; y: number }) => void;
  relationships: { computerId: string; printerId: string }[];
  monitoring: Record<string, DeviceHealth>;
  connections: MapConnection[];
  onConnect: (from: string, to: string) => void;
  onDisconnect: (id: string) => void;
  onRemoveConnection: (id: string) => void;
  onRemoveRelationship: (computerId: string, printerId: string) => void;
  showLinks: boolean;
  toggleLinks: () => void;
  inspectorOpen: boolean;
  actionsDisabled: boolean;
  hasTerritory: boolean;
  onToggleInspector: () => void;
  onAddArea: () => void;
  onAddDevice: (kind: DeviceKind) => void;
  onPlaceDevice: (device: Device) => void;
  onOpenDevice: (elementId: string) => void;
  onActionError: (message: string) => void;
}
export function EditorCanvas({
  map,
  onDropItem,
  zoom,
  setZoom,
  onRenameElement,
  onRenameMap,
  onDeleteElement,
  onDeleteTerritory,
  onCreateTerritory,
  onMoveTerritory,
  relationships,
  monitoring,
  connections,
  onConnect,
  onDisconnect,
  onRemoveConnection,
  onRemoveRelationship,
  showLinks,
  toggleLinks,
  inspectorOpen,
  actionsDisabled,
  hasTerritory,
  onToggleInspector,
  onAddArea,
  onAddDevice,
  onPlaceDevice,
  onOpenDevice,
  onActionError,
}: CanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const editingRef = useRef<ActiveEdit | null>(null);
  const selectionStartRef = useRef<{ x: number; y: number } | null>(null);
  const panGestureRef = useRef<{
    pointer: { x: number; y: number };
    origin: { x: number; y: number };
  } | null>(null);
  const spacePressedRef = useRef(false);
  const spaceTapRef = useRef(false);
  const spacePanUsedRef = useRef(false);
  const deviceClonePendingRef = useRef(false);
  const groupDragRef = useRef<{
    activeId: string;
    activeWorldX: number;
    activeWorldY: number;
    roots: Array<{ id: string; xMeters: number; yMeters: number }>;
  } | null>(null);
  const pointerPositionRef = useRef<{ x: number; y: number } | null>(null);
  const didCenter = useRef(false);
  const [editing, setEditing] = useState<ActiveEdit | null>(null);
  const [nodePanelOpen, setNodePanelOpen] = useState(false);
  const [nodeSearch, setNodeSearch] = useState('');
  const [focusNodeSearchRevision, setFocusNodeSearchRevision] = useState(0);
  const nodeSearchRef = useRef<HTMLInputElement>(null);
  const [viewport, setViewport] = useState({ width: 900, height: 650 });
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [territoryPreview, setTerritoryPreview] = useState<{ x: number; y: number } | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreview | null>(null);
  const [groupDragPreview, setGroupDragPreview] = useState<
    Record<string, { x: number; y: number }>
  >({});
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [marqueeSelectionIds, setMarqueeSelectionIds] = useState<string[]>([]);
  const [territorySelected, setTerritorySelected] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [spacePanActive, setSpacePanActive] = useState(false);
  const territory = territoryPreview ?? { x: map.originXMeters ?? 0, y: map.originYMeters ?? 0 };
  const [overlap, setOverlap] = useState<Overlap | null>(null);
  const [magnetOn, setMagnetOn] = useState(true);
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [menuTarget, setMenuTarget] = useState<string | null>(null);
  const [toolbarHovered, setToolbarHovered] = useState(false);
  const hoverTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hoverLast, setHoverLast] = useState<string | null>(null);
  const actionRef = useRef<HTMLDivElement>(null);
  const markHover = (id: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setHoverLast(id);
    setHoveredTarget(id);
  };
  const releaseHover = () => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    hoverTimeout.current = setTimeout(() => setHoveredTarget(null), 220);
  };
  const [territoryLocked, setTerritoryLocked] = useState(false);
  useEffect(
    () => () => {
      if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    },
    [],
  );
  useEffect(() => {
    if (!nodePanelOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('.canvas-node-panel, .canvas-action-rail')) {
        setNodePanelOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, [nodePanelOpen]);
  useEffect(() => {
    if (!menuTarget) return;
    const onDown = (event: PointerEvent) => {
      if (!actionRef.current?.contains(event.target as Node)) setMenuTarget(null);
    };
    const onEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuTarget(null);
    };
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onEsc);
    };
  }, [menuTarget]);
  const [guides, setGuides] = useState<{ vertical: number | null; horizontal: number | null }>({
    vertical: null,
    horizontal: null,
  });
  const [visibleFloor, setVisibleFloor] = useState<Record<string, string>>({});
  const { elements, selectedId, selectedIds, select, selectMany, update, updateMany } =
    useEditorStore();
  const getDisplayedBounds = useMemo(
    () => createPreviewBounds(elements, dragPreview),
    [elements, dragPreview],
  );
  const unit = useMemo(
    () =>
      clamp(
        Math.min(
          (viewport.width - 120) / map.widthMeters,
          (viewport.height - 120) / map.heightMeters,
        ),
        0.04,
        90,
      ),
    [viewport, map.widthMeters, map.heightMeters],
  );
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width,
        height = entry.contentRect.height;
      setViewport({ width, height });
      if (!didCenter.current && width > 0 && height > 0) {
        didCenter.current = true;
        const scale = clamp(
          Math.min((width - 120) / map.widthMeters, (height - 120) / map.heightMeters),
          0.04,
          90,
        );
        setPan({
          x: (width - map.widthMeters * scale) / 2 - (map.originXMeters ?? 0) * scale,
          y: (height - map.heightMeters * scale) / 2 - (map.originYMeters ?? 0) * scale,
        });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [map.widthMeters, map.heightMeters, map.originXMeters, map.originYMeters]);
  useEffect(() => {
    if (editing && inputRef.current && document.activeElement !== inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);
  useEffect(() => {
    if (!nodePanelOpen || focusNodeSearchRevision === 0) return;
    nodeSearchRef.current?.focus();
  }, [nodePanelOpen, focusNodeSearchRevision]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.code === 'Space' &&
        !target?.closest('input,textarea,select,[contenteditable="true"]')
      ) {
        if (!spacePressedRef.current) spacePanUsedRef.current = false;
        spacePressedRef.current = true;
        spaceTapRef.current = true;
        setSpacePanActive(true);
        event.preventDefault();
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === 'Space') {
        spacePressedRef.current = false;
        setSpacePanActive(false);
      }
    };
    const onBlur = () => {
      spacePressedRef.current = false;
      setSpacePanActive(false);
      spaceTapRef.current = false;
      spacePanUsedRef.current = false;
      panGestureRef.current = null;
      selectionStartRef.current = null;
      setSelectionRect(null);
      setMarqueeSelectionIds([]);
      setIsDragging(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);
  const pointerToMeters = useCallback(
    (px: number, py: number) => ({
      x: (px - pan.x) / (unit * zoom),
      y: (py - pan.y) / (unit * zoom),
    }),
    [pan, unit, zoom],
  );
  const zoomAt = useCallback(
    (next: number, x: number, y: number) => {
      const world = pointerToMeters(x, y);
      setZoom(next);
      setPan({ x: x - world.x * unit * next, y: y - world.y * unit * next });
    },
    [pointerToMeters, setZoom, unit],
  );
  const onWheel = (evt: Konva.KonvaEventObject<WheelEvent>) => {
    evt.evt.preventDefault();
    const p = stageRef.current?.getPointerPosition();
    if (!p) return;
    zoomAt(clamp(zoom * (evt.evt.deltaY > 0 ? 0.9 : 1.1), 0.3, 8), p.x, p.y);
  };
  const zoomIn = useCallback(() => {
    zoomAt(clamp(zoom * 1.2, 0.3, 8), viewport.width / 2, viewport.height / 2);
  }, [zoomAt, zoom, viewport.width, viewport.height]);
  const zoomOut = useCallback(() => {
    zoomAt(clamp(zoom / 1.2, 0.3, 8), viewport.width / 2, viewport.height / 2);
  }, [zoomAt, zoom, viewport.width, viewport.height]);
  const fitToScreen = useCallback(() => {
    setZoom(1);
    setPan({
      x: (viewport.width - map.widthMeters * unit) / 2 - (map.originXMeters ?? 0) * unit,
      y: (viewport.height - map.heightMeters * unit) / 2 - (map.originYMeters ?? 0) * unit,
    });
  }, [
    setZoom,
    viewport.width,
    viewport.height,
    map.widthMeters,
    map.heightMeters,
    map.originXMeters,
    map.originYMeters,
    unit,
  ]);
  // The dot grid is rendered in the same transformed Konva group as the map.
  const grid = useMemo(() => {
    const pxPerMeter = unit * zoom;
    // n8n-style dense dot grid: constant 17px spacing on screen, world-anchored while panning.
    const step = 17 / pxPerMeter;
    const left = -pan.x / pxPerMeter - step,
      right = (viewport.width - pan.x) / pxPerMeter + step;
    const top = -pan.y / pxPerMeter - step,
      bottom = (viewport.height - pan.y) / pxPerMeter + step;
    return { left, top, right, bottom, step };
  }, [unit, zoom, pan, viewport]);
  const grouped = useMemo(() => {
    const byParent = new Map<string | null, MapElement[]>();
    for (const el of elements) {
      const list = byParent.get(el.parentId) ?? [];
      list.push(el);
      byParent.set(el.parentId, list);
    }
    for (const items of byParent.values())
      items.sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
    return byParent;
  }, [elements]);
  const elementsById = useMemo(
    () => new Map(elements.map((element) => [element.id, element])),
    [elements],
  );
  const beginEdit = useCallback(
    (id: string, value: string) => {
      const edit = { id, value };
      editingRef.current = edit;
      setEditing(edit);
    },
    [setEditing],
  );
  useEffect(() => {
    const onSpaceKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || !spaceTapRef.current) return;
      spaceTapRef.current = false;
      if (spacePanUsedRef.current) {
        spacePanUsedRef.current = false;
        return;
      }
      const state = useEditorStore.getState();
      const element = state.elements.find((item) => item.id === state.selectedId);
      if (element) beginEdit(element.id, element.name);
    };
    window.addEventListener('keyup', onSpaceKeyUp);
    return () => window.removeEventListener('keyup', onSpaceKeyUp);
  }, [beginEdit]);
  function commitEdit(accept: boolean) {
    const current = editingRef.current;
    if (!current) return;
    editingRef.current = null;
    setEditing(null);
    if (!accept || !current.value.trim()) return;
    if (current.id === '__territory__') onRenameMap(current.value);
    else onRenameElement(current.id, current.value);
  }
  // Snap in global territory coordinates; include its edges and all eligible rooms.
  const snapPosition = (el: MapElement, x: number, y: number) => {
    if (!magnetOn) return { x, y, vertical: null, horizontal: null };
    const origin = absoluteOrigin(elements, el.parentId);
    const absolute = { x: origin.x + x, y: origin.y + y, w: el.widthMeters, h: el.heightMeters };
    const guidesList = [
      { x: 0, y: 0, w: map.widthMeters, h: map.heightMeters },
      ...elements
        .filter((other) => other.id !== el.id && !other.hidden && !isDescendantOf(other.id, el.id))
        .map((other) => absoluteBounds(elements, other)),
    ];
    const snapped = snapToGuides(absolute, guidesList, 9 / (unit * zoom));
    return {
      x: Number((snapped.x - origin.x).toFixed(3)),
      y: Number((snapped.y - origin.y).toFixed(3)),
      vertical: snapped.vertical,
      horizontal: snapped.horizontal,
    };
  };
  const isDescendantOf = (id: string, ancestor: string) => {
    const seen = new Set<string>();
    let node = elements.find((e) => e.id === id);
    while (node?.parentId && !seen.has(node.id)) {
      if (node.parentId === ancestor) return true;
      seen.add(node.id);
      node = elements.find((e) => e.id === node?.parentId);
    }
    return false;
  };
  function moveElement(el: MapElement, x: number, y: number) {
    setDragPreview(null);
    const group = groupDragRef.current;
    if (group?.activeId === el.id && group.roots.length > 1) {
      const origin = absoluteOrigin(elements, el.parentId);
      const deltaX = origin.x + x - group.activeWorldX;
      const deltaY = origin.y + y - group.activeWorldY;
      updateMany(
        group.roots.map((root) => ({
          id: root.id,
          change: { xMeters: root.xMeters + deltaX, yMeters: root.yMeters + deltaY },
        })),
      );
      setGuides({ vertical: null, horizontal: null });
      setOverlap(null);
      return;
    }
    const snap = snapPosition(el, x, y);
    const origin = absoluteOrigin(elements, el.parentId);
    const world = { x: origin.x + snap.x, y: origin.y + snap.y };
    setGuides({ vertical: null, horizontal: null });
    if (el.kind === 'AREA') {
      const target = findOverlap(elements, el, snap.x, snap.y);
      if (target) {
        update(el.id, { xMeters: snap.x, yMeters: snap.y });
        setOverlap({ movingId: el.id, targetId: target.id, x: snap.x, y: snap.y });
        return;
      }
    }
    setOverlap(null);
    // A room or a device dropped inside a container becomes its child.
    // Moving between parents preserves the world position of the element.
    const center = { x: world.x + el.widthMeters / 2, y: world.y + el.heightMeters / 2 };
    const parent = containingArea(elements, center, el.id, visibleFloor);
    const parentId = parent?.id ?? null;
    const local = localPositionFor(elements, world, parentId);
    update(el.id, { parentId, xMeters: local.x, yMeters: local.y });
  }
  function selectNode(id: string, additive: boolean) {
    setTerritorySelected(false);
    const state = useEditorStore.getState();
    if (!additive && state.selectedIds.includes(id)) {
      state.selectMany(state.selectedIds, id);
      return;
    }
    state.select(id, additive);
  }
  function localToFields(point: { x: number; y: number }) {
    return { xMeters: point.x, yMeters: point.y };
  }

  function chooseOverlap(choice: 'inside' | 'above' | 'separate') {
    const current = overlap;
    setOverlap(null);
    if (!current) return;
    const moving = elements.find((el) => el.id === current.movingId),
      target = elements.find((el) => el.id === current.targetId);
    if (!moving || !target || moving.kind !== 'AREA' || target.kind !== 'AREA') return;
    const sourceParent = absoluteOrigin(elements, moving.parentId);
    const globalX = sourceParent.x + current.x,
      globalY = sourceParent.y + current.y;
    const destination = absoluteBounds(elements, target);
    if (choice === 'separate') {
      update(moving.id, { parentId: null, ...localToFields({ x: globalX, y: globalY }) });
      return;
    }
    if (choice === 'inside') {
      const w = Math.min(moving.widthMeters, target.widthMeters),
        h = Math.min(moving.heightMeters, target.heightMeters);
      update(moving.id, {
        parentId: target.id,
        xMeters: clamp(globalX - destination.x, 0, Math.max(0, target.widthMeters - w)),
        yMeters: clamp(globalY - destination.y, 0, Math.max(0, target.heightMeters - h)),
        widthMeters: w,
        heightMeters: h,
        level: 0,
      });
    } else {
      const floors = floorsFor(elements, target);
      const maxLevel = Math.max(target.level, ...floors.map((f) => f.level));
      update(moving.id, {
        parentId: target.parentId,
        xMeters: target.xMeters,
        yMeters: target.yMeters,
        widthMeters: target.widthMeters,
        heightMeters: target.heightMeters,
        level: maxLevel + 1,
      });
      setVisibleFloor((prev) => ({ ...prev, [footprintKey(target)]: moving.id }));
    }
    setTerritorySelected(false);
    select(moving.id);
  }
  const renderNodes = (parentId: string | null): React.ReactNode => {
    const siblings = grouped.get(parentId) ?? [];
    return siblings
      .filter((el) => {
        if (el.hidden) return false;
        if (el.kind !== 'AREA') return true;
        const floors = floorsFor(elements, el);
        if (!floors.length) return true;
        const shown = visibleFloor[footprintKey(el)] ?? floors[floors.length - 1].id;
        return shown === el.id;
      })
      .map((el) => {
        const floors = floorsFor(elements, el);
        const floorIndex = floors.findIndex((f) => f.id === el.id);
        return (
          <EditorNode
            key={el.id}
            el={el}
            health={el.deviceId ? monitoring[el.deviceId] : undefined}
            connecting={pendingConnection !== null}
            spacePanActive={spacePanActive}
            unit={unit}
            zoom={zoom}
            position={groupDragPreview[el.id] ?? { x: el.xMeters, y: el.yMeters }}
            selected={selectedIds.includes(el.id) || marqueeSelectionIds.includes(el.id)}
            onSelect={(additive) => selectNode(el.id, additive)}
            onDraggingStateChange={(dragging, id) => {
              setIsDragging(dragging);
              if (!dragging) {
                groupDragRef.current = null;
                setGroupDragPreview({});
                return;
              }
              const current = useEditorStore.getState();
              const requested = current.selectedIds.includes(id) ? current.selectedIds : [id];
              let roots = selectionRoots(current.elements, requested).filter(
                (root) => !root.hidden && !root.locked,
              );
              if (!roots.some((root) => root.id === id)) {
                const active = current.elements.find((element) => element.id === id);
                roots = active && !active.hidden && !active.locked ? [active] : [];
              }
              const active = current.elements.find((element) => element.id === id);
              if (!active || !roots.length) return;
              const origin = absoluteOrigin(current.elements, active.parentId);
              groupDragRef.current = {
                activeId: id,
                activeWorldX: origin.x + active.xMeters,
                activeWorldY: origin.y + active.yMeters,
                roots: roots.map(({ id: rootId, xMeters, yMeters }) => ({
                  id: rootId,
                  xMeters,
                  yMeters,
                })),
              };
              setGroupDragPreview(
                Object.fromEntries(
                  roots.map((root) => [root.id, { x: root.xMeters, y: root.yMeters }]),
                ),
              );
            }}
            onHover={(enter) => (enter ? markHover(el.id) : releaseHover())}
            onUpdate={(change) => update(el.id, change)}
            onMove={(x, y) => moveElement(el, x, y)}
            onOpen={() => onOpenDevice(el.id)}
            onDragging={(x, y) => {
              const snapped = snapPosition(el, x, y);
              setDragPreview((previous) =>
                previous?.id === el.id && previous.x === snapped.x && previous.y === snapped.y
                  ? previous
                  : { id: el.id, x: snapped.x, y: snapped.y },
              );
              setGuides((previous) =>
                previous.vertical === snapped.vertical && previous.horizontal === snapped.horizontal
                  ? previous
                  : { vertical: snapped.vertical, horizontal: snapped.horizontal },
              );
              const group = groupDragRef.current;
              if (group?.activeId === el.id && group.roots.length > 1) {
                const origin = absoluteOrigin(elements, el.parentId);
                const offset = {
                  x: origin.x + snapped.x - group.activeWorldX,
                  y: origin.y + snapped.y - group.activeWorldY,
                };
                setGroupDragPreview(
                  Object.fromEntries(
                    group.roots.map((root) => [
                      root.id,
                      { x: root.xMeters + offset.x, y: root.yMeters + offset.y },
                    ]),
                  ),
                );
              }
              return { x: snapped.x, y: snapped.y };
            }}
            onEdit={() => beginEdit(el.id, el.name)}
            floorLabel={floors.length > 1 ? `${floorIndex + 1}/${floors.length}` : null}
            onSwitchFloor={() => {
              const next = floors[(floorIndex + 1) % floors.length];
              setVisibleFloor((prev) => ({ ...prev, [footprintKey(el)]: next.id }));
              setTerritorySelected(false);
              select(next.id);
            }}
          >
            {el.kind === 'AREA' ? renderNodes(el.id) : null}
          </EditorNode>
        );
      });
  };
  const copyElements = useCallback((ids: string[]) => {
    const payload = useEditorStore.getState().copy(ids);
    if (payload && typeof navigator !== 'undefined')
      void navigator.clipboard?.writeText(payload).catch(() => undefined);
  }, []);
  const duplicateElements = useCallback(
    async (ids: string[]) => {
      if (actionsDisabled || deviceClonePendingRef.current) return;
      const current = useEditorStore.getState();
      const deviceIds = deviceIdsForSelection(current.elements, ids);
      deviceClonePendingRef.current = true;
      try {
        const deviceCopies = await cloneInventoryDevices(deviceIds);
        useEditorStore.getState().duplicate(ids, deviceCopies);
      } catch (error) {
        onActionError(error instanceof Error ? error.message : String(error));
      } finally {
        deviceClonePendingRef.current = false;
      }
    },
    [actionsDisabled, onActionError],
  );
  const pasteElements = useCallback(() => {
    if (actionsDisabled || !hasTerritory || deviceClonePendingRef.current) return;
    const screen = pointerPositionRef.current ?? {
      x: viewport.width / 2,
      y: viewport.height / 2,
    };
    const world = pointerToMeters(screen.x, screen.y);
    const paste = async () => {
      const current = useEditorStore.getState();
      if (!current.clipboard.length || deviceClonePendingRef.current) return;
      const deviceIds = [
        ...new Set(
          current.clipboard.flatMap((element) => (element.deviceId ? [element.deviceId] : [])),
        ),
      ];
      deviceClonePendingRef.current = true;
      try {
        const deviceCopies = await cloneInventoryDevices(deviceIds);
        useEditorStore.getState().pasteAt(
          {
            x: world.x - territory.x,
            y: world.y - territory.y,
          },
          20 / (unit * zoom),
          deviceCopies,
        );
      } catch (error) {
        onActionError(error instanceof Error ? error.message : String(error));
      } finally {
        deviceClonePendingRef.current = false;
      }
    };
    const readClipboard =
      typeof navigator === 'undefined' ? undefined : navigator.clipboard?.readText;
    if (!readClipboard) {
      void paste();
      return;
    }
    void readClipboard
      .call(navigator.clipboard)
      .then((text) => {
        if (useEditorStore.getState().restoreClipboard(text)) void paste();
      })
      .catch(() => void paste());
  }, [
    actionsDisabled,
    hasTerritory,
    onActionError,
    pointerToMeters,
    territory.x,
    territory.y,
    unit,
    viewport.width,
    viewport.height,
    zoom,
  ]);
  // Keyboard accelerators mirror familiar n8n editor gestures for actions this map supports.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key === 'Escape' && nodePanelOpen) {
        event.preventDefault();
        setNodePanelOpen(false);
        return;
      }
      if (target?.closest('input,textarea,select,[contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      const ctrl = event.ctrlKey || event.metaKey;
      const state = useEditorStore.getState();
      if (ctrl && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
      } else if (ctrl && key === 'y') {
        event.preventDefault();
        state.redo();
      } else if (ctrl && key === 'a') {
        event.preventDefault();
        const ids = stageRef.current?.find('.infra-node').map((node) => node.id()) ?? [];
        setTerritorySelected(false);
        state.selectMany(ids);
      } else if (ctrl && key === 'c' && state.selectedIds.length) {
        event.preventDefault();
        copyElements(state.selectedIds);
      } else if (ctrl && key === 'v') {
        event.preventDefault();
        pasteElements();
      } else if (ctrl && key === 'd' && state.selectedIds.length) {
        event.preventDefault();
        void duplicateElements(state.selectedIds);
      } else if (ctrl && key === 's') {
        // Browser save dialog must not appear; the save command lives in InfraApp.
        event.preventDefault();
        document.querySelector<HTMLButtonElement>('[aria-label="Salvar mapa"]')?.click();
      } else if (!ctrl && !event.altKey && key === 'l' && state.selectedId) {
        event.preventDefault();
        const element = state.elements.find((item) => item.id === state.selectedId);
        if (element) useEditorStore.getState().update(element.id, { locked: !element.locked });
      } else if (ctrl && key === ']' && state.selectedId) {
        event.preventDefault();
        state.reorder(state.selectedId, 1);
      } else if (ctrl && key === '[' && state.selectedId) {
        event.preventDefault();
        state.reorder(state.selectedId, -1);
      } else if (
        !ctrl &&
        !event.altKey &&
        (event.key === 'Delete' || event.key === 'Backspace') &&
        state.selectedIds.length
      ) {
        event.preventDefault();
        onDeleteElement(state.selectedIds);
      } else if (event.key === 'Escape') {
        if (nodePanelOpen) setNodePanelOpen(false);
        else {
          setTerritorySelected(false);
          setMarqueeSelectionIds([]);
          select(null);
        }
      } else if (!ctrl && !event.altKey && !event.shiftKey && key === 'n') {
        event.preventDefault();
        setNodePanelOpen((open) => !open);
      } else if (!ctrl && !event.altKey && event.shiftKey && key === 's' && !actionsDisabled) {
        event.preventDefault();
        onAddArea();
      } else if (!ctrl && !event.altKey && !event.shiftKey && key === 'i') {
        event.preventDefault();
        onToggleInspector();
      } else if (!ctrl && !event.altKey && key === '1') {
        event.preventDefault();
        fitToScreen();
      } else if (!ctrl && !event.altKey && (event.key === '+' || event.key === '=')) {
        event.preventDefault();
        zoomIn();
      } else if (!ctrl && !event.altKey && event.key === '-') {
        event.preventDefault();
        zoomOut();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    onAddArea,
    actionsDisabled,
    onDeleteElement,
    onToggleInspector,
    select,
    fitToScreen,
    zoomIn,
    zoomOut,
    nodePanelOpen,
    copyElements,
    duplicateElements,
    pasteElements,
  ]);
  const devicePorts = elements
    .filter((el) => el.kind === 'DEVICE' && !el.hidden)
    .map((el) => {
      const position = getDisplayedBounds(el);
      const screenX = pan.x + (territory.x + position.x) * unit * zoom;
      const screenY = pan.y + (territory.y + position.y) * unit * zoom;
      return {
        id: el.id,
        name: el.name,
        x: screenX,
        y: screenY,
        width: el.widthMeters * 20,
        height: el.heightMeters * 20,
      };
    });
  const gesture = useConnectionGesture(devicePorts, onConnect);
  const pendingConnection = gesture.draft?.sourceId ?? null;
  const targetPort = gesture.draft
    ? connectionTarget(devicePorts, gesture.draft.cursor, gesture.draft.sourceId)
    : undefined;
  const sourcePort = devicePorts.find((port) => port.id === pendingConnection);
  const connectionPreview =
    gesture.draft && sourcePort
      ? {
          curve: connectionCurve(
            portEndpoint(sourcePort, gesture.draft.side),
            targetPort
              ? portEndpoint(targetPort, targetPort.x >= sourcePort.x ? 'input' : 'output')
              : {
                  ...gesture.draft.cursor,
                  side: gesture.draft.side === 'output' ? 'input' : 'output',
                },
          ),
          valid: Boolean(targetPort),
        }
      : null;
  const connectionPorts = devicePorts.filter(
    (port) => port.id === selectedId || port.id === hoveredTarget || pendingConnection !== null,
  );
  const connectionLines: CanvasConnection[] = connections.flatMap((link) => {
    const source = elements.find((el) => el.id === link.sourceElementId);
    const target = elements.find((el) => el.id === link.targetElementId);
    const from = devicePorts.find((port) => port.id === source?.id),
      to = devicePorts.find((port) => port.id === target?.id);
    if (!source || !target || !from || !to) return [];
    const computer =
      source.device?.kind === 'COMPUTER'
        ? source
        : target.device?.kind === 'COMPUTER'
          ? target
          : null;
    const printer =
      source.device?.kind === 'PRINTER'
        ? source
        : target.device?.kind === 'PRINTER'
          ? target
          : null;
    const health = computer?.deviceId ? monitoring[computer.deviceId] : undefined;
    const relation = health?.relations.find((row) => row.printerId === printer?.deviceId);
    const printerHealth = printer?.deviceId ? monitoring[printer.deviceId] : undefined;
    const printServerObservation = printerHealth?.observations.find(
      (row) => row.source === 'PRINT_SERVER',
    );
    const color =
      link.kind === 'SERVES'
        ? printerHealth?.state === 'STALE' || printerHealth?.state === 'DISABLED'
          ? healthColor.UNKNOWN
          : printServerObservation
            ? healthColor[printServerObservation.status]
            : healthColor.UNKNOWN
        : computer && printer
          ? health?.state === 'STALE' || health?.state === 'DISABLED'
            ? healthColor.UNKNOWN
            : relation
              ? healthColor[relation.status]
              : healthColor.UNKNOWN
          : '#666a73';
    const endpoints = facingEndpoints(from, to);
    return [
      {
        id: link.id,
        label:
          link.kind === 'SERVES'
            ? `Servidor ${source.device?.kind === 'SERVER' ? source.name : target.name} hospeda a fila ${printer?.name ?? 'da impressora'}`
            : link.kind === 'PRINTING'
              ? `${computer?.name ?? 'Computador'} possui a fila ${printer?.name ?? 'instalada'}`
              : `Conexão entre ${source.name} e ${target.name}`,
        curve: connectionCurve(endpoints.from, endpoints.to),
        color,
        dashed: link.kind === 'SERVES',
      },
    ];
  });
  const selectedDeviceId = elements.find((el) => el.id === selectedId)?.deviceId;
  const linkedLines: CanvasConnection[] = relationships.flatMap((relationship) => {
    if (selectedDeviceId !== relationship.computerId && selectedDeviceId !== relationship.printerId)
      return [];
    const computer = elements.find((el) => el.deviceId === relationship.computerId);
    const printer = elements.find((el) => el.deviceId === relationship.printerId);
    const from = devicePorts.find((port) => port.id === computer?.id),
      to = devicePorts.find((port) => port.id === printer?.id);
    if (
      !computer ||
      !printer ||
      !from ||
      !to ||
      connections.some(
        (link) =>
          (link.sourceElementId === computer.id && link.targetElementId === printer.id) ||
          (link.sourceElementId === printer.id && link.targetElementId === computer.id),
      )
    )
      return [];
    const endpoints = facingEndpoints(from, to);
    return [
      {
        id: `assignment:${relationship.computerId}:${relationship.printerId}`,
        label: `Conexão entre ${computer.name} e ${printer.name}`,
        curve: connectionCurve(endpoints.from, endpoints.to),
        color: '#84858e',
        dashed: true,
        relationship,
      },
    ];
  });
  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    const kind = event.dataTransfer.getData('application/x-infra-element');
    if (!kind) return;
    const bounds = containerRef.current!.getBoundingClientRect(),
      raw = pointerToMeters(event.clientX - bounds.left, event.clientY - bounds.top);
    const world = { x: raw.x - territory.x, y: raw.y - territory.y };
    const parentId = containingArea(elements, world, undefined, visibleFloor)?.id ?? null;
    if (kind === 'AREA' && parentId) {
      // Dropping a new room over another room offers the same spatial relation choices.
      const created = onDropItem(kind, world.x, world.y, null);
      if (created) setOverlap({ movingId: created, targetId: parentId, x: world.x, y: world.y });
    } else {
      const origin = absoluteOrigin(elements, parentId);
      onDropItem(kind, Math.max(0, world.x - origin.x), Math.max(0, world.y - origin.y), parentId);
    }
  };
  // The contextual toolbar is ordinary HTML rather than Konva artwork.
  // It keeps Lucide SVGs, menu hitboxes and tooltips crisp at EVERY zoom level.
  const candidate = menuTarget ?? (toolbarHovered ? hoverLast : (hoveredTarget ?? selectedId));
  const targetIsTerritory = hasTerritory && candidate === '__territory__';
  const actionElement = targetIsTerritory
    ? null
    : elements.find((el) => el.id === candidate && !el.hidden);
  const actionTarget = targetIsTerritory || actionElement ? candidate : null;
  const elementWorld = actionElement ? getDisplayedBounds(actionElement) : null;
  const screenLeft = targetIsTerritory
    ? pan.x + territory.x * unit * zoom
    : elementWorld
      ? pan.x + (territory.x + elementWorld.x) * unit * zoom
      : 0;
  const screenTop = targetIsTerritory
    ? pan.y + territory.y * unit * zoom
    : elementWorld
      ? pan.y + (territory.y + elementWorld.y) * unit * zoom
      : 0;
  const screenWidth = targetIsTerritory
    ? map.widthMeters * unit * zoom
    : actionElement
      ? actionElement.kind === 'AREA'
        ? actionElement.widthMeters * unit * zoom
        : actionElement.widthMeters * 20
      : 0;
  const toolbarX = clamp(screenLeft + screenWidth / 2, 75, Math.max(75, viewport.width - 75));
  const toolbarY = clamp(screenTop - 12, 44, Math.max(44, viewport.height - 32));
  const actionLocked = targetIsTerritory ? territoryLocked : Boolean(actionElement?.locked);
  const clearMenu = () => {
    setMenuTarget(null);
    setToolbarHovered(false);
  };
  const runAction = (fn: () => void) => {
    clearMenu();
    fn();
  };
  const lockTarget = () => {
    if (targetIsTerritory) setTerritoryLocked((value) => !value);
    else if (actionElement) update(actionElement.id, { locked: !actionElement.locked });
  };
  const renameTarget = () => {
    if (targetIsTerritory) beginEdit('__territory__', map.name);
    else if (actionElement) beginEdit(actionElement.id, actionElement.name);
  };
  const deleteTarget = () => {
    if (targetIsTerritory) onDeleteTerritory();
    else if (actionElement)
      onDeleteElement(selectedIds.includes(actionElement.id) ? selectedIds : [actionElement.id]);
  };
  // Menu descriptions must stay data-only: callbacks carrying refs must not be
  // placed in values traversed during React render (react-hooks/refs).
  const menuEntries: ContextMenuAction[] = targetIsTerritory
    ? [
        { id: 'rename', label: 'Renomear', shortcut: '', icon: PenLine },
        { id: 'fit', label: 'Ajustar à tela', shortcut: '1', icon: ScanSearch },
        {
          id: 'lock',
          label: actionLocked ? 'Desbloquear' : 'Bloquear',
          shortcut: '',
          icon: actionLocked ? LockKeyholeOpen : LockKeyhole,
        },
        {
          id: 'delete',
          label: 'Excluir território',
          shortcut: '',
          icon: Trash2,
          danger: true,
          divider: true,
        },
      ]
    : actionElement
      ? [
          { id: 'rename', label: 'Renomear', shortcut: 'Space', icon: PenLine },
          {
            id: 'lock',
            label: actionLocked ? 'Desbloquear' : 'Bloquear',
            shortcut: 'L',
            icon: actionLocked ? LockKeyholeOpen : LockKeyhole,
          },
          { id: 'copy', label: 'Copiar', shortcut: 'Ctrl C', icon: Copy },
          { id: 'duplicate', label: 'Duplicar elemento', shortcut: 'Ctrl D', icon: CopyPlus },
          { id: 'disconnect', label: 'Remover conexões', shortcut: '', icon: Link2 },
          { id: 'align', label: 'Alinhar à grade', shortcut: '', icon: Grid3X3 },
          { id: 'clear', label: 'Limpar seleção', shortcut: 'Esc', icon: XCircle, divider: true },
          { id: 'forward', label: 'Avançar camada', shortcut: 'Ctrl ]', icon: ArrowUp },
          { id: 'backward', label: 'Recuar camada', shortcut: 'Ctrl [', icon: ArrowDown },
          { id: 'hide', label: 'Ocultar', shortcut: '', icon: EyeOff, divider: true },
          {
            id: 'delete',
            label: 'Excluir',
            shortcut: 'Del',
            icon: Trash2,
            danger: true,
            divider: true,
          },
        ]
      : [];
  // Invoked exclusively by user events, never while constructing menu entries.
  const runMenuAction = (id: ContextMenuActionId) => {
    switch (id) {
      case 'rename':
        runAction(renameTarget);
        break;
      case 'copy':
        if (actionElement)
          runAction(() =>
            copyElements(selectedIds.includes(actionElement.id) ? selectedIds : [actionElement.id]),
          );
        break;
      case 'duplicate':
        if (actionElement)
          runAction(
            () =>
              void duplicateElements(
                selectedIds.includes(actionElement.id) ? selectedIds : [actionElement.id],
              ),
          );
        break;
      case 'align':
        if (actionElement)
          runAction(() =>
            update(actionElement.id, {
              xMeters: Math.round(actionElement.xMeters / 2) * 2,
              yMeters: Math.round(actionElement.yMeters / 2) * 2,
            }),
          );
        break;
      case 'clear':
        runAction(() => {
          setTerritorySelected(false);
          setMarqueeSelectionIds([]);
          select(null);
        });
        break;
      case 'disconnect':
        if (actionElement) runAction(() => onDisconnect(actionElement.id));
        break;
      case 'fit':
        runAction(fitToScreen);
        break;
      case 'lock':
        runAction(lockTarget);
        break;
      case 'delete':
        runAction(deleteTarget);
        break;
      case 'forward':
        if (actionElement) runAction(() => useEditorStore.getState().reorder(actionElement.id, 1));
        break;
      case 'backward':
        if (actionElement) runAction(() => useEditorStore.getState().reorder(actionElement.id, -1));
        break;
      case 'hide':
        if (actionElement)
          runAction(() => {
            update(actionElement.id, { hidden: true });
            select(null);
          });
        break;
    }
  };

  const editElement =
    editing?.id === '__territory__' ? null : elements.find((el) => el.id === editing?.id);
  const editOrigin = editElement ? absoluteOrigin(elements, editElement.parentId) : { x: 0, y: 0 };
  const editX = editElement
    ? pan.x +
      zoom * ((territory.x + editOrigin.x + editElement.xMeters) * unit) +
      (editElement.kind === 'AREA' ? 34 : 10)
    : pan.x + territory.x * unit * zoom + 16;
  const editY = editElement
    ? pan.y +
      zoom * ((territory.y + editOrigin.y + editElement.yMeters) * unit) +
      (editElement.kind === 'AREA' ? 7 : editElement.heightMeters * 20 + 8)
    : pan.y + territory.y * unit * zoom + 10;
  const getMarqueeSelectionIds = (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    const stage = stageRef.current;
    if (!stage) return [];
    const left = bounds.x;
    const top = bounds.y;
    const right = bounds.x + bounds.width;
    const bottom = bounds.y + bounds.height;
    return stage
      .find('.infra-node-selection-target')
      .filter((selectionTarget) => {
        const nodeBounds = selectionTarget.getClientRect({ relativeTo: stage });
        return (
          nodeBounds.x < right &&
          nodeBounds.x + nodeBounds.width > left &&
          nodeBounds.y < bottom &&
          nodeBounds.y + nodeBounds.height > top
        );
      })
      .map((selectionTarget) => selectionTarget.getParent()?.id())
      .filter((id): id is string => Boolean(id));
  };
  const marqueeSelectsTerritory = (bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  }) => {
    if (!hasTerritory) return false;
    const header = {
      x: pan.x + territory.x * unit * zoom + 8,
      y: pan.y + territory.y * unit * zoom + 8,
      width: map.widthMeters * unit * zoom - 16,
      height: 35,
    };
    return (
      bounds.x < header.x + header.width &&
      bounds.x + bounds.width > header.x &&
      bounds.y < header.y + header.height &&
      bounds.y + bounds.height > header.y
    );
  };
  return (
    <div
      ref={containerRef}
      className={`canvas${isDragging ? ' is-dragging' : ''}`}
      onPointerMove={gesture.onPointerMove}
      onPointerUp={gesture.onPointerUp}
      onPointerCancel={gesture.onPointerCancel}
      onLostPointerCapture={gesture.onLostPointerCapture}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={viewport.width}
        height={viewport.height}
        onWheel={onWheel}
        onMouseDown={(event) => {
          if (pendingConnection !== null) return;
          const stage = event.target.getStage();
          const pointer = stage?.getPointerPosition();
          const isNode =
            event.target.hasName('infra-node') || Boolean(event.target.findAncestor('.infra-node'));
          const isPanGesture =
            event.evt.button === 1 || (event.evt.button === 0 && spacePressedRef.current);
          const isTerritoryHandle =
            event.target.hasName('territory-drag-handle') ||
            Boolean(event.target.findAncestor('.territory-drag-handle'));
          if (isPanGesture && pointer) {
            event.evt.preventDefault();
            stage?.stopDrag();
            event.cancelBubble = true;
            if (spacePressedRef.current && event.evt.button === 0) spacePanUsedRef.current = true;
            panGestureRef.current = { pointer, origin: pan };
            setIsDragging(true);
            return;
          }
          const clickedNode = event.target.hasName('infra-node')
            ? event.target
            : event.target.findAncestor('.infra-node');
          if (clickedNode && event.evt.button === 0 && elementsById.has(clickedNode.id())) {
            event.cancelBubble = true;
            selectNode(clickedNode.id(), event.evt.ctrlKey || event.evt.metaKey);
            return;
          }
          if (!isNode && !isTerritoryHandle && event.evt.button === 0) {
            if (!pointer) return;
            event.evt.preventDefault();
            stage?.stopDrag();
            event.cancelBubble = true;
            select(null);
            setTerritorySelected(event.target.hasName('territory-background'));
            setMarqueeSelectionIds([]);
            selectionStartRef.current = pointer;
            setSelectionRect({ x: pointer.x, y: pointer.y, width: 0, height: 0 });
            return;
          }
          if (event.evt.button === 0 && isTerritoryHandle) {
            select(null);
            setTerritorySelected(true);
          } else if (event.evt.button === 0 && !isNode) {
            select(null);
            setTerritorySelected(false);
          }
        }}
        onMouseMove={() => {
          const pointer = stageRef.current?.getPointerPosition();
          if (!pointer) return;
          pointerPositionRef.current = pointer;
          const panGesture = panGestureRef.current;
          if (panGesture) {
            setPan({
              x: panGesture.origin.x + pointer.x - panGesture.pointer.x,
              y: panGesture.origin.y + pointer.y - panGesture.pointer.y,
            });
            return;
          }
          const start = selectionStartRef.current;
          if (start) {
            const nextRect = {
              x: Math.min(start.x, pointer.x),
              y: Math.min(start.y, pointer.y),
              width: Math.abs(pointer.x - start.x),
              height: Math.abs(pointer.y - start.y),
            };
            setSelectionRect(nextRect);
            if (nextRect.width > 3 && nextRect.height > 3) {
              setTerritorySelected(marqueeSelectsTerritory(nextRect));
              setMarqueeSelectionIds(getMarqueeSelectionIds(nextRect));
            } else {
              setMarqueeSelectionIds([]);
            }
          }
        }}
        onMouseUp={() => {
          const start = selectionStartRef.current;
          const stage = stageRef.current;
          const pointer = stage?.getPointerPosition();
          if (panGestureRef.current) {
            panGestureRef.current = null;
            setIsDragging(false);
            return;
          }
          selectionStartRef.current = null;
          if (!start || !stage || !pointer) {
            setSelectionRect(null);
            setMarqueeSelectionIds([]);
            return;
          }
          const finalRect = {
            x: Math.min(start.x, pointer.x),
            y: Math.min(start.y, pointer.y),
            width: Math.abs(pointer.x - start.x),
            height: Math.abs(pointer.y - start.y),
          };
          if (finalRect.width > 3 && finalRect.height > 3) {
            const ids = getMarqueeSelectionIds(finalRect);
            setTerritorySelected(marqueeSelectsTerritory(finalRect));
            selectMany(ids);
          }
          setSelectionRect(null);
          setMarqueeSelectionIds([]);
        }}
      >
        <Layer>
          <Group x={pan.x} y={pan.y} scaleX={zoom} scaleY={zoom}>
            <Rect
              name="canvas-background"
              x={grid.left * unit}
              y={grid.top * unit}
              width={(grid.right - grid.left) * unit}
              height={(grid.bottom - grid.top) * unit}
              fill="#fafafa"
              listening={true}
            />
            <Shape
              listening={false}
              perfectDrawEnabled={false}
              fill="#c9cbd0"
              sceneFunc={(context, shape) => {
                const step = grid.step;
                context.beginPath();
                for (let x = Math.floor(grid.left / step) * step; x <= grid.right; x += step) {
                  for (let y = Math.floor(grid.top / step) * step; y <= grid.bottom; y += step) {
                    context.moveTo(x * unit + 0.8 / zoom, y * unit);
                    context.arc(x * unit, y * unit, 0.8 / zoom, 0, Math.PI * 2);
                  }
                }
                context.fillShape(shape);
              }}
            />

            {hasTerritory && (
              <Group
                x={territory.x * unit}
                y={territory.y * unit}
                draggable={!territoryLocked && pendingConnection === null}
                onDragStart={() => {
                  setIsDragging(true);
                  setTerritorySelected(true);
                  select(null);
                }}
                onDragMove={(event) => {
                  if (event.target === event.currentTarget)
                    setTerritoryPreview({ x: event.target.x() / unit, y: event.target.y() / unit });
                }}
                onMouseEnter={(event) => {
                  if (!event.target.findAncestor('.infra-node')) markHover('__territory__');
                }}
                onMouseLeave={releaseHover}
                onDragEnd={(event) => {
                  if (event.target === event.currentTarget) {
                    setIsDragging(false);
                    onMoveTerritory({
                      x: Number((event.target.x() / unit).toFixed(3)),
                      y: Number((event.target.y() / unit).toFixed(3)),
                    });
                    setTerritoryPreview(null);
                  }
                }}
              >
                <Rect
                  name="territory-background"
                  x={0}
                  y={0}
                  width={map.widthMeters * unit}
                  height={map.heightMeters * unit}
                  cornerRadius={10}
                  fill="#fff"
                  stroke={territorySelected ? '#c4c8ce' : '#b8babf'}
                  strokeWidth={territorySelected ? 3 / zoom : 1.5 / zoom}
                  shadowColor="#25272a"
                  shadowBlur={territorySelected ? 12 / zoom : 10 / zoom}
                  shadowOpacity={territorySelected ? 0.14 : 0.045}
                  shadowOffsetY={3 / zoom}
                  onClick={() => {
                    select(null);
                    setTerritorySelected(true);
                  }}
                />
                <Rect
                  x={8 / zoom}
                  y={8 / zoom}
                  width={Math.max(5, map.widthMeters * unit - 16 / zoom)}
                  height={35 / zoom}
                  cornerRadius={7 / zoom}
                  fill="#fafafa"
                  name="territory-drag-handle"
                />
                <Group x={17 / zoom} y={19 / zoom} scaleX={1 / zoom} scaleY={1 / zoom}>
                  <Text
                    name="territory-drag-handle"
                    fontSize={13}
                    fontStyle="bold"
                    text={map.name}
                    fill="#303236"
                    onClick={(event) => {
                      event.cancelBubble = true;
                      select(null);
                      setTerritorySelected(true);
                      beginEdit('__territory__', map.name);
                    }}
                    onTap={(event) => {
                      event.cancelBubble = true;
                      select(null);
                      setTerritorySelected(true);
                      beginEdit('__territory__', map.name);
                    }}
                  />
                </Group>
                <Group
                  x={Math.max(40 / zoom, map.widthMeters * unit - 76 / zoom)}
                  y={19 / zoom}
                  scaleX={1 / zoom}
                  scaleY={1 / zoom}
                >
                  <Text text="⠿" fontSize={16} fill="#8d8e94" listening={false} />
                </Group>

                {renderNodes(null)}
              </Group>
            )}
            {guides.vertical !== null && (
              <Line
                points={[
                  (territory.x + guides.vertical) * unit,
                  grid.top * unit,
                  (territory.x + guides.vertical) * unit,
                  grid.bottom * unit,
                ]}
                stroke="#ff6d5a"
                dash={[5 / zoom, 5 / zoom]}
                strokeWidth={1 / zoom}
                listening={false}
              />
            )}
            {guides.horizontal !== null && (
              <Line
                points={[
                  grid.left * unit,
                  (territory.y + guides.horizontal) * unit,
                  grid.right * unit,
                  (territory.y + guides.horizontal) * unit,
                ]}
                stroke="#ff6d5a"
                dash={[5 / zoom, 5 / zoom]}
                strokeWidth={1 / zoom}
                listening={false}
              />
            )}
          </Group>
          {selectionRect && (
            <Rect
              x={selectionRect.x}
              y={selectionRect.y}
              width={selectionRect.width}
              height={selectionRect.height}
              fill="rgba(111, 119, 130, 0.1)"
              stroke="#7c838d"
              strokeWidth={1}
              listening={false}
            />
          )}
        </Layer>
      </Stage>
      {!hasTerritory && (
        <div className="canvas-empty-territory">
          <button
            className="canvas-empty-territory-button"
            type="button"
            disabled={actionsDisabled}
            aria-label="Adicionar território"
            onClick={() => setNodePanelOpen(true)}
          >
            <Plus size={28} strokeWidth={1.7} />
          </button>
          <span>Adicionar território</span>
        </div>
      )}
      <ConnectionLayer
        connections={showLinks ? [...connectionLines, ...linkedLines] : []}
        preview={connectionPreview}
        onRemove={(connection) => {
          if (connection.relationship)
            onRemoveRelationship(
              connection.relationship.computerId,
              connection.relationship.printerId,
            );
          else onRemoveConnection(connection.id);
        }}
      />
      <ConnectionPorts
        ports={connectionPorts}
        pending={pendingConnection}
        targetId={targetPort?.id ?? null}
        onCancel={gesture.cancel}
        onPointerDown={gesture.onPortPointerDown}
        onKeyboardClick={gesture.onPortKeyboardClick}
      />
      <div className="canvas-ui-overlay">
        <ContextToolbar
          actionTarget={actionTarget}
          targetIsTerritory={targetIsTerritory}
          actionLocked={actionLocked}
          menuTarget={menuTarget}
          toolbarX={toolbarX}
          toolbarY={toolbarY}
          viewport={viewport}
          actionRef={actionRef}
          onEnter={() => {
            if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
            setToolbarHovered(true);
          }}
          onLeave={() => {
            setToolbarHovered(false);
            releaseHover();
          }}
          onToggleMenu={() =>
            setMenuTarget((previous) => (previous === actionTarget ? null : actionTarget))
          }
          onLock={() => runAction(lockTarget)}
          onDelete={() => runAction(deleteTarget)}
          onAction={runMenuAction}
          menuEntries={menuEntries}
        />
        {editing && (editing.id === '__territory__' || editElement) && (
          <input
            ref={inputRef}
            className="inline-edit"
            aria-label="Editar nome"
            value={editing.value}
            style={{
              left: clamp(editX, 8, Math.max(8, viewport.width - 184)),
              top: clamp(editY, 8, Math.max(8, viewport.height - 40)),
              width: 184,
            }}
            onChange={(event) => {
              const next = { id: editing.id, value: event.target.value };
              editingRef.current = next;
              setEditing(next);
            }}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === 'Enter') {
                event.preventDefault();
                commitEdit(true);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                commitEdit(false);
              }
            }}
            onBlur={() => commitEdit(true)}
          />
        )}
      </div>
      {overlap && (
        <div className="overlap-dialog" role="dialog" aria-label="Organizar ambientes sobrepostos">
          <div className="overlap-heading">
            <span className="overlap-icon">
              <Layers3 size={17} />
            </span>
            <div>
              <strong>Ambientes sobrepostos</strong>
              <p>Como deseja relacionar os retângulos?</p>
            </div>
            <button
              className="ghost-icon"
              aria-label="Fechar"
              onClick={() => chooseOverlap('separate')}
            >
              <X size={15} />
            </button>
          </div>
          <div className="overlap-choices">
            <button onClick={() => chooseOverlap('inside')}>
              <ArrowDownToLine size={17} />
              <span>
                Colocar dentro <small>Subdividir o setor</small>
              </span>
            </button>
            <button onClick={() => chooseOverlap('above')}>
              <ArrowUpFromLine size={17} />
              <span>
                Criar nível superior <small>Navegar entre andares</small>
              </span>
            </button>
            <button onClick={() => chooseOverlap('separate')}>
              <Move size={17} />
              <span>
                Manter independente <small>Somente sobreposição visual</small>
              </span>
            </button>
          </div>
        </div>
      )}
      <CanvasNavigation
        zoom={zoom}
        magnetOn={magnetOn}
        showLinks={showLinks}
        onFit={fitToScreen}
        onZoomIn={zoomIn}
        onZoomOut={zoomOut}
        onMagnet={() => setMagnetOn((value) => !value)}
        onLinks={toggleLinks}
      />
      <CanvasActionBar
        nodePanelOpen={nodePanelOpen}
        inspectorOpen={inspectorOpen}
        actionsDisabled={actionsDisabled}
        hasTerritory={hasTerritory}
        onToggleNodePanel={() => setNodePanelOpen((open) => !open)}
        onSearchNodes={() => {
          setNodePanelOpen(true);
          setFocusNodeSearchRevision((revision) => revision + 1);
        }}
        onAddArea={onAddArea}
        onToggleInspector={onToggleInspector}
      />
      {nodePanelOpen && (
        <CanvasNodePanel
          disabled={actionsDisabled}
          hasTerritory={hasTerritory}
          search={nodeSearch}
          searchInputRef={nodeSearchRef}
          onSearchChange={setNodeSearch}
          onAddArea={onAddArea}
          onCreateTerritory={onCreateTerritory}
          onAddDevice={onAddDevice}
          onPlaceDevice={onPlaceDevice}
          onClose={() => setNodePanelOpen(false)}
        />
      )}
    </div>
  );
}
