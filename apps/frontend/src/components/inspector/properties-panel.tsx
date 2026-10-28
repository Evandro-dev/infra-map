'use client';
import { Eye, EyeOff, LockKeyhole, LockKeyholeOpen, Trash2 } from 'lucide-react';
import { NumericField } from '@/components/ui/numeric-field';
import { DEVICE_LABELS, type MapElement, type MapRecord } from '@/lib/types';

interface PropertiesPanelProps {
  map: MapRecord | null;
  selected: MapElement | null;
  elements: MapElement[];
  onUpdateElement: (id: string, change: Partial<MapElement>) => void;
  onUpdateMap: (change: Partial<MapRecord>) => void;
  onRemoveElement: (id: string) => void;
  onDeleteTerritory: () => void;
  deleting: boolean;
  saving: boolean;
}

/** Conteúdo da aba Propriedades: independente da navegação do inspetor. */
export function PropertiesPanel({
  map,
  selected,
  elements,
  onUpdateElement,
  onUpdateMap,
  onRemoveElement,
  onDeleteTerritory,
  deleting,
  saving,
}: PropertiesPanelProps) {
  if (selected)
    return (
      <>
        <div className="inspector-heading">
          <strong>{selected.name}</strong>
          <span className="muted">
            {selected.kind === 'AREA'
              ? 'Retângulo'
              : DEVICE_LABELS[selected.device?.kind ?? 'OTHER']}
          </span>
        </div>
        <div className="grid2">
          <NumericField
            label="Posição X (m)"
            value={selected.xMeters}
            onChange={(v) => onUpdateElement(selected.id, { xMeters: v })}
          />
          <NumericField
            label="Posição Y (m)"
            value={selected.yMeters}
            onChange={(v) => onUpdateElement(selected.id, { yMeters: v })}
          />
          <NumericField
            label="Largura (m)"
            value={selected.widthMeters}
            min={0.5}
            onChange={(v) => onUpdateElement(selected.id, { widthMeters: v })}
          />
          <NumericField
            label="Altura (m)"
            value={selected.heightMeters}
            min={0.5}
            onChange={(v) => onUpdateElement(selected.id, { heightMeters: v })}
          />
        </div>
        <div className="property-actions">
          <button
            className="btn property-action"
            title={selected.hidden ? 'Mostrar elemento' : 'Ocultar elemento'}
            onClick={() => onUpdateElement(selected.id, { hidden: !selected.hidden })}
          >
            {selected.hidden ? <EyeOff size={16} /> : <Eye size={16} />}{' '}
            {selected.hidden ? 'Oculto' : 'Visível'}
          </button>
          <button
            className="btn property-action"
            title={selected.locked ? 'Desbloquear' : 'Bloquear'}
            onClick={() => onUpdateElement(selected.id, { locked: !selected.locked })}
          >
            {selected.locked ? <LockKeyhole size={16} /> : <LockKeyholeOpen size={16} />}{' '}
            {selected.locked ? 'Bloqueado' : 'Livre'}
          </button>
        </div>
        {selected.kind === 'AREA' && (
          <div className="info-card">
            <span className="muted">Elementos diretos</span>
            <strong>{elements.filter((e) => e.parentId === selected.id).length}</strong>
          </div>
        )}
        <button className="btn danger remove-action" onClick={() => onRemoveElement(selected.id)}>
          <Trash2 size={17} /> Excluir elemento
        </button>
      </>
    );
  if (map)
    return (
      <>
        <div className="inspector-heading">
          <strong>{map.name}</strong>
          <span className="muted">
            {map.hasTerritory === false ? 'Workflow sem território' : 'Área territorial'}
          </span>
        </div>
        {map.hasTerritory === false ? (
          <p className="hint">
            Este workflow está vazio. Use o botão + no centro do mapa para criar um território.
          </p>
        ) : (
          <>
            <div className="grid2">
              <NumericField
                label="Largura (m)"
                value={map.widthMeters}
                min={1}
                onChange={(v) => onUpdateMap({ widthMeters: v })}
              />
              <NumericField
                label="Comprimento (m)"
                value={map.heightMeters}
                min={1}
                onChange={(v) => onUpdateMap({ heightMeters: v })}
              />
              <NumericField
                label="Origem X (m)"
                value={map.originXMeters ?? 0}
                onChange={(v) => onUpdateMap({ originXMeters: v })}
              />
              <NumericField
                label="Origem Y (m)"
                value={map.originYMeters ?? 0}
                onChange={(v) => onUpdateMap({ originYMeters: v })}
              />
            </div>
            <div className="info-card territory-area">
              <span>Área total</span>
              <strong>{(map.widthMeters * map.heightMeters).toLocaleString('pt-BR')} m²</strong>
            </div>
            <button
              className="btn danger remove-action"
              disabled={deleting || saving}
              onClick={onDeleteTerritory}
            >
              <Trash2 size={17} />
              {deleting ? 'Limpando território...' : 'Limpar território e conteúdo'}
            </button>
          </>
        )}
      </>
    );
  return <p className="hint">Crie um território para começar.</p>;
}
