'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { DEVICE_LABELS, type Device } from '@/lib/types';

export function InventoryPicker({
  disabled,
  onPlace,
  placedDeviceIds,
}: {
  disabled: boolean;
  onPlace: (device: Device) => void;
  placedDeviceIds: string[];
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [working, setWorking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const availableDevices = devices.filter((device) => !placedDeviceIds.includes(device.id));
  async function refresh() {
    setWorking(true);
    setError('');
    try {
      setDevices(await api<Device[]>('/devices'));
      setLoaded(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao carregar equipamentos.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="field-stack">
      <button className="btn" disabled={disabled || working} onClick={() => void refresh()}>
        {working ? 'Carregando...' : 'Carregar equipamentos salvos'}
      </button>
      {loaded && !availableDevices.length && (
        <p className="support-help">
          {devices.length
            ? 'Todos os equipamentos salvos já estão neste workflow.'
            : 'Nenhum equipamento cadastrado.'}
        </p>
      )}
      {availableDevices.length > 0 && (
        <>
          <label className="form-row">
            <span className="muted">Equipamento existente</span>
            <select
              className="field"
              value={selected}
              disabled={disabled}
              onChange={(event) => setSelected(event.target.value)}
            >
              <option value="">Selecione</option>
              {availableDevices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} · {DEVICE_LABELS[device.kind]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            disabled={disabled || !availableDevices.some((device) => device.id === selected)}
            onClick={() => {
              const device = availableDevices.find((item) => item.id === selected);
              if (device) onPlace(device);
            }}
          >
            Posicionar no mapa
          </button>
          <p className="support-help">
            Usa o cadastro existente, sem criar outro equipamento. Salve o mapa para manter a
            posição.
          </p>
        </>
      )}
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
