'use client';

import { FolderPlus, PanelRightClose, PanelRightOpen, Plus, Search } from 'lucide-react';
import { IconTip } from '@/components/ui-tooltip';

interface Props {
  nodePanelOpen: boolean;
  inspectorOpen: boolean;
  actionsDisabled: boolean;
  hasTerritory: boolean;
  onToggleNodePanel: () => void;
  onSearchNodes: () => void;
  onAddArea: () => void;
  onToggleInspector: () => void;
}

export function CanvasActionBar({
  nodePanelOpen,
  inspectorOpen,
  actionsDisabled,
  hasTerritory,
  onToggleNodePanel,
  onSearchNodes,
  onAddArea,
  onToggleInspector,
}: Props) {
  const InspectorIcon = inspectorOpen ? PanelRightClose : PanelRightOpen;

  return (
    <div className="canvas-action-rail" role="toolbar" aria-label="Ações do mapa">
      <IconTip
        label={nodePanelOpen ? 'Fechar painel de dispositivos' : 'Abrir painel de dispositivos'}
        shortcut="N"
        side="left"
      >
        <button
          className={`canvas-action-button ${nodePanelOpen ? 'is-active' : ''}`}
          type="button"
          aria-label={
            nodePanelOpen ? 'Fechar painel de dispositivos' : 'Abrir painel de dispositivos'
          }
          aria-keyshortcuts="N"
          aria-expanded={nodePanelOpen}
          onClick={onToggleNodePanel}
        >
          <Plus size={18} strokeWidth={1.8} />
        </button>
      </IconTip>
      <IconTip label="Pesquisar dispositivos" side="left">
        <button
          className="canvas-action-button"
          type="button"
          aria-label="Pesquisar dispositivos"
          onClick={onSearchNodes}
        >
          <Search size={17} strokeWidth={1.8} />
        </button>
      </IconTip>
      <IconTip label="Adicionar setor" shortcut="Shift S" side="left">
        <button
          className="canvas-action-button"
          type="button"
          aria-label="Adicionar setor"
          aria-keyshortcuts="Shift+S"
          disabled={actionsDisabled || !hasTerritory}
          onClick={onAddArea}
        >
          <FolderPlus size={17} strokeWidth={1.8} />
        </button>
      </IconTip>
      <span className="canvas-action-divider" />
      <IconTip
        label={inspectorOpen ? 'Ocultar inspetor' : 'Mostrar inspetor'}
        shortcut="I"
        side="left"
      >
        <button
          className="canvas-action-button"
          type="button"
          aria-label={inspectorOpen ? 'Ocultar inspetor' : 'Mostrar inspetor'}
          aria-keyshortcuts="I"
          aria-pressed={inspectorOpen}
          onClick={onToggleInspector}
        >
          <InspectorIcon size={17} strokeWidth={1.8} />
        </button>
      </IconTip>
    </div>
  );
}
