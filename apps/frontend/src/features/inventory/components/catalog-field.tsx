'use client';
import { useCallback, useEffect, useState } from 'react';
import type {
  CatalogSearchItem,
  CatalogSearchPage,
  InventoryCatalogField,
  DeviceKind,
} from '@infra/contracts';
import { api } from '@/lib/api';
import { SearchableField } from '@/components/ui/searchable-field';
import type { SearchableRequest } from '@/components/ui/searchable-field.types';
import { catalogChangedEvent } from '../catalog-events';
import { catalogSourceLabels } from '../catalog-options';

interface Option extends CatalogSearchItem {
  label: string;
  detail: string;
}
export function CatalogField({
  field,
  kind,
  server = '',
  label,
  value,
  onChange,
  onSelect,
  disabled,
  maxLength,
  help,
}: {
  field: InventoryCatalogField;
  kind: DeviceKind;
  server?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onSelect?: (option: CatalogSearchItem) => void;
  disabled?: boolean;
  maxLength?: number;
  help?: string;
}) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const reload = () => setRevision((value) => value + 1);
    window.addEventListener(catalogChangedEvent, reload);
    return () => window.removeEventListener(catalogChangedEvent, reload);
  }, []);
  const load = useCallback(
    async ({ search, page, pageSize, signal }: SearchableRequest) => {
      const query = new URLSearchParams({
        field,
        kind,
        server,
        search,
        page: String(page),
        pageSize: String(pageSize),
      });
      const response = await api<CatalogSearchPage>(`/inventory/options?${query}`, { signal });
      return {
        ...response,
        items: response.items.map((item): Option => ({
          ...item,
          label: item.queue ? `${item.value} · ${item.server}` : item.value,
          detail: [
            catalogSourceLabels[item.source],
            item.server,
            item.queue?.shareName,
            item.queue?.driverName,
          ]
            .filter(Boolean)
            .join(' · '),
        })),
      };
    },
    [field, kind, server],
  );
  return (
    <SearchableField
      label={label}
      value={value}
      onChange={onChange}
      loadOptions={load}
      queryKey={`${field}:${kind}:${server}:${revision}`}
      onSelect={onSelect}
      disabled={disabled}
      maxLength={maxLength}
      help={help}
    />
  );
}
