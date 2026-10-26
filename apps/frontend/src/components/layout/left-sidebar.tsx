'use client';
import type { RefObject } from 'react';
import { DoorOpen, Plus, ChevronDown } from 'lucide-react';
import { type Device, type DeviceKind, type MapRecord } from '@/lib/types';
import { DevicePalette } from './device-palette';
import { InventoryPicker } from '@/features/inventory/components/inventory-picker';
interface Props {
  map: MapRecord | null;
  maps: MapRecord[];
  saving: boolean;
  deleting: boolean;
  territoriesRef: RefObject<HTMLDivElement | null>;
  devicesRef: RefObject<HTMLDivElement | null>;
  onSelect: (id: string) => void;
  onCreate: () => void;
  onArea: () => void;
  onDevice: (kind: DeviceKind) => void;
  onPlaceDevice: (device: Device) => void;
}
export function LeftSidebar({
  map,
  maps,
  saving,
  deleting,
  territoriesRef,
  devicesRef,
  onSelect,
  onCreate,
  onArea,
  onDevice,
  onPlaceDevice,
}: Props) {
  const selectMap = onSelect,
    createMap = onCreate,
    addArea = onArea,
    addDevice = onDevice;
  return (
    <>
      {' '}
      <aside className="sidebar">
        <div className="sidebar-intro">
          <strong>Ferramentas</strong>
          <span>Mapa e equipamentos</span>
        </div>
        <div ref={territoriesRef} className="side-group territory-group">
          <div className="caption">Territórios</div>
          <div
            className="territory-picker"
            role="group"
            aria-label="Selecionar ou criar território"
          >
            <div className="territory-picker-select-wrap">
              <select
                className="territory-picker-select"
                aria-label="Selecionar território"
                value={map?.id ?? ''}
                disabled={!maps.length}
                onChange={(e) => void selectMap(e.target.value)}
              >
                <option value="" disabled>
                  {maps.length ? 'Selecionar território' : 'Nenhum território'}
                </option>
                {maps.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} aria-hidden="true" className="territory-picker-chevron" />
            </div>
            <button
              className="territory-picker-add"
              type="button"
              title="Criar território"
              aria-label="Criar território"
              disabled={saving || deleting}
              onClick={() => void createMap()}
            >
              <Plus size={19} strokeWidth={1.9} />
            </button>
          </div>
        </div>
        <div className="side-group">
          <div className="caption">Estrutura</div>
          <button
            className="palette-item"
            disabled={!map}
            draggable={Boolean(map)}
            onDragStart={(e) => e.dataTransfer.setData('application/x-infra-element', 'AREA')}
            onClick={() => addArea()}
          >
            <DoorOpen size={19} /> Retângulo / setor <Plus size={14} className="palette-add" />
          </button>
        </div>
        <div ref={devicesRef} className="side-group">
          <div className="caption">Equipamentos</div>
          <DevicePalette disabled={!map} onDevice={(kind) => void addDevice(kind)} />
          <InventoryPicker disabled={!map || saving || deleting} onPlace={onPlaceDevice} />
        </div>
      </aside>
    </>
  );
}
