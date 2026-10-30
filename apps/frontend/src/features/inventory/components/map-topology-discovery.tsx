'use client';
import { useState } from 'react';
import type { MapTopologyDiscoveryResult } from '@infra/contracts';
import { api } from '@/lib/api';

const statusLabel = {
  OK: 'Concluída',
  PARTIAL: 'Parcial',
  UNAVAILABLE: 'Indisponível',
  NOT_CONFIGURED: 'Sem servidor cadastrado',
  LINKED: 'Vínculo criado',
  ALREADY_LINKED: 'Já relacionado',
  UNMATCHED: 'Sem correspondência segura',
  AMBIGUOUS: 'Correspondência ambígua',
} as const;

export function MapTopologyDiscovery({
  mapId,
  accessKey,
  canDiscover,
  disabled,
  onCompleted,
}: {
  mapId: string;
  accessKey: string;
  canDiscover: boolean;
  disabled: boolean;
  onCompleted: () => void;
}) {
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<MapTopologyDiscoveryResult | null>(null);
  const [error, setError] = useState('');
  async function discover() {
    if (!accessKey) return;
    setWorking(true);
    setError('');
    try {
      const completed = await api<MapTopologyDiscoveryResult>('/inventory/map-discovery', {
        method: 'POST',
        headers: { 'x-support-token': accessKey },
        body: JSON.stringify({ mapId }),
      });
      setResult(completed);
      onCompleted();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha ao mapear as fontes autorizadas.');
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="field-stack map-topology-discovery">
      <p className="support-help">
        Consulta somente o servidor e os computadores já colocados neste workflow. Não percorre a
        sub-rede, instala filas nem executa reparos. Preenche campos vazios quando a leitura é
        inequívoca e cria vínculos apenas por correspondência exata de fila. O servidor usa uma
        credencial Windows vinculada a uma impressora dele, se houver; caso contrário, usa a
        identidade da API. Os computadores usam a identidade da API. O coletor atual não lê MAC nem
        série de impressoras físicas, então esses campos ficam vazios até haver uma fonte SNMP/API
        autorizada.
      </p>
      {!canDiscover ? (
        <p className="support-help">Salve o workflow para mapear as fontes configuradas.</p>
      ) : !accessKey ? (
        <p className="support-help">Autorize a chave do operador na aba Suporte para iniciar.</p>
      ) : (
        <button
          type="button"
          className="btn btn-primary"
          disabled={disabled || working}
          onClick={() => void discover()}
        >
          {working ? 'Consultando os dispositivos do workflow…' : 'Mapear fontes configuradas'}
        </button>
      )}
      {result && (
        <div className="support-note" role="status">
          <strong>
            Leitura concluída · {new Date(result.completedAt).toLocaleString('pt-BR')}
          </strong>
          <p>
            Servidor {result.server.name ?? 'não definido'}: {statusLabel[result.server.status]} ·{' '}
            {result.server.queueCount} filas
            {result.server.identityFieldsFilled.length > 0 &&
              ` · cadastro preenchido: ${result.server.identityFieldsFilled.join(', ')}`}
          </p>
          {result.server.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
          {result.server.printers.map((printer) => (
            <p key={printer.deviceId}>
              {printer.name}: fila {printer.queueStatus ?? 'sem estado'} · destino{' '}
              {printer.ipAddress ?? 'não informado'}. {printer.summary}
              {printer.fieldsFilled.length > 0 &&
                ` Cadastro preenchido: ${printer.fieldsFilled.join(', ')}.`}
            </p>
          ))}
          {result.computers.map((computer) => (
            <p key={computer.deviceId}>
              {computer.name} ({computer.host}): {statusLabel[computer.status]} ·{' '}
              {computer.installedQueueCount} filas observadas
              {computer.ignoredQueueCount > 0 &&
                ` · ${computer.ignoredQueueCount} filas virtuais/Fax ignoradas`}
              {computer.identityFieldsFilled.length > 0 &&
                ` · cadastro preenchido: ${computer.identityFieldsFilled.join(', ')}`}
              {computer.warnings.length > 0 && ` · ${computer.warnings.join(' ')}`}
            </p>
          ))}
          {result.relations.map((relation, index) => (
            <p key={`${relation.computerId}:${relation.printerName}:${index}`}>
              {relation.computerName} → {relation.printerName}: {statusLabel[relation.status]}.{' '}
              {relation.summary}
            </p>
          ))}
          {result.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      )}
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
