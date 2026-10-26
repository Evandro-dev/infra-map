'use client';
import { useState } from 'react';
import { LifeBuoy } from 'lucide-react';
import { InventoryForm } from '@/components/inventory-form';
import { SupportPanel } from '@/features/support/components/support-panel';
import { MonitorPanel } from '@/features/monitoring/components/monitor-panel';
import { InspectorTabs, type InspectorTab } from '@/components/inspector/inspector-tabs';
import { InspectorBreadcrumb } from '@/components/inspector/inspector-breadcrumb';
import { PropertiesPanel } from '@/components/inspector/properties-panel';
import { LayersPanel } from '@/components/inspector/layers-panel';
import { useEditorStore } from '@/lib/store';
import type { Device, MapElement, MapRecord } from '@/lib/types';

interface Props {
  map: MapRecord | null;
  selected: MapElement | null;
  supportAccessKey: string;
  onSupportKeyChange: (value: string) => void;
  onUpdateMap: (change: Partial<MapRecord>) => void;
  onRemoveElement: (id: string) => void;
  onDeleteMap: () => void;
  onDeviceSaved: (value: Device) => void;
  onRelationshipsChanged?: () => void;
  onMonitoringChanged: () => void;
  deleting: boolean;
  saving: boolean;
}
/** Contêiner do inspetor: as abas e seus conteúdos ficam em componentes próprios. */
export function RightSidebar({
  map,
  selected,
  supportAccessKey,
  onSupportKeyChange,
  onUpdateMap,
  onRemoveElement,
  onDeleteMap,
  onDeviceSaved,
  onRelationshipsChanged,
  onMonitoringChanged,
  deleting,
  saving,
}: Props) {
  const [tab, setTab] = useState<InspectorTab>('properties');
  const activeTab =
    selected?.kind === 'DEVICE'
      ? tab
      : tab === 'inventory' || tab === 'support' || tab === 'monitor'
        ? 'properties'
        : tab;
  const { elements, update } = useEditorStore();
  return (
    <aside className="inspector">
      <header className="inspector-top">
        <strong>Editor</strong>
        <span>
          {selected?.kind === 'DEVICE' ? 'Equipamento' : selected ? 'Setor' : 'Território'}
        </span>
      </header>
      <InspectorTabs
        activeTab={activeTab}
        onChange={setTab}
        deviceSelected={selected?.kind === 'DEVICE'}
      />
      <div className="inspector-content">
        <InspectorBreadcrumb map={map} selected={selected} elements={elements} />
        {activeTab === 'properties' && (
          <PropertiesPanel
            map={map}
            selected={selected}
            elements={elements}
            onUpdateElement={update}
            onUpdateMap={onUpdateMap}
            onRemoveElement={onRemoveElement}
            onDeleteMap={onDeleteMap}
            deleting={deleting}
            saving={saving}
          />
        )}
        {activeTab === 'layers' && <LayersPanel map={map} />}
        {activeTab === 'monitor' && selected?.device && (
          <MonitorPanel
            key={`${selected.device.id}-${Boolean(supportAccessKey)}`}
            device={selected.device}
            accessKey={supportAccessKey}
            onKeyChange={onSupportKeyChange}
            onChanged={onMonitoringChanged}
          />
        )}
        {selected?.kind === 'DEVICE' && selected.device && (
          <div style={{ display: activeTab === 'inventory' ? 'block' : 'none' }}>
            <InventoryForm
              key={selected.device.id}
              device={selected.device}
              effectiveName={selected.name}
              onSaved={onDeviceSaved}
            />
          </div>
        )}
        {activeTab === 'support' &&
          (selected?.kind === 'DEVICE' && selected.device ? (
            <SupportPanel
              key={selected.device.id}
              onDeviceSaved={onDeviceSaved}
              device={selected.device}
              accessKey={supportAccessKey}
              onKeyChange={onSupportKeyChange}
              onRelationshipsChanged={onRelationshipsChanged}
            />
          ) : (
            <div className="inspector-empty">
              <LifeBuoy size={23} />
              <strong>Suporte</strong>
              <p>Selecione um dispositivo para abrir as ferramentas de suporte e o ISL.</p>
            </div>
          ))}
      </div>
    </aside>
  );
}
