import type { MapElement } from './types';

export type Position = { x: number; y: number };
export type Bounds = Position & { w: number; h: number };

export function absoluteOrigin(elements: MapElement[], parentId: string | null): Position {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const visited = new Set<string>();
  let x = 0,
    y = 0,
    id = parentId;
  while (id && !visited.has(id)) {
    visited.add(id);
    const node = byId.get(id);
    if (!node) break;
    x += node.xMeters;
    y += node.yMeters;
    id = node.parentId;
  }
  return { x, y };
}
export function absoluteBounds(elements: MapElement[], item: MapElement): Bounds {
  const parent = absoluteOrigin(elements, item.parentId);
  return {
    x: parent.x + item.xMeters,
    y: parent.y + item.yMeters,
    w: item.widthMeters,
    h: item.heightMeters,
  };
}
export function isDescendant(
  elements: MapElement[],
  possibleChildId: string,
  ancestorId: string,
): boolean {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const seen = new Set<string>();
  let current = byId.get(possibleChildId);
  while (current?.parentId && !seen.has(current.id)) {
    if (current.parentId === ancestorId) return true;
    seen.add(current.id);
    current = byId.get(current.parentId);
  }
  return false;
}
export function intersectionRatio(a: Bounds, b: Bounds): number {
  const w = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return (w * h) / Math.max(0.0001, Math.min(a.w * a.h, b.w * b.h));
}
// A vertical room is stored as a sibling with the same footprint but a different level.
// This uses the existing DB schema (no new migrations) and retains independent child devices.
export function footprintKey(item: MapElement): string {
  const coord = (n: number) => n.toFixed(2);
  return [
    item.parentId ?? 'root',
    coord(item.xMeters),
    coord(item.yMeters),
    coord(item.widthMeters),
    coord(item.heightMeters),
  ].join('|');
}
export function floorsFor(elements: MapElement[], item: MapElement): MapElement[] {
  if (item.kind !== 'AREA') return [];
  const key = footprintKey(item);
  const group = elements
    .filter((e) => e.kind === 'AREA' && footprintKey(e) === key)
    .sort((a, b) => a.level - b.level);
  return new Set(group.map((e) => e.level)).size > 1 ? group : [];
}
export function findOverlap(
  elements: MapElement[],
  moving: MapElement,
  newLocalX: number,
  newLocalY: number,
): MapElement | null {
  if (moving.kind !== 'AREA') return null;
  const origin = absoluteOrigin(elements, moving.parentId);
  const movingBox = {
    x: origin.x + newLocalX,
    y: origin.y + newLocalY,
    w: moving.widthMeters,
    h: moving.heightMeters,
  };
  let best: MapElement | null = null,
    bestScore = 0.28;
  for (const target of elements) {
    if (
      target.kind !== 'AREA' ||
      target.id === moving.id ||
      isDescendant(elements, target.id, moving.id) ||
      isDescendant(elements, moving.id, target.id)
    )
      continue;
    const score = intersectionRatio(movingBox, absoluteBounds(elements, target));
    if (score > bestScore) {
      best = target;
      bestScore = score;
    }
  }
  return best;
}

/** Deepest visible containing room at a world coordinate. The candidate's own
 * descendants cannot be considered new parents, preventing cyclic hierarchies. */
export function containingArea(
  elements: MapElement[],
  point: Position,
  excludeId?: string,
  visibleFloor?: Record<string, string>,
): MapElement | null {
  let best: MapElement | null = null,
    bestDepth = -1;
  for (const area of elements) {
    if (
      area.kind !== 'AREA' ||
      area.hidden ||
      area.id === excludeId ||
      (excludeId && isDescendant(elements, area.id, excludeId))
    )
      continue;
    const group = floorsFor(elements, area);
    if (
      group.length &&
      (visibleFloor?.[footprintKey(area)] ?? group[group.length - 1].id) !== area.id
    )
      continue;
    const bounds = absoluteBounds(elements, area);
    if (
      point.x < bounds.x ||
      point.y < bounds.y ||
      point.x > bounds.x + bounds.w ||
      point.y > bounds.y + bounds.h
    )
      continue;
    let depth = 0,
      ancestor = area.parentId;
    const seen = new Set<string>();
    while (ancestor && !seen.has(ancestor)) {
      seen.add(ancestor);
      depth++;
      ancestor = elements.find((el) => el.id === ancestor)?.parentId ?? null;
    }
    if (depth >= bestDepth) {
      best = area;
      bestDepth = depth;
    }
  }
  return best;
}
export function localPositionFor(
  elements: MapElement[],
  world: Position,
  parentId: string | null,
): Position {
  const parent = absoluteOrigin(elements, parentId);
  return { x: Number((world.x - parent.x).toFixed(3)), y: Number((world.y - parent.y).toFixed(3)) };
}

/** Snap to container and sibling guides in physical meters, not screen pixels.
 * The pointer threshold is converted from pixels by the canvas, so it behaves
 * consistently at every zoom level. It never changes element dimensions.
 */
export function snapToGuides(
  moved: Bounds,
  guides: Bounds[],
  toleranceMeters: number,
): { x: number; y: number; vertical: number | null; horizontal: number | null } {
  const xEdges = [moved.x, moved.x + moved.w / 2, moved.x + moved.w];
  const yEdges = [moved.y, moved.y + moved.h / 2, moved.y + moved.h];
  let bestX = { offset: 0, distance: toleranceMeters + 1, guide: null as number | null };
  let bestY = { offset: 0, distance: toleranceMeters + 1, guide: null as number | null };
  for (const guide of guides) {
    for (const target of [guide.x, guide.x + guide.w / 2, guide.x + guide.w]) {
      for (const source of xEdges) {
        const diff = target - source,
          dist = Math.abs(diff);
        if (dist < bestX.distance && dist <= toleranceMeters)
          bestX = { offset: diff, distance: dist, guide: target };
      }
    }
    for (const target of [guide.y, guide.y + guide.h / 2, guide.y + guide.h]) {
      for (const source of yEdges) {
        const diff = target - source,
          dist = Math.abs(diff);
        if (dist < bestY.distance && dist <= toleranceMeters)
          bestY = { offset: diff, distance: dist, guide: target };
      }
    }
  }
  return {
    x: moved.x + bestX.offset,
    y: moved.y + bestY.offset,
    vertical: bestX.guide,
    horizontal: bestY.guide,
  };
}
