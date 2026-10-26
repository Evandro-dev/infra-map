'use client';
import { Layers3, Map as MapIcon, Undo2, Redo2, Save, Check } from 'lucide-react';
import { IconTip } from '@/components/ui-tooltip';
interface Props {
  name: string | null;
  hasChanges: boolean;
  saving: boolean;
  canSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}
export function AppHeader({
  name,
  hasChanges,
  saving,
  canSave,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
}: Props) {
  const map = name ? { name } : null;
  const undo = onUndo,
    redo = onRedo;
  return (
    <>
      {' '}
      <header className="app-header">
        <div className="header-identity">
          <span className="header-brand-icon">
            <Layers3 size={17} strokeWidth={2.2} />
          </span>
          <span className="header-app-name">Infra Map</span>
          <span className="header-divider">/</span>
          <span className="header-current" title={map?.name ?? 'Nenhum território'}>
            {map?.name ?? 'Meus territórios'}
          </span>
        </div>
        <div className="header-center">
          <span className="view-current">
            <MapIcon size={14} /> Editor
          </span>
        </div>
        <div className="header-actions">
          {hasChanges ? (
            <span className="save-status unsaved">
              <span className="status-dot" /> Alterações não salvas
            </span>
          ) : (
            <span className="save-status">
              <Check size={13} /> Salvo
            </span>
          )}
          <IconTip label="Desfazer" shortcut="Ctrl Z">
            <button
              className="n8n-icon-button"
              aria-label="Desfazer"
              disabled={!canUndo}
              onClick={undo}
            >
              <Undo2 size={17} />
            </button>
          </IconTip>
          <IconTip label="Refazer" shortcut="Ctrl Y">
            <button
              className="n8n-icon-button"
              aria-label="Refazer"
              disabled={!canRedo}
              onClick={redo}
            >
              <Redo2 size={17} />
            </button>
          </IconTip>
          <IconTip label={saving ? 'Salvando...' : 'Salvar alterações'} shortcut="Ctrl S">
            <button
              className={`n8n-icon-button header-save ${hasChanges ? 'has-changes' : ''}`}
              aria-label="Salvar mapa"
              disabled={!canSave || saving}
              onClick={onSave}
            >
              <Save size={17} />
            </button>
          </IconTip>
        </div>
      </header>
    </>
  );
}
