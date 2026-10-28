'use client';
import { useState } from 'react';
import { Map as MapIcon, Undo2, Redo2, Save, Check, Pencil } from 'lucide-react';
import { IconTip } from '@/components/ui-tooltip';
interface Props {
  name: string | null;
  isDraft: boolean;
  hasChanges: boolean;
  saving: boolean;
  canSave: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onRename: (name: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}
export function AppHeader({
  name,
  isDraft,
  hasChanges,
  saving,
  canSave,
  canUndo,
  canRedo,
  onRename,
  onUndo,
  onRedo,
  onSave,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(name ?? '');
  const undo = onUndo,
    redo = onRedo;

  function finishNameEdit(commit: boolean) {
    const next = nameValue.trim();
    setEditingName(false);
    if (commit && next && next !== name) onRename(next);
    else setNameValue(name ?? '');
  }

  return (
    <>
      {' '}
      <header className="app-header">
        <div className="header-identity">
          {editingName ? (
            <input
              className="workflow-title-input"
              aria-label="Nome do workflow"
              autoFocus
              disabled={saving}
              maxLength={140}
              value={nameValue}
              onChange={(event) => setNameValue(event.target.value)}
              onBlur={() => finishNameEdit(true)}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') {
                  event.preventDefault();
                  finishNameEdit(true);
                } else if (event.key === 'Escape') {
                  event.preventDefault();
                  finishNameEdit(false);
                }
              }}
            />
          ) : (
            <button
              className="header-current workflow-title-button"
              type="button"
              disabled={saving}
              aria-label={`Renomear workflow ${name ?? ''}`}
              title="Renomear workflow"
              onClick={() => {
                setNameValue(name ?? '');
                setEditingName(true);
              }}
            >
              <span>{name ?? 'Novo workflow'}</span>
              <Pencil size={12} aria-hidden="true" />
            </button>
          )}
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
          ) : isDraft ? (
            <span className="save-status draft-status">Rascunho não salvo</span>
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
