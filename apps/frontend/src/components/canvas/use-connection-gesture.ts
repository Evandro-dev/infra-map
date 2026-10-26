'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  connectionTarget,
  portEndpoint,
  type ConnectionPortPosition,
  type Point,
  type PortSide,
} from './connection-geometry';

interface Draft {
  sourceId: string;
  side: PortSide;
  cursor: Point;
}
interface Press {
  pointerId: number;
  sourceId: string;
  side: PortSide;
  start: Point;
  previous: Draft | null;
  dragged: boolean;
}
/** Pointer capture conserva o arraste mesmo quando o cursor sai da alça ou do canvas. */
export function useConnectionGesture(
  ports: ConnectionPortPosition[],
  onConnect: (from: string, to: string) => void,
) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const current = useRef<Draft | null>(null);
  const press = useRef<Press | null>(null);
  const change = useCallback((value: Draft | null) => {
    current.current = value;
    setDraft(value);
  }, []);
  const cancel = useCallback(() => {
    press.current = null;
    change(null);
  }, [change]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [cancel]);
  const point = (event: PointerEvent<HTMLDivElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  };
  const complete = (from: string, to: string) => {
    cancel();
    if (from !== to) onConnect(from, to);
  };
  return {
    draft,
    cancel,
    onPortPointerDown(event: PointerEvent<HTMLButtonElement>, sourceId: string, side: PortSide) {
      if (event.button !== 0 || !event.isPrimary || press.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.setPointerCapture(event.pointerId);
      const source = ports.find((port) => port.id === sourceId);
      if (!source) return;
      press.current = {
        pointerId: event.pointerId,
        sourceId,
        side,
        start: { x: event.clientX, y: event.clientY },
        previous: current.current,
        dragged: false,
      };
      if (!current.current) change({ sourceId, side, cursor: portEndpoint(source, side) });
    },
    onPortKeyboardClick(id: string, side: PortSide) {
      const previous = current.current;
      const source = ports.find((port) => port.id === id);
      if (!source) return;
      if (previous) {
        if (previous.sourceId === id) cancel();
        else complete(previous.sourceId, id);
      } else change({ sourceId: id, side, cursor: portEndpoint(source, side) });
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const held = press.current;
      if (held && held.pointerId !== event.pointerId) return;
      if (!held && !current.current) return;
      const cursor = point(event);
      if (
        held &&
        (held.dragged || Math.hypot(event.clientX - held.start.x, event.clientY - held.start.y) > 4)
      ) {
        held.dragged = true;
        change({ sourceId: held.sourceId, side: held.side, cursor });
      } else if (current.current) change({ ...current.current, cursor });
    },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const held = press.current;
      if (held && held.pointerId !== event.pointerId) return;
      press.current = null;
      if (held?.dragged) {
        const target = connectionTarget(ports, point(event), held.sourceId);
        if (target) complete(held.sourceId, target.id);
        else cancel();
      } else if (held?.previous) {
        if (held.previous.sourceId === held.sourceId) cancel();
        else complete(held.previous.sourceId, held.sourceId);
      } else if (!held && current.current) {
        const target = connectionTarget(ports, point(event), current.current.sourceId);
        if (target) complete(current.current.sourceId, target.id);
      }
    },
    onPointerCancel: cancel,
    onLostPointerCapture() {
      if (press.current) cancel();
    },
  };
}
