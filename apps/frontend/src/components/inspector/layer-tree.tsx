'use client';
import {
  Layers3,
  Monitor,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
} from 'lucide-react';
import type { MapElement } from '@/lib/types';

interface LayerTreeProps {
  elements: MapElement[];
  parentId: string | null;
  depth: number;
  onSelect: (id: string | null) => void;
  onUpdate: (id: string, change: Partial<MapElement>) => void;
  onReorder: (id: string, direction: -1 | 1) => void;
  selectedId: string | null;
}

/** Árvore recursiva de camadas reutilizável sem dependência direta do Zustand. */
export function LayerTree({
  elements,
  parentId,
  depth,
  onSelect,
  onUpdate,
  onReorder,
  selectedId,
}: LayerTreeProps) {
  if (depth > 40) return null;
  const children = elements
    .filter((e) => e.parentId === parentId)
    .sort((a, b) => (a.orderIndex ?? 0) - (b.orderIndex ?? 0));
  return (
    <>
      {children.map((item) => (
        <div key={item.id}>
          <div
            className={`layer-row ${selectedId === item.id ? 'active' : ''}`}
            style={{ paddingLeft: Math.min(12 + depth * 13, 120) }}
          >
            <button className="layer-select" onClick={() => onSelect(item.id)} title={item.name}>
              {item.kind === 'AREA' ? <Layers3 size={15} /> : <Monitor size={15} />}
              <span>{item.name}</span>
            </button>
            <button
              className="layer-icon"
              aria-label={`Subir ${item.name}`}
              title="Subir camada"
              onClick={() => onReorder(item.id, 1)}
            >
              <ArrowUp size={13} />
            </button>
            <button
              className="layer-icon"
              aria-label={`Descer ${item.name}`}
              title="Descer camada"
              onClick={() => onReorder(item.id, -1)}
            >
              <ArrowDown size={13} />
            </button>
            <button
              className="layer-icon"
              title={item.hidden ? 'Mostrar' : 'Ocultar'}
              aria-label={`${item.hidden ? 'Mostrar' : 'Ocultar'} ${item.name}`}
              onClick={() => onUpdate(item.id, { hidden: !item.hidden })}
            >
              {item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
            <button
              className="layer-icon"
              title={item.locked ? 'Desbloquear' : 'Bloquear'}
              aria-label={`${item.locked ? 'Desbloquear' : 'Bloquear'} ${item.name}`}
              onClick={() => onUpdate(item.id, { locked: !item.locked })}
            >
              {item.locked ? <LockKeyhole size={13} /> : <LockKeyholeOpen size={13} />}
            </button>
          </div>
          {item.kind === 'AREA' && (
            <LayerTree
              elements={elements}
              parentId={item.id}
              depth={depth + 1}
              onSelect={onSelect}
              onUpdate={onUpdate}
              onReorder={onReorder}
              selectedId={selectedId}
            />
          )}
        </div>
      ))}
    </>
  );
}
