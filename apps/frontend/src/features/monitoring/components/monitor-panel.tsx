'use client';
import { useEffect, useState } from 'react';
import { Activity, RefreshCw, Save } from 'lucide-react';
import type { MonitorConfig, MonitorDetail, MonitorObservation } from '@infra/contracts';
import { api } from '@/lib/api';
import type { Device } from '@/lib/types';
import { monitoringRequest } from '../api';
import { healthColor, healthLabel } from '../status';
import './monitor-panel.css';

const sourceNames = {
  ISL: 'Presença no ISL',
  WINDOWS: 'Saúde do Windows',
  PRINT_SERVER: 'Servidor de impressão',
  TCP: 'Porta TCP',
  PING: 'Ping',
  ISL_DIAGNOSTIC: 'Diagnóstico pelo ISL',
};
const time = (value: string | null) =>
  value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não coletado';
function Metrics({ row }: { row: MonitorObservation }) {
  const data = row.data;
  return (
    <dl className="monitor-metrics">
      {typeof data.spooler === 'string' && (
        <>
          <dt>Spooler</dt>
          <dd>{data.spooler}</dd>
        </>
      )}
      {typeof data.osCaption === 'string' && (
        <>
          <dt>Sistema</dt>
          <dd>{data.osCaption}</dd>
        </>
      )}
      {typeof data.uptimeHours === 'number' && (
        <>
          <dt>Ligado há</dt>
          <dd>{data.uptimeHours.toFixed(1)} h</dd>
        </>
      )}
      {typeof data.freeMemoryPercent === 'number' && (
        <>
          <dt>RAM livre</dt>
          <dd>{data.freeMemoryPercent.toFixed(1)}%</dd>
        </>
      )}
      {Array.isArray(data.disks) &&
        data.disks.map((disk: unknown) =>
          typeof disk === 'object' &&
          disk !== null &&
          'name' in disk &&
          typeof disk.name === 'string' &&
          'freePercent' in disk &&
          typeof disk.freePercent === 'number' ? (
            <div key={disk.name}>
              <dt>Disco {disk.name}</dt>
              <dd>{disk.freePercent.toFixed(1)}% livre</dd>
            </div>
          ) : null,
        )}
      {typeof data.queueName === 'string' && (
        <>
          <dt>Fila</dt>
          <dd>{data.queueName}</dd>
        </>
      )}
      {typeof data.driver === 'string' && (
        <>
          <dt>Driver</dt>
          <dd>{data.driver}</dd>
        </>
      )}
      {typeof data.port === 'number' && (
        <>
          <dt>Porta</dt>
          <dd>
            {data.port}
            {typeof data.latencyMs === 'number' ? ` · ${data.latencyMs} ms` : ''}
          </dd>
        </>
      )}
    </dl>
  );
}
export function MonitorPanel({
  device,
  accessKey,
  onKeyChange,
  onDeviceSaved,
  onChanged,
}: {
  device: Device;
  accessKey: string;
  onKeyChange: (value: string) => void;
  onDeviceSaved: (value: Device) => void;
  onChanged: () => void;
}) {
  const [detail, setDetail] = useState<MonitorDetail | null>(null);
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [targetIp, setTargetIp] = useState(device.ipAddress ?? '');
  const [keyDraft, setKeyDraft] = useState(accessKey);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const endpoint = `/devices/${encodeURIComponent(device.id)}`;
  useEffect(() => {
    if (!accessKey) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let initialized = false;
    const refresh = async () => {
      try {
        const value = await monitoringRequest<MonitorDetail>(endpoint, accessKey, {
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setDetail(value);
          if (!initialized) {
            setConfig(value.config);
            initialized = true;
          }
          setError('');
        }
      } catch (reason) {
        if (!controller.signal.aborted)
          setError(reason instanceof Error ? reason.message : 'Falha ao ler monitoramento.');
      }
      if (!controller.signal.aborted) timer = setTimeout(() => void refresh(), 15_000);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [accessKey, endpoint]);
  const perform = async (mode: 'save' | 'run' | 'refresh') => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'save' && config) {
        if (config.useTcp && !targetIp.trim())
          throw new Error('Informe o endereço IP do equipamento para a verificação TCP.');
        if (targetIp.trim() !== (device.ipAddress ?? '')) {
          const updatedDevice = await api<Device>(endpoint, {
            method: 'PATCH',
            body: JSON.stringify({ ipAddress: targetIp.trim() || null }),
          });
          onDeviceSaved(updatedDevice);
        }
      }
      const value = await monitoringRequest<MonitorDetail>(
        endpoint + (mode === 'run' ? '/run' : ''),
        accessKey,
        mode === 'save'
          ? { method: 'PUT', body: JSON.stringify(config) }
          : mode === 'run'
            ? { method: 'POST' }
            : {},
      );
      setDetail(value);
      setConfig(value.config);
      onChanged();
      setMessage(
        mode === 'save'
          ? 'Configuração salva.'
          : mode === 'run'
            ? 'Coleta concluída; confira cada fonte.'
            : 'Leituras atualizadas.',
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Falha no monitoramento.');
    } finally {
      setBusy(false);
    }
  };
  const update = (value: Partial<MonitorConfig>) =>
    setConfig((previous) => (previous ? { ...previous, ...value } : previous));
  return (
    <section className="monitor-panel" aria-label="Monitoramento do dispositivo">
      <h3>
        <Activity size={17} /> Monitoramento
      </h3>
      <p className="support-help">
        As leituras ficam separadas do estado manual do inventário. Conectar uma impressora define o
        que deve ser encontrado no computador.
      </p>
      {!accessKey ? (
        <>
          <label className="form-row">
            <span>Chave do operador</span>
            <input
              className="field"
              type="password"
              autoComplete="off"
              value={keyDraft}
              onChange={(event) => setKeyDraft(event.target.value)}
            />
          </label>
          <button
            className="btn"
            disabled={!keyDraft.trim()}
            onClick={() => onKeyChange(keyDraft.trim())}
          >
            Autorizar monitoramento
          </button>
        </>
      ) : (
        config &&
        detail && (
          <>
            <div className="monitor-state" role="status">
              <span style={{ background: healthColor[detail.health.state] }} />
              <strong>{healthLabel[detail.health.state]}</strong>
              <p>{detail.health.summary}</p>
              <small>Última leitura: {time(detail.health.checkedAt)}</small>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void perform('save');
              }}
            >
              <fieldset disabled={busy}>
                <legend>Fontes de coleta</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={config.enabled}
                    onChange={(event) => update({ enabled: event.target.checked })}
                  />{' '}
                  Monitoramento automático
                </label>
                {device.kind === 'COMPUTER' && (
                  <label>
                    <input
                      type="checkbox"
                      checked={config.useIsl}
                      onChange={(event) => update({ useIsl: event.target.checked })}
                    />{' '}
                    Presença no ISL (vincular na aba Suporte)
                  </label>
                )}
                {['COMPUTER', 'SERVER', 'PDV'].includes(device.kind) && (
                  <label>
                    <input
                      type="checkbox"
                      checked={config.useWindows}
                      onChange={(event) => update({ useWindows: event.target.checked })}
                    />{' '}
                    Windows: Spooler, discos, memória e filas
                  </label>
                )}
                {device.kind === 'PRINTER' && (
                  <label>
                    <input
                      type="checkbox"
                      checked={config.usePrintServer}
                      onChange={(event) => update({ usePrintServer: event.target.checked })}
                    />{' '}
                    Fila no servidor de impressão cadastrado
                  </label>
                )}
                <label>
                  <input
                    type="checkbox"
                    checked={config.useTcp}
                    onChange={(event) => update({ useTcp: event.target.checked })}
                  />{' '}
                  Verificar uma porta TCP conhecida
                </label>
                <label className="form-row">
                  <span>Endereço IP do equipamento</span>
                  <input
                    className="field"
                    type="text"
                    aria-label="Endereço IP do equipamento"
                    inputMode="decimal"
                    autoComplete="off"
                    maxLength={45}
                    value={targetIp}
                    onChange={(event) => setTargetIp(event.target.value)}
                    placeholder="192.168.27.201"
                  />
                  <small className="support-help">
                    Digite o IP completo. Ele será salvo no cadastro do equipamento ao salvar o
                    monitoramento.
                  </small>
                </label>
                {config.useTcp && (
                  <>
                    <label className="form-row">
                      <span>Porta TCP (número)</span>
                      <input
                        className="field"
                        type="number"
                        aria-label="Porta TCP"
                        min={1}
                        max={65535}
                        required
                        value={config.tcpPort ?? ''}
                        onChange={(event) =>
                          update({
                            tcpPort: event.target.value ? Number(event.target.value) : null,
                          })
                        }
                      />
                      <small className="support-help">
                        Informe somente o número da porta TCP conhecida, não o endereço IP.
                      </small>
                    </label>
                  </>
                )}
                <label className="form-row">
                  <span>Intervalo (segundos)</span>
                  <input
                    className="field"
                    type="number"
                    min={30}
                    max={3600}
                    required
                    value={config.intervalSeconds}
                    onChange={(event) => update({ intervalSeconds: Number(event.target.value) })}
                  />
                </label>
                <label className="form-row">
                  <span>Timeout por fonte (segundos)</span>
                  <input
                    className="field"
                    type="number"
                    min={1}
                    max={15}
                    required
                    value={config.timeoutSeconds}
                    onChange={(event) => update({ timeoutSeconds: Number(event.target.value) })}
                  />
                </label>
                <button className="btn" type="submit">
                  <Save size={14} /> Salvar monitoramento
                </button>
              </fieldset>
            </form>
            <p className="support-help">
              A coleta Windows usa a identidade que executa a API e precisa de permissão no destino.
              Não abre a janela de senha do Windows. Sem acesso, a leitura fica indisponível.
            </p>
            <div className="monitor-buttons">
              <button
                className="btn"
                disabled={
                  busy || !detail.saved || JSON.stringify(config) !== JSON.stringify(detail.config)
                }
                onClick={() => void perform('run')}
              >
                <Activity size={14} /> Coletar agora
              </button>
              <button className="btn" disabled={busy} onClick={() => void perform('refresh')}>
                <RefreshCw size={14} /> Atualizar leituras
              </button>
            </div>
            {busy && <p role="status">Aguarde a conclusão…</p>}
            {detail.health.observations.map((row) => (
              <article className="monitor-reading" key={row.id}>
                <strong style={{ color: healthColor[row.status] }}>
                  {sourceNames[row.source]} · {healthLabel[row.status]}
                </strong>
                <p>{row.summary}</p>
                <small>{time(row.checkedAt)}</small>
                <Metrics row={row} />
              </article>
            ))}
            {!!detail.health.relations.length && (
              <div>
                <h4>Impressoras esperadas no computador</h4>
                {detail.health.relations.map((row) => (
                  <article className="monitor-reading" key={row.printerId}>
                    <strong>
                      {row.printerName} · {healthLabel[row.status]}
                    </strong>
                    <p>{row.summary}</p>
                    <small>
                      Driver esperado: {row.expectedDriver ?? 'Não cadastrado'}
                      <br />
                      Driver observado: {row.observedDriver ?? 'Sem leitura'}
                    </small>
                  </article>
                ))}
              </div>
            )}
            <details>
              <summary>Histórico recente ({detail.history.length})</summary>
              {detail.history.map((row) => (
                <p key={row.id}>
                  <small>
                    {time(row.checkedAt)} · {sourceNames[row.source]} · {healthLabel[row.status]}
                    <br />
                    {row.summary}
                  </small>
                </p>
              ))}
            </details>
          </>
        )
      )}
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
