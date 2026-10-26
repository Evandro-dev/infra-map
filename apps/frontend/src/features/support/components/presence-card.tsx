'use client';
import { useState } from 'react';
import type { IslPresence } from '@infra/contracts';
import { secureRequest } from '../api';

export function PresenceCard({ deviceId, accessKey }: { deviceId: string; accessKey: string }) {
  const [presence, setPresence] = useState<IslPresence | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  async function check() {
    setWorking(true);
    setError('');
    setPresence(null);
    try {
      setPresence(
        await secureRequest<IslPresence>(
          `/devices/${encodeURIComponent(deviceId)}/presence`,
          accessKey,
        ),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha ao consultar presença.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="support-note">
      <button className="btn" disabled={working} onClick={() => void check()}>
        {working ? 'Consultando ISL...' : 'Consultar presença no ISL'}
      </button>
      {presence && (
        <p role="status">
          {presence.computer
            ? `ISL: ${presence.computer.status}`
            : 'Computador ausente da lista autorizada; status não determinado.'}
          <br />
          Consulta: {new Date(presence.checkedAt).toLocaleString('pt-BR')}
        </p>
      )}
      <p>
        Presença no ISL indica disponibilidade para acesso remoto. O estado do inventário é
        informado separadamente; Spooler e impressão exigem diagnóstico.
      </p>
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
