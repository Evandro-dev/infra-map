'use client';

import type { RefObject } from 'react';
import { FolderPlus, MapPinned, Search, X } from 'lucide-react';
import type { Device, DeviceKind } from '@/lib/types';
import { DevicePalette } from '@/components/layout/device-palette';
import { InventoryPicker } from '@/features/inventory/components/inventory-picker';

interface Props {
  disabled: boolean;
  hasTerritory: boolean;
  search: string;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchChange: (value: string) => void;
  onAddArea: () => void;
  onCreateTerritory: () => void;
  onAddDevice: (kind: DeviceKind) => void;
  onPlaceDevice: (device: Device) => void;
  onClose: () => void;
}

export function CanvasNodePanel({
  disabled,
  hasTerritory,
  search,
  searchInputRef,
  onSearchChange,
  onAddArea,
  onCreateTerritory,
  onAddDevice,
  onPlaceDevice,
  onClose,
}: Props) {
  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR');
  const showArea =
    !normalizedSearch ||
    ['setor', 'área', 'area', 'novo'].some((value) => value.startsWith(normalizedSearch));

  return (
    <section className="canvas-node-panel" aria-label="Adicionar ao mapa">
      <header className="canvas-node-panel-header">
        <div>
          <strong>{hasTerritory ? 'Adicionar ao mapa' : 'Comece pelo território'}</strong>
          <span>
            {hasTerritory
              ? 'Escolha um setor ou dispositivo'
              : 'Crie a área que vai organizar este workflow'}
          </span>
        </div>
        <button
          className="canvas-node-panel-close"
          type="button"
          aria-label="Fechar painel"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </header>
      {hasTerritory && (
        <label className="canvas-node-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchInputRef}
            type="search"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Pesquisar dispositivos..."
            aria-label="Pesquisar dispositivos"
          />
        </label>
      )}

      <div className="canvas-node-panel-content">
        {!hasTerritory ? (
          <button
            className="canvas-node-area-button canvas-node-create-territory"
            type="button"
            disabled={disabled}
            onClick={() => {
              onCreateTerritory();
              onClose();
            }}
          >
            <MapPinned className="canvas-node-area-icon" size={18} strokeWidth={1.8} />
            <span>
              <strong>Criar território</strong>
              <small>Comece a montar o mapa deste workflow</small>
            </span>
          </button>
        ) : (
          <>
            {showArea && (
              <button
                className="canvas-node-area-button"
                type="button"
                disabled={disabled}
                onClick={onAddArea}
              >
                <FolderPlus className="canvas-node-area-icon" size={18} strokeWidth={1.8} />
                <span>
                  <strong>Novo setor</strong>
                  <small>Organize os dispositivos no mapa</small>
                </span>
              </button>
            )}

            <div className="canvas-node-group">
              <span className="canvas-node-group-title">Dispositivos novos</span>
              <DevicePalette
                disabled={disabled}
                searchTerm={search}
                onDevice={(kind) => {
                  onAddDevice(kind);
                  onClose();
                }}
              />
            </div>

            <details className="canvas-node-inventory">
              <summary>Equipamentos cadastrados</summary>
              <InventoryPicker
                disabled={disabled}
                onPlace={(device) => {
                  onPlaceDevice(device);
                  onClose();
                }}
              />
            </details>
          </>
        )}
      </div>
    </section>
  );
}
