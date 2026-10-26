'use client';
import { Map as MapIcon, Package, PanelRight, Info } from 'lucide-react';
import { IconTip } from '@/components/ui-tooltip';
export function AppRail({
  inspectorOpen,
  onToggleInspector,
  onShowTerritories,
  onShowDevices,
}: {
  inspectorOpen: boolean;
  onToggleInspector: () => void;
  onShowTerritories: () => void;
  onShowDevices: () => void;
}) {
  return (
    <>
      {' '}
      <nav className="app-rail" aria-label="Atalhos do editor">
        <IconTip label="Territórios" side="right">
          <button
            className="rail-button is-active"
            aria-label="Ir para territórios"
            onClick={() => onShowTerritories()}
          >
            <MapIcon size={18} />
          </button>
        </IconTip>
        <IconTip label="Equipamentos" side="right">
          <button
            className="rail-button"
            aria-label="Ir para equipamentos"
            onClick={() => onShowDevices()}
          >
            <Package size={18} />
          </button>
        </IconTip>
        <div className="rail-spacer" />
        <IconTip
          label={inspectorOpen ? 'Ocultar painel direito' : 'Mostrar painel direito'}
          side="right"
        >
          <button
            className={`rail-button ${inspectorOpen ? '' : 'is-active'}`}
            aria-label={inspectorOpen ? 'Ocultar painel direito' : 'Mostrar painel direito'}
            aria-pressed={inspectorOpen}
            onClick={() => onToggleInspector()}
          >
            <PanelRight size={18} />
          </button>
        </IconTip>
        <IconTip label="Sobre o editor" side="right">
          <button
            className="rail-button"
            aria-label="Sobre o editor"
            onClick={() =>
              window.alert(
                'Infra Map — editor territorial. Arraste setores e equipamentos, use a roda do mouse para zoom e salve pelo ícone no topo.',
              )
            }
          >
            <Info size={18} />
          </button>
        </IconTip>
      </nav>
    </>
  );
}
