'use client';
import { useState } from 'react';
import { api } from '@/lib/api';
import { DEVICE_LABELS, type Device } from '@/lib/types';

export function InventoryPicker({
  disabled,
  onPlace,
}: {
  disabled: boolean;
  onPlace: (device: Device) => void;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selected, setSelected] = useState('');
  const [working, setWorking] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  async function refresh() {
    setWorking(true);
    setError('');
    try {
      setDevices(await api<Device[]>('/devices'));
      setLoaded(true);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha ao consultar inventário.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="field-stack">
      <button className="btn" disabled={disabled || working} onClick={() => void refresh()}>
        {working ? 'Consultando...' : 'Consultar inventário cadastrado'}
      </button>
      {loaded && !devices.length && <p className="support-help">Nenhum equipamento cadastrado.</p>}
      {devices.length > 0 && (
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
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} · {DEVICE_LABELS[device.kind]}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn"
            disabled={disabled || !devices.some((device) => device.id === selected)}
            onClick={() => {
              const device = devices.find((item) => item.id === selected);
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
