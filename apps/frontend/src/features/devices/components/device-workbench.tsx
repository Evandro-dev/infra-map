'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import {
  Activity,
  ArrowLeft,
  ArrowUpRight,
  CircleAlert,
  Computer,
  KeyRound,
  LoaderCircle,
  Play,
  Printer,
  RefreshCw,
  Router,
  Save,
  Settings2,
  Wifi,
} from 'lucide-react';
import type { ManagedCredentialSummary, MonitorConfig, MonitorDetail } from '@infra/contracts';
import { InventoryForm } from '@/components/inventory-form';
import { SidebarResizer } from '@/components/layout/sidebar-resizer';
import { api } from '@/lib/api';
import type { Device, MapConnection, MapRecord } from '@/lib/types';
import { credentialProviders } from '@/features/credentials/credential-providers';
import { monitoringRequest } from '@/features/monitoring/api';
import { healthColor, healthLabel } from '@/features/monitoring/status';
import styles from './device-workbench.module.css';

const sourceLabels: Record<string, string> = {
  PING: 'Ping',
  TCP: 'Porta TCP',
  WINDOWS: 'Windows',
  PRINT_SERVER: 'Servidor de impressão',
  ISL: 'ISL',
  ISL_DIAGNOSTIC: 'Diagnóstico ISL',
};
const printServerCredential = credentialProviders.find(
  (provider) => provider.id === 'WINDOWS_PRINT_SERVER',
);

function normalizeServerName(value: string) {
  return value.replaceAll(String.fromCharCode(92), '').trim().toLocaleLowerCase('en-US');
}

function usePanelWidth(key: string, initial: number) {
  const [width, setWidth] = useState(initial);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = Number(window.localStorage.getItem(key));
        if (stored >= 180 && stored <= 440) setWidth(stored);
      } catch {
        // Local storage is optional.
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [key]);
  return [width, setWidth] as const;
}

function displayTime(value: string) {
  return new Date(value).toLocaleString('pt-BR');
}

function kindIcon(kind: string) {
  if (kind === 'PRINTER') return <Printer size={17} />;
  if (kind === 'SERVER') return <Router size={17} />;
  return <Computer size={17} />;
}

