import type { MapElement } from '@/lib/types';

export type DragPreview = { id: string; x: number; y: number };
/** Coordenadas de apresentação; não altera o layout ou o histórico de desfazer. */
export function createPreviewBounds(elements: MapElement[], preview: DragPreview | null) {
  const byId = new Map(elements.map((item) => [item.id, item]));
  const origins = new Map<string, { x: number; y: number }>();
  const affected = new Map<string, boolean>();
  const moving = preview ? byId.get(preview.id) : undefined;
  const position = (element: MapElement) => {
    const chain: MapElement[] = [];
    const seen = new Set<string>();
    let current: MapElement | undefined = element;
    while (current && !origins.has(current.id) && !seen.has(current.id)) {
      seen.add(current.id);
      chain.push(current);
      current = current.parentId ? byId.get(current.parentId) : undefined;
    }
    let origin = current ? (origins.get(current.id) ?? { x: 0, y: 0 }) : { x: 0, y: 0 };
    let moves = current ? (affected.get(current.id) ?? false) : false;
    for (const node of chain.reverse()) {
      moves = moves || node.id === preview?.id;
      origin = { x: origin.x + node.xMeters, y: origin.y + node.yMeters };
      origins.set(node.id, origin);
      affected.set(node.id, moves);
    }
    const base = origins.get(element.id) ?? { x: element.xMeters, y: element.yMeters };
    const delta =
      preview && moving && affected.get(element.id)
        ? { x: preview.x - moving.xMeters, y: preview.y - moving.yMeters }
        : { x: 0, y: 0 };
    return {
      x: base.x + delta.x,
      y: base.y + delta.y,
      w: element.widthMeters,
      h: element.heightMeters,
    };
  };
  return position;
}
