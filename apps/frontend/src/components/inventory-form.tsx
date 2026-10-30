'use client';
import { useState } from 'react';
import { Check, RefreshCw, Save, ShieldAlert } from 'lucide-react';
import { api } from '@/lib/api';
import { DEVICE_LABELS, type Device, type DeviceKind } from '@/lib/types';
import { inventoryCatalogFields } from '@infra/contracts';
import { CatalogField } from '@/features/inventory/components/catalog-field';
import { notifyCatalogChanged } from '@/features/inventory/catalog-events';
import { PrinterConfigurationFields } from '@/features/inventory/components/printer-configuration-fields';

const commonFields: [keyof Device, string][] = [
  ['name', 'Nome do equipamento'],
  ['ipAddress', 'Endereço IP'],
  ['macAddress', 'Endereço MAC'],
  ['assetTag', 'Patrimônio'],
  ['manufacturer', 'Fabricante'],
  ['model', 'Modelo'],
  ['serialNumber', 'Número de série'],
];
const typedFields: Partial<Record<DeviceKind, [keyof Device, string][]>> = {
  COMPUTER: [
    ['hostname', 'Nome do computador'],
    ['assignedUser', 'Usuário principal'],
    ['operatingSystem', 'Sistema operacional'],
  ],
  SERVER: [
    ['hostname', 'Hostname / DNS'],
    ['operatingSystem', 'Sistema operacional'],
  ],
  PRINTER: [
    ['hostname', 'Hostname / DNS'],
    ['printServer', 'Servidor de impressão'],
    ['printShare', 'Nome da fila compartilhada'],
    ['approvedDriver', 'Driver homologado'],
    ['printQueue', 'Fila no servidor'],
    ['printPort', 'Nome da porta de impressão'],
    ['printProtocol', 'Protocolo da porta'],
    ['printPortNumber', 'Porta TCP (número)'],
  ],
  PDV: [
    ['hostname', 'Nome da estação'],
    ['assignedUser', 'Usuário principal'],
  ],
};
export function InventoryForm({
  device,
  effectiveName,
  onSaved,
}: {
  device: Device;
  effectiveName: string;
  onSaved: (value: Device) => void;
}) {
  const [draft, setDraft] = useState<Partial<Device>>({});
  const form = { ...device, ...draft };
  const currentName = draft.name ?? effectiveName;
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(''),
    [saved, setSaved] = useState(false);
  const fields = [...commonFields, ...(typedFields[device.kind] ?? [])];
  const changed =
    fields.some(
      ([key]) => (key === 'name' ? currentName : (form[key] ?? '')) !== (device[key] ?? ''),
    ) || form.notes !== device.notes;
  async function save() {
    if (!currentName.trim()) {
      setError('Informe o nome do equipamento.');
      return;
    }
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const payload = {
        name: currentName.trim(),
        ...Object.fromEntries(
          fields
            .filter(([key]) => key !== 'name')
            .map(([key]) => [
              key,
              key === 'printPortNumber'
                ? form.printPortNumber
                : String(form[key] ?? '').trim() || null,
            ]),
        ),
        notes: form.notes?.trim() || null,
      };
      const result = await api<Device>('/devices/' + encodeURIComponent(device.id), {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      onSaved(result);
      notifyCatalogChanged();
      setDraft({});
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="inventory-form">
      <div className="section-heading">
        <strong>{DEVICE_LABELS[device.kind]}</strong>
        <span>Cadastro técnico</span>
      </div>
      <div className="field-stack">
        {device.kind === 'SERVER' && (
          <p className="support-help">
            Servidor é um tipo genérico e pode representar qualquer função. O mapa identifica
            relação de impressão quando este hostname coincide com o servidor cadastrado na fila.
          </p>
        )}
        {fields
          .filter(
            ([key]) =>
              device.kind !== 'PRINTER' ||
              ![
                'printServer',
                'printQueue',
                'printShare',
                'approvedDriver',
                'printPort',
                'printProtocol',
                'printPortNumber',
              ].includes(key),
          )
          .map(([key, label]) =>
            inventoryCatalogFields.some((field) => field === key) ? (
              <CatalogField
                key={key}
                field={key as (typeof inventoryCatalogFields)[number]}
                kind={device.kind}
                server={form.printServer ?? ''}
                label={label}
                value={String(form[key] ?? '')}
                onChange={(value) => {
                  setSaved(false);
                  setDraft((current) => ({ ...current, [key]: value }));
                }}
                disabled={saving}
                maxLength={key === 'model' || key === 'manufacturer' ? 120 : 160}
              />
            ) : (
              <label className="form-row" key={key}>
                <span className="muted">{label}</span>
                <input
                  className="field"
                  disabled={saving}
                  value={key === 'name' ? currentName : String(form[key] ?? '')}
                  onChange={(event) => {
                    setSaved(false);
                    setDraft((current) => ({ ...current, [key]: event.target.value }));
                  }}
                  maxLength={key === 'name' ? 120 : 160}
                  placeholder={`Informar ${label.toLowerCase()}`}
                />
              </label>
            ),
          )}
        {device.kind === 'PRINTER' && (
          <PrinterConfigurationFields
            value={form}
            onChange={(change) => {
              setSaved(false);
              setDraft((current) => ({ ...current, ...change }));
            }}
            disabled={saving}
          />
        )}
        <label className="form-row">
          <span className="muted">Observações</span>
          <textarea
            rows={4}
            disabled={saving}
            className="field field-textarea"
            value={form.notes ?? ''}
            onChange={(e) => {
              setSaved(false);
              setDraft((f) => ({ ...f, notes: e.target.value }));
            }}
            maxLength={4000}
            placeholder="Localização, detalhes de manutenção, observações..."
          />
        </label>
      </div>
      <div className="inventory-actions">
        <button
          className="btn btn-primary"
          disabled={!changed || saving}
          onClick={() => void save()}
        >
          <Save size={16} />
          {saving ? 'Salvando...' : 'Salvar cadastro'}
        </button>
        <button
          className="btn icon-btn"
          disabled={!changed || saving}
          onClick={() => {
            setDraft({});
            setError('');
            setSaved(false);
          }}
          title="Descartar alterações"
          aria-label="Descartar alterações"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {saved && (
        <p className="inline-success">
          <Check size={15} /> Dados salvos no inventário.
        </p>
      )}
      {error && (
        <p className="inline-error">
          <ShieldAlert size={15} />
          {error}
        </p>
      )}
    </div>
  );
}
