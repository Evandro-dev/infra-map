'use client';
import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import type { MapElement, MapRecord } from '@/lib/types';

export function InspectorBreadcrumb({
  map,
  selected,
  elements,
}: {
  map: MapRecord | null;
  selected: MapElement | null;
  elements: MapElement[];
}) {
  const breadcrumb = useMemo(() => {
    if (!selected) return [map?.name ?? 'Território'];
    const trail: string[] = [];
    const seen = new Set<string>();
    let current: MapElement | undefined = selected;
    while (current && !seen.has(current.id)) {
      seen.add(current.id);
      trail.unshift(current.name);
      current = elements.find((item) => item.id === current?.parentId);
    }
    return [map?.name ?? 'Território', ...trail];
  }, [selected, map?.name, elements]);
  return (
    <div className="element-breadcrumb">
      {breadcrumb.map((item, index) => (
        <span key={index}>
          {index > 0 && <ChevronRight size={12} />}
          <span title={item}>{item}</span>
        </span>
      ))}
    </div>
  );
}
