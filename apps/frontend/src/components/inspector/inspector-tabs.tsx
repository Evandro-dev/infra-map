'use client';
import { Layers3, SlidersHorizontal, HardDrive, LifeBuoy, Activity } from 'lucide-react';
export type InspectorTab = 'properties' | 'layers' | 'inventory' | 'support' | 'monitor';
const tabs: [InspectorTab, string, typeof SlidersHorizontal][] = [
  ['properties', 'Propriedades', SlidersHorizontal],
  ['layers', 'Camadas', Layers3],
  ['inventory', 'Inventário', HardDrive],
  ['support', 'Suporte', LifeBuoy],
  ['monitor', 'Monitorar', Activity],
];
export function InspectorTabs({
  activeTab,
  onChange,
  deviceSelected,
}: {
  activeTab: InspectorTab;
  onChange: (tab: InspectorTab) => void;
  deviceSelected: boolean;
}) {
  return (
    <nav className="inspector-tabs" aria-label="Ferramentas do editor">
      {tabs.map(([id, name, Icon]) => (
        <button
          key={id}
          className={`inspector-tab ${activeTab === id ? 'active' : ''}`}
          type="button"
          disabled={(id === 'inventory' || id === 'support' || id === 'monitor') && !deviceSelected}
          onClick={() => onChange(id)}
          aria-label={name}
          aria-pressed={activeTab === id}
          title={name}
        >
          <Icon size={19} strokeWidth={1.75} />
          <span>{name}</span>
        </button>
      ))}
    </nav>
  );
}
