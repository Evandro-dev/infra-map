'use client';
import { Building2 } from 'lucide-react';
import { LayerTree } from './layer-tree';
import { useEditorStore } from '@/lib/store';
import type { MapRecord } from '@/lib/types';

export function LayersPanel({ map }: { map: MapRecord | null }) {
  const { elements, selectedId, select, update, reorder } = useEditorStore();
  return (
    <div className="layers-content">
      <div className="section-heading">
        <strong>Camadas</strong>
        <span>{elements.length} elementos</span>
      </div>
      <button
        className={`layer-row layer-root ${!selectedId ? 'active' : ''}`}
        onClick={() => select(null)}
      >
        <Building2 size={17} />
        <span>{map?.name ?? 'Sem território'}</span>
      </button>
      <LayerTree
        elements={elements}
        parentId={null}
        depth={0}
        onSelect={select}
        onUpdate={update}
        onReorder={reorder}
        selectedId={selectedId}
      />
      <p className="sidebar-note">
        Arraste os elementos no mapa para mudar a posição e o setor. O vínculo aparece aqui.
      </p>
    </div>
  );
}