export function DeviceWorkbench({ mapId, nodeId }: { mapId: string; nodeId: string }) {
  const [map, setMap] = useState<MapRecord | null>(null);
  const [connections, setConnections] = useState<MapConnection[]>([]);
  const [deviceOverride, setDeviceOverride] = useState<Device | null>(null);
  const [activeTab, setActiveTab] = useState<'parameters' | 'settings'>('parameters');
  const [leftWidth, setLeftWidth] = usePanelWidth('infra-map-node-input-width', 280);
  const [rightWidth, setRightWidth] = usePanelWidth('infra-map-node-output-width', 340);
  const [operatorDraft, setOperatorDraft] = useState('');
  const [operatorKey, setOperatorKey] = useState('');
  const [targetIp, setTargetIp] = useState('');
  const [detail, setDetail] = useState<MonitorDetail | null>(null);
  const [config, setConfig] = useState<MonitorConfig | null>(null);
  const [credentials, setCredentials] = useState<ManagedCredentialSummary[]>([]);
  const [credentialSelection, setCredentialSelection] = useState<{
    deviceId: string | null;
    value: string;
  }>({ deviceId: null, value: '' });
  const [credentialError, setCredentialError] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void Promise.all([
      api<MapRecord>(`/maps/${encodeURIComponent(mapId)}`, { signal: controller.signal }),
      api<{ connections: MapConnection[] }>(`/maps/${encodeURIComponent(mapId)}/connections`, {
        signal: controller.signal,
      }),
    ])
      .then(([mapData, connectionData]) => {
        if (controller.signal.aborted) return;
        setMap(mapData);
        setConnections(connectionData.connections);
        const node = mapData.elements.find((element) => element.id === nodeId);
        if (node?.device) setTargetIp(node.device.ipAddress ?? '');
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'Não foi possível abrir o dispositivo.',
          );
      });
    return () => controller.abort();
  }, [mapId, nodeId]);

  const element = map?.elements.find((item) => item.id === nodeId) ?? null;
  const device = deviceOverride ?? element?.device ?? null;
  const credentialDraft =
    credentialSelection.deviceId === device?.id
      ? credentialSelection.value
      : (device?.credentialId ?? '');
  const relatedElements = useMemo(() => {
    if (!map) return [];
    return connections.flatMap((connection) => {
      const relatedId =
        connection.sourceElementId === nodeId
          ? connection.targetElementId
          : connection.targetElementId === nodeId
            ? connection.sourceElementId
            : null;
      if (!relatedId) return [];
      const related = map.elements.find((item) => item.id === relatedId);
      return related?.device ? [{ element: related, connection }] : [];
    });
  }, [connections, map, nodeId]);

  async function loadDetail(token = operatorKey) {
    if (!device || !token) return;
    const result = await monitoringRequest<MonitorDetail>(
      `/devices/${encodeURIComponent(device.id)}`,
      token,
    );
    setDetail(result);
    setConfig(result.config);
  }

  async function connectOperator() {
    const token = operatorDraft.trim();
    if (!token || !device) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await monitoringRequest<MonitorDetail>(
        `/devices/${encodeURIComponent(device.id)}`,
        token,
      );
      setOperatorKey(token);
      setDetail(result);
      setConfig(result.config);
      setMessage('Acesso ao monitoramento liberado nesta tela.');
      setCredentialError('');
      const headers = new Headers();
      headers.set('x-support-token', token);
      try {
        const credentialResult = await api<{ credentials: ManagedCredentialSummary[] }>(
          '/credentials',
          { headers, cache: 'no-store' },
        );
        setCredentials(credentialResult.credentials);
      } catch (reason) {
        setCredentialError(
          reason instanceof Error ? reason.message : 'Não foi possível carregar as credenciais.',
        );
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível liberar o monitoramento.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveSettings() {
    if (!device || !operatorKey || !config) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (config.useTcp && !targetIp.trim())
        throw new Error('Informe o endereço IP do equipamento para a verificação TCP.');
      if (targetIp.trim() !== (device.ipAddress ?? '')) {
        const updated = await api<Device>(`/devices/${encodeURIComponent(device.id)}`, {
          method: 'PATCH',
          body: JSON.stringify({ ipAddress: targetIp.trim() || null }),
        });
        setDeviceOverride(updated);
      }
      const result = await monitoringRequest<MonitorDetail>(
        `/devices/${encodeURIComponent(device.id)}`,
        operatorKey,
        { method: 'PUT', body: JSON.stringify(config) },
      );
      setDetail(result);
      setConfig(result.config);
      setMessage('Parâmetros e monitoramento salvos.');
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Não foi possível salvar as configurações.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveCredential() {
    if (!device || !operatorKey) return;
    setBusy(true);
    setError('');
    setCredentialError('');
    setMessage('');
    try {
      const updated = await api<Device>(`/devices/${encodeURIComponent(device.id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ credentialId: credentialDraft || null }),
      });
      setDeviceOverride(updated);
      setMessage(
        credentialDraft
          ? 'Credencial protegida vinculada ao dispositivo.'
          : 'Credencial removida; a API usará a própria identidade Windows.',
      );
    } catch (reason) {
      setCredentialError(
        reason instanceof Error ? reason.message : 'Não foi possível vincular a credencial.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function runDiagnostics(mode: 'ping' | 'collect' | 'refresh') {
    if (!device || !operatorKey) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'ping') {
        const result = await monitoringRequest<{ summary: string }>(
          `/devices/${encodeURIComponent(device.id)}/ping`,
          operatorKey,
          { method: 'POST' },
        );
        setMessage(result.summary);
      }
      if (mode === 'collect') {
        const result = await monitoringRequest<MonitorDetail>(
          `/devices/${encodeURIComponent(device.id)}/run`,
          operatorKey,
          { method: 'POST' },
        );
        setDetail(result);
        setConfig(result.config);
        setMessage('Verificação concluída. Confira cada resultado no painel Output.');
      } else {
        await loadDetail();
        if (mode === 'refresh') setMessage('Saídas atualizadas.');
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'A verificação falhou.');
    } finally {
      setBusy(false);
    }
  }

  const backPath = `/workflow/${encodeURIComponent(mapId)}` as Route;
  const compatibleCredentials = credentials.filter((credential) => {
    if (device?.kind !== 'PRINTER' || !device.printServer) return false;
    if (credential.provider !== 'WINDOWS_PRINT_SERVER') return false;
    return (
      !credential.targetServer ||
      normalizeServerName(credential.targetServer) === normalizeServerName(device.printServer)
    );
  });
  if (!map || !element || !device)
    return (
      <main className={styles.loading}>
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <LoaderCircle className={styles.spinner} size={23} />
        )}
        {!error && <span>Carregando dispositivo…</span>}
        {error && <Link href={backPath}>Voltar ao workflow</Link>}
      </main>
    );

  return (
    <main
      className={styles.workbench}
      style={
        {
          '--node-input-width': `${leftWidth}px`,
          '--node-output-width': `${rightWidth}px`,
        } as React.CSSProperties
      }
    >
      <header className={styles.header}>
        <Link className={styles.back} href={backPath} aria-label="Voltar ao workflow">
          <ArrowLeft size={17} />
        </Link>
        <span className={styles.deviceIcon}>{kindIcon(device.kind)}</span>
        <div className={styles.title}>
          <strong>{element.name}</strong>
          <small>
            {device.kind} · {device.ipAddress || 'IP não cadastrado'}
          </small>
        </div>
        <div className={styles.identifiers}>
          <span>NODE {element.id}</span>
          <span>DEVICE {device.id}</span>
        </div>
        <Link className={styles.workflowLink} href={backPath}>
          Workflow
        </Link>
      </header>

      <div className={styles.columns}>
        <aside className={`${styles.panel} ${styles.inputs}`} aria-label="Inputs do dispositivo">
          <div className={styles.panelHeading}>
            <span>INPUTS</span>
            <small>{relatedElements.length} conexões</small>
          </div>
          <section className={styles.inputCard}>
            <strong>Dispositivo selecionado</strong>
            <span>{device.name}</span>
            <small>{device.hostname || element.name}</small>
          </section>
          <section className={styles.inputGroup}>
            <h2>Conexões do workflow</h2>
            {relatedElements.length ? (
              relatedElements.map(({ element: related, connection }) => (
                <Link
                  className={styles.connection}
                  href={
                    `/workflow/${encodeURIComponent(mapId)}/${encodeURIComponent(related.id)}` as Route
                  }
                  key={related.id}
                >
                  <span className={styles.connectionIcon}>
                    {kindIcon(related.device?.kind ?? '')}
                  </span>
                  <span>
                    <strong>{related.name}</strong>
                    <small>
                      {connection.kind === 'PRINTING'
                        ? 'Impressora instalada no computador'
                        : connection.kind === 'SERVES'
                          ? 'Fila hospedada no servidor'
                          : 'Relação de rede'}
                      {' · '}
                      {related.device?.ipAddress || 'IP desconhecido'}
                    </small>
                  </span>
                  <ArrowUpRight size={14} />
                </Link>
              ))
            ) : (
              <p className={styles.empty}>Nenhuma conexão registrada para este nó.</p>
            )}
          </section>
          <section className={styles.inputGroup}>
            <h2>Dados recebidos</h2>
            <dl className={styles.inputValues}>
              <dt>IP</dt>
              <dd>{device.ipAddress || 'Desconhecido'}</dd>
              <dt>Hostname</dt>
              <dd>{device.hostname || 'Desconhecido'}</dd>
              <dt>Modelo</dt>
              <dd>{device.model || 'Desconhecido'}</dd>
              <dt>Servidor</dt>
              <dd>{device.printServer || 'Não se aplica'}</dd>
              <dt>Fila</dt>
              <dd>{device.printQueue || device.printShare || 'Não cadastrada'}</dd>
            </dl>
          </section>
        </aside>

        <SidebarResizer
          sidebarWidth={leftWidth}
          resizeSidebar={setLeftWidth}
          storageKey="infra-map-node-input-width"
          defaultWidth={280}
        />

        <section
          className={`${styles.panel} ${styles.parameters}`}
          aria-label="Parâmetros e configurações"
        >
          <div className={styles.centerHeader}>
            <div className={styles.tabs} role="tablist" aria-label="Editor do dispositivo">
              <button
                className={activeTab === 'parameters' ? styles.activeTab : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === 'parameters'}
                onClick={() => setActiveTab('parameters')}
              >
                <Settings2 size={15} /> Parameters
              </button>
              <button
                className={activeTab === 'settings' ? styles.activeTab : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === 'settings'}
                onClick={() => setActiveTab('settings')}
              >
                Settings
              </button>
            </div>
            {activeTab === 'settings' && operatorKey && (
              <button
                className={styles.execute}
                type="button"
                disabled={busy}
                onClick={() => void runDiagnostics('collect')}
              >
                <Play size={14} /> Executar etapa
              </button>
            )}
          </div>

          {activeTab === 'parameters' ? (
            <div className={styles.formContent}>
              <InventoryForm
                device={device}
                effectiveName={element.name}
                onSaved={setDeviceOverride}
              />
              {device.kind === 'PRINTER' && device.printServer && (
                <section
                  className={styles.credentialSection}
                  aria-label="Credencial do dispositivo"
                >
                  <div className={styles.credentialHeading}>
                    <KeyRound size={16} />
                    <div>
                      <h2>Credencial</h2>
                      <p>
                        {printServerCredential?.name ?? 'Windows Print Server'} ·{' '}
                        {device.printServer}
                      </p>
                    </div>
                  </div>
                  {!operatorKey ? (
                    <button
                      className={styles.inlineAction}
                      type="button"
                      onClick={() => setActiveTab('settings')}
                    >
                      Conectar em Settings para carregar credenciais
                    </button>
                  ) : (
                    <>
                      <label className="form-row">
                        <span>Credencial do servidor de impressão</span>
                        <select
                          className="field"
                          aria-label="Credencial do servidor de impressão"
                          value={credentialDraft}
                          disabled={busy}
                          onChange={(event) =>
                            setCredentialSelection({
                              deviceId: device.id,
                              value: event.target.value,
                            })
                          }
                        >
                          <option value="">Usar identidade Windows da API</option>
                          {compatibleCredentials.map((credential) => (
                            <option key={credential.id} value={credential.id}>
                              {credential.name}
                              {credential.targetServer ? ` · ${credential.targetServer}` : ''}
                            </option>
                          ))}
                        </select>
                        {compatibleCredentials.length === 0 && (
                          <small className="support-help">
                            Nenhuma credencial compatível para {device.printServer}.
                          </small>
                        )}
                        {printServerCredential && (
                          <small className="support-help">
                            Campos protegidos:{' '}
                            {printServerCredential.fields.map((field) => field.label).join(' · ')}
                          </small>
                        )}
                      </label>
                      <div className={styles.credentialActions}>
                        <button
                          className="btn"
                          type="button"
                          disabled={busy || credentialDraft === (device.credentialId ?? '')}
                          onClick={() => void saveCredential()}
                        >
                          Vincular credencial
                        </button>
                        <Link href="/personal/credentials" className={styles.inlineAction}>
                          Gerenciar credenciais
                        </Link>
                      </div>
                    </>
                  )}
                  {credentialError && (
                    <p className={styles.error} role="alert">
                      {credentialError}
                    </p>
                  )}
                </section>
              )}
            </div>
          ) : (
            <div className={styles.settingsContent}>
              {!operatorKey ? (
                <section className={styles.keyGate}>
                  <h2>Acesso ao monitoramento</h2>
                  <p>
                    Informe a chave do operador para carregar e salvar as configurações deste
                    dispositivo.
                  </p>
                  <label className="form-row">
                    <span>Chave do operador</span>
                    <input
                      className="field"
                      type="password"
                      autoComplete="off"
                      value={operatorDraft}
                      onChange={(event) => setOperatorDraft(event.target.value)}
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={busy || !operatorDraft.trim()}
                    onClick={() => void connectOperator()}
                  >
                    Conectar
                  </button>
                </section>
              ) : config ? (
                <>
                  <section className={styles.settingsSection}>
                    <h2>Parâmetros de monitoramento</h2>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(event) =>
                          setConfig({ ...config, enabled: event.target.checked })
                        }
                      />
                      Monitoramento automático
                    </label>
                    {device.kind === 'COMPUTER' && (
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          checked={config.useWindows}
                          onChange={(event) =>
                            setConfig({ ...config, useWindows: event.target.checked })
                          }
                        />
                        Windows: Spooler, sistema e impressoras instaladas
                      </label>
                    )}
                    {device.kind === 'PRINTER' &&
                      device.printServer &&
                      (device.printQueue || device.printShare) && (
                        <label className={styles.checkbox}>
                          <input
                            type="checkbox"
                            checked={config.usePrintServer}
                            onChange={(event) =>
                              setConfig({ ...config, usePrintServer: event.target.checked })
                            }
                          />
                          Estado da fila no servidor de impressão
                        </label>
                      )}
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
                        Digite o IP completo. Este endereço será salvo no cadastro do dispositivo.
                      </small>
                    </label>
                    <label className={styles.checkbox}>
                      <input
                        type="checkbox"
                        checked={config.useTcp}
                        onChange={(event) => setConfig({ ...config, useTcp: event.target.checked })}
                      />
                      Verificar porta TCP
                    </label>
                    {config.useTcp && (
                      <label className="form-row">
                        <span>Porta TCP (número)</span>
                        <input
                          className="field"
                          type="number"
                          aria-label="Porta TCP"
                          min={1}
                          max={65535}
                          value={config.tcpPort ?? ''}
                          onChange={(event) =>
                            setConfig({
                              ...config,
                              tcpPort: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                          placeholder="9100"
                        />
                      </label>
                    )}
                    <div className={styles.twoColumns}>
                      <label className="form-row">
                        <span>Intervalo (segundos)</span>
                        <input
                          className="field"
                          type="number"
                          min={30}
                          max={3600}
                          value={config.intervalSeconds}
                          onChange={(event) =>
                            setConfig({ ...config, intervalSeconds: Number(event.target.value) })
                          }
                        />
                      </label>
                      <label className="form-row">
                        <span>Timeout (segundos)</span>
                        <input
                          className="field"
                          type="number"
                          min={1}
                          max={15}
                          value={config.timeoutSeconds}
                          onChange={(event) =>
                            setConfig({ ...config, timeoutSeconds: Number(event.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={busy}
                      onClick={() => void saveSettings()}
                    >
                      <Save size={14} /> Salvar parâmetros
                    </button>
                  </section>
                  <p className={styles.permissionsNote}>
                    Ping e TCP são verificações de leitura. Windows usa a identidade que executa a
                    API; nenhuma senha é solicitada ao computador monitorado.
                  </p>
                </>
              ) : (
                <p>Carregando configurações…</p>
              )}
            </div>
          )}
        </section>

        <SidebarResizer
          sidebarWidth={rightWidth}
          resizeSidebar={setRightWidth}
          storageKey="infra-map-node-output-width"
          direction="reverse"
          defaultWidth={340}
        />

        <aside className={`${styles.panel} ${styles.outputs}`} aria-label="Saídas e diagnósticos">
          <div className={styles.panelHeading}>
            <span>OUTPUT</span>
            {detail && (
              <small style={{ color: healthColor[detail.health.state] }}>
                {healthLabel[detail.health.state]}
              </small>
            )}
          </div>
          {detail && (
            <div className={styles.healthSummary}>
              <Activity size={17} />
              <span>{detail.health.summary}</span>
            </div>
          )}
          <div className={styles.quickActions}>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!operatorKey || busy || !(device.ipAddress || device.hostname)}
              onClick={() => void runDiagnostics('ping')}
            >
              <Wifi size={15} /> Ping
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!operatorKey || busy || !detail?.saved}
              onClick={() => void runDiagnostics('collect')}
            >
              <Play size={15} /> Verificar agora
            </button>
            <button
              type="button"
              className={styles.actionButton}
              disabled={!operatorKey || busy}
              onClick={() => void runDiagnostics('refresh')}
            >
              <RefreshCw size={15} /> Atualizar
            </button>
          </div>
          {device.kind === 'COMPUTER' && config?.useWindows && (
            <p className={styles.quickHelp}>
              A coleta Windows valida o Spooler e compara as filas instaladas com as conexões
              registradas neste workflow.
            </p>
          )}
          {!operatorKey ? (
            <div className={styles.outputEmpty}>
              <CircleAlert size={22} />
              <strong>Monitoramento bloqueado</strong>
              <span>Abra Settings e conecte com a chave do operador.</span>
            </div>
          ) : !detail?.health.observations.length ? (
            <div className={styles.outputEmpty}>
              <Activity size={22} />
              <strong>Sem saída ainda</strong>
              <span>Execute Ping ou configure as fontes e clique em Verificar agora.</span>
            </div>
          ) : (
            <div className={styles.outputList}>
              {detail.health.relations.length > 0 && (
                <section
                  className={styles.relationList}
                  aria-label="Conferência das filas instaladas"
                >
                  <div className={styles.outputTitle}>
                    <strong>Conferência das filas instaladas</strong>
                    <span>{detail.health.relations.length}</span>
                  </div>
                  {detail.health.relations.map((relation) => (
                    <article className={styles.relationCard} key={relation.printerId}>
                      <div className={styles.outputTitle}>
                        <strong>{relation.printerName}</strong>
                        <span style={{ color: healthColor[relation.status] }}>
                          {healthLabel[relation.status]}
                        </span>
                      </div>
                      <p>{relation.summary}</p>
                      <dl className={styles.relationFacts}>
                        <dt>Relação</dt>
                        <dd>{relation.relationType === 'SHARED' ? 'Compartilhada' : 'Local'}</dd>
                        <dt>Fila esperada</dt>
                        <dd>{relation.expectedQueue || 'Não cadastrada'}</dd>
                        <dt>Fila observada</dt>
                        <dd>{relation.observedQueue || 'Não confirmada'}</dd>
                        <dt>Porta esperada</dt>
                        <dd>{relation.expectedPort || 'Não cadastrada'}</dd>
                        <dt>Porta observada</dt>
                        <dd>{relation.observedPort || 'Não informada'}</dd>
                        <dt>Driver esperado</dt>
                        <dd>{relation.expectedDriver || 'Não cadastrado'}</dd>
                        <dt>Driver observado</dt>
                        <dd>{relation.observedDriver || 'Não informado'}</dd>
                      </dl>
                    </article>
                  ))}
                </section>
              )}
              {detail.health.observations.map((row) => (
                <article className={styles.outputCard} key={row.id}>
                  <div className={styles.outputTitle}>
                    <strong>{sourceLabels[row.source] ?? row.source}</strong>
                    <span style={{ color: healthColor[row.status] }}>
                      {healthLabel[row.status]}
                    </span>
                  </div>
                  <p>{row.summary}</p>
                  <small>{displayTime(row.checkedAt)}</small>
                  {Object.keys(row.data).length > 0 && (
                    <details>
                      <summary>Detalhes da leitura</summary>
                      <pre>{JSON.stringify(row.data, null, 2)}</pre>
                    </details>
                  )}
                </article>
              ))}
            </div>
          )}
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className={styles.message} role="status">
              {message}
            </p>
          )}
          {busy && (
            <p className={styles.busy}>
              <LoaderCircle size={14} /> Executando…
            </p>
          )}
        </aside>
      </div>
    </main>
  );
}
