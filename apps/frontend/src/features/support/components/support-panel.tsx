'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Link2,
  MonitorUp,
  Printer,
  RefreshCw,
  Shield,
  Unplug,
  Wrench,
  XCircle,
} from 'lucide-react';
import type { Device } from '@/lib/types';
import type {
  IslComputer as Computer,
  SupportSettings as Settings,
  PrinterConfiguration,
} from '@infra/contracts';
import { PrinterConfigurationFields } from '@/features/inventory/components/printer-configuration-fields';
import { PrintDiscoveryPanel } from '@/features/inventory/components/print-discovery-panel';
import { printerConfiguration } from '@/features/inventory/printer-configuration';
import { notifyCatalogChanged } from '@/features/inventory/catalog-events';
import type { SupportDevice as SDevice } from '../types';
import { secureRequest } from '../api';
import { comparePrinters } from '../printer-comparison';
import { PresenceCard } from './presence-card';
import { SupportHistory } from './support-history';
import { WindowsPermissionsNote } from './windows-permissions-note';

export function SupportPanel({
  device,
  accessKey,
  onKeyChange,
  onRelationshipsChanged,
  onDeviceSaved,
}: {
  device: Device;
  accessKey: string;
  onKeyChange: (key: string) => void;
  onRelationshipsChanged?: () => void;
  onDeviceSaved: (device: Device) => void;
}) {
  const [details, setDetails] = useState<SDevice | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [computers, setComputers] = useState<Computer[]>([]);
  const [printers, setPrinters] = useState<Device[]>([]);
  const [search, setSearch] = useState('');
  const [password, setPassword] = useState('');
  const [jobAction, setJobAction] = useState('spooler_status');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [working, setWorking] = useState(false);
  const [printerId, setPrinterId] = useState('');
  const [printConfig, setPrintConfig] = useState<PrinterConfiguration>(() =>
    printerConfiguration(device),
  );
  const [showKey, setShowKey] = useState(false);
  const [keyDraft, setKeyDraft] = useState(accessKey);
  const [report, setReport] = useState('');
  const [reportAnalysis, setReportAnalysis] = useState<string[]>([]);
  const refresh = useCallback(async () => {
    if (!accessKey) return;
    const [s, d] = await Promise.all([
      secureRequest<Settings>('/settings', accessKey),
      secureRequest<SDevice>(`/devices/${encodeURIComponent(device.id)}`, accessKey),
    ]);
    setSettings(s);
    setDetails(d);
    setPrintConfig(printerConfiguration(d));
  }, [accessKey, device.id]);
  useEffect(() => {
    if (!accessKey) return;
    let current = true;
    void Promise.all([
      secureRequest<Settings>('/settings', accessKey),
      secureRequest<SDevice>(`/devices/${encodeURIComponent(device.id)}`, accessKey),
    ])
      .then(([s, d]) => {
        if (current) {
          setSettings(s);
          setDetails(d);
          setError('');
          setPrintConfig(printerConfiguration(d));
        }
      })
      .catch((err) => {
        if (current) setError(String(err instanceof Error ? err.message : err));
      });
    return () => {
      current = false;
    };
  }, [accessKey, device.id]);
  const run = async (task: () => Promise<void>) => {
    setWorking(true);
    setError('');
    setMessage('');
    try {
      await task();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setWorking(false);
    }
  };
  const discover = () =>
    void run(async () => {
      const result = await secureRequest<{ computers: Computer[] }>(
        `/computers?search=${encodeURIComponent(search)}`,
        accessKey,
      );
      setComputers(result.computers);
      setMessage(`${result.computers.length} computador(es) encontrado(s).`);
    });
  const link = (c: Computer) =>
    void run(async () => {
      await secureRequest(`/devices/${encodeURIComponent(device.id)}/isl-link`, accessKey, {
        method: 'PUT',
        body: JSON.stringify({ islComputerId: c.id, islComputerName: c.name }),
      });
      setMessage(`Vínculo criado: ${c.name}`);
    });
  const action = () =>
    void run(async () => {
      if (
        !window.confirm(
          `Executar ${jobAction.replaceAll('_', ' ')} remotamente em ${details?.name}? ${settings?.actions.find((a) => a.id === jobAction)?.detail ?? ''} Confirme que este atendimento está autorizado.`,
        )
      )
        return;
      if (!password.trim())
        throw new Error(
          'Informe a senha de acesso do computador no ISL somente para esta operação.',
        );
      try {
        const response = await secureRequest<{ jobId: string; status: string }>(
          `/devices/${encodeURIComponent(device.id)}/actions`,
          accessKey,
          {
            method: 'POST',
            body: JSON.stringify({
              action: jobAction,
              accessPassword: password,
              confirm: true,
              confirmDataLoss: jobAction === 'clear_spooler',
            }),
          },
        );
        setMessage(`Comando enviado (operação ${response.jobId}). Consulte o status no histórico.`);
      } finally {
        setPassword('');
      }
    });
  const isPC = device.kind === 'COMPUTER',
    isPrinter = device.kind === 'PRINTER';
  if (!isPC && !isPrinter) return null;
  return (
    <section className="support-panel" aria-label="Central de suporte">
      <div className="support-header">
        <Shield size={17} />
        <strong>Central de suporte</strong>
      </div>
      <p className="support-help">
        O editor não exige login. Esta área administrativa requer uma chave exclusiva configurada no
        backend.
      </p>
      <label className="form-row">
        <span className="muted">Chave do operador (somente nesta sessão)</span>
        <div className="support-key">
          <input
            className="field"
            type={showKey ? 'text' : 'password'}
            autoComplete="off"
            spellCheck={false}
            value={keyDraft}
            onChange={(e) => setKeyDraft(e.target.value)}
            placeholder="SUPPORT_OPERATOR_TOKEN"
          />
          <button
            className="btn icon-btn"
            onClick={() => setShowKey((v) => !v)}
            title="Mostrar/ocultar chave"
            aria-label="Mostrar/ocultar chave"
          >
            <Shield size={16} />
          </button>
        </div>
      </label>
      <button
        className="btn"
        onClick={() => onKeyChange(keyDraft.trim())}
        disabled={!keyDraft.trim() || working}
      >
        <Shield size={14} /> Autorizar suporte
      </button>
      {accessKey && (
        <button
          className="btn"
          disabled={working}
          onClick={() => {
            onKeyChange('');
            setKeyDraft('');
            setDetails(null);
            setSettings(null);
            setComputers([]);
            setPassword('');
            setReport('');
            setReportAnalysis([]);
          }}
        >
          Encerrar acesso de suporte
        </button>
      )}
      {!accessKey && (
        <div className="support-note">
          Configure a chave no arquivo <code>apps/backend/.env</code> para usar o suporte.
        </div>
      )}
      {accessKey && (
        <>
          <button
            className="btn"
            disabled={working}
            onClick={() =>
              void run(async () => {
                await refresh();
                setMessage('Dados atualizados.');
              })
            }
          >
            <RefreshCw size={14} /> Atualizar
          </button>
          {settings && (
            <div className="support-note">
              ISL: <strong>{settings.mode}</strong> ·{' '}
              {settings.configured ? 'Credenciais configuradas' : 'Credenciais pendentes'} · Execute{' '}
              {settings.remoteExecuteEnabled ? 'habilitado' : 'bloqueado'}
            </div>
          )}
          {isPC && (
            <>
              <h4>
                <MonitorUp size={15} /> Computador ISL
              </h4>
              <div className="support-note">
                {details?.islComputerId
                  ? `Vinculado a ${details.islComputerName ?? details.islComputerId}`
                  : 'Nenhum computador ISL vinculado.'}
              </div>
              <label className="form-row">
                <span className="muted">Buscar na lista ISL</span>
                <input
                  className="field"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome ou parte do nome"
                />
              </label>
              <button
                className="btn"
                disabled={working || !settings?.configured || settings.mode === 'disabled'}
                onClick={discover}
              >
                Buscar computadores
              </button>
              <div className="support-results">
                {computers.slice(0, 30).map((c) => (
                  <div key={c.id} className="support-result">
                    <div>
                      <strong>{c.name}</strong>
                      <small>
                        {c.hostName ?? 'Hostname não informado'} · {c.status}
                      </small>
                    </div>
                    <button className="btn" disabled={working} onClick={() => link(c)}>
                      <Link2 size={13} /> Vincular
                    </button>
                  </div>
                ))}
              </div>
              {details?.islComputerId && (
                <PresenceCard
                  key={details.islComputerId}
                  deviceId={device.id}
                  accessKey={accessKey}
                />
              )}
              {details?.islComputerId && (
                <div className="support-actions">
                  <button
                    className="btn"
                    disabled={working || !settings?.localLauncherReady}
                    onClick={() =>
                      void run(async () => {
                        await secureRequest(
                          `/devices/${encodeURIComponent(device.id)}/open-isl`,
                          accessKey,
                          { method: 'POST' },
                        );
                        setMessage('ISL Light solicitado neste Windows.');
                      })
                    }
                  >
                    <MonitorUp size={15} /> Abrir ISL Light
                  </button>
                  <button
                    className="btn"
                    disabled={working}
                    onClick={() =>
                      void run(async () => {
                        await secureRequest(
                          `/devices/${encodeURIComponent(device.id)}/isl-link`,
                          accessKey,
                          { method: 'DELETE' },
                        );
                        setComputers([]);
                        setMessage('Vínculo removido.');
                      })
                    }
                  >
                    <Unplug size={14} /> Desvincular
                  </button>
                </div>
              )}
              <h4>
                <Printer size={15} /> Impressoras associadas
              </h4>
              {details?.assignedPrinters.map((p) => (
                <div className="support-result" key={p.printerId}>
                  <span>{p.printer.name}</span>
                  <button
                    className="btn icon-btn"
                    aria-label="Remover associação"
                    disabled={working}
                    onClick={() =>
                      void run(async () => {
                        await secureRequest(
                          `/devices/${encodeURIComponent(device.id)}/printers/${encodeURIComponent(p.printerId)}`,
                          accessKey,
                          { method: 'DELETE' },
                        );
                        setMessage('Associação removida.');
                        onRelationshipsChanged?.();
                      })
                    }
                  >
                    <XCircle size={15} />
                  </button>
                </div>
              ))}
              <button
                className="btn"
                disabled={working}
                onClick={() =>
                  void run(async () => {
                    const response = await fetch('/api/v1/devices');
                    if (!response.ok) throw new Error('Falha ao consultar inventário.');
                    setPrinters(
                      ((await response.json()) as Device[]).filter((d) => d.kind === 'PRINTER'),
                    );
                  })
                }
              >
                Escolher impressora do inventário
              </button>
              {printers.length > 0 && (
                <div className="support-inline">
                  <select
                    className="field"
                    value={printerId}
                    onChange={(e) => setPrinterId(e.target.value)}
                  >
                    <option value="">Selecione</option>
                    {printers.map((p) => (
                      <option value={p.id} key={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn"
                    disabled={!printerId || working}
                    onClick={() =>
                      void run(async () => {
                        await secureRequest(
                          `/devices/${encodeURIComponent(device.id)}/printers`,
                          accessKey,
                          { method: 'POST', body: JSON.stringify({ printerId }) },
                        );
                        setMessage('Impressora associada.');
                        onRelationshipsChanged?.();
                      })
                    }
                  >
                    <Link2 size={15} />
                  </button>
                </div>
              )}
              <h4>
                <Wrench size={15} /> Diagnósticos e reparos
              </h4>
              <WindowsPermissionsNote />
              <details className="support-note">
                <summary>Procedimentos assistidos: reinstalar impressora ou driver</summary>
                <p>
                  Abra o ISL Light, confirme a conta do usuário conectado, confira a impressora
                  homologada e seus trabalhos pendentes. Para uma fila compartilhada, confirme o
                  caminho <code>{String.raw`\\servidor\fila`}</code> e instale no perfil correto.
                  Driver: obtenha somente o pacote aprovado pela TI; verifique arquitetura e
                  possíveis outras filas que utilizam o mesmo driver. Teste antes de remover a
                  configuração antiga.
                </p>
                {details?.assignedPrinters.map((p) => (
                  <p key={p.printerId}>
                    <strong>{p.printer.name}</strong>: consulte os dados de servidor, fila e driver
                    no cadastro da impressora.
                  </p>
                ))}
              </details>
              <p className="support-help">
                Somente comandos predefinidos. Reinstalação de impressora e driver é assistida no
                ISL Light até homologarmos a configuração e o método de execução.
              </p>
              <label className="form-row">
                <span className="muted">Ação</span>
                <select
                  className="field"
                  value={jobAction}
                  onChange={(e) => setJobAction(e.target.value)}
                >
                  {settings?.actions.map((a) => (
                    <option key={a.id} value={a.id} disabled={a.risk === 'ASSISTED'}>
                      {a.name}
                      {a.risk === 'ASSISTED' ? ' (assistida)' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <p className="support-help">
                {settings?.actions.find((a) => a.id === jobAction)?.detail}
              </p>
              <label className="form-row">
                <span className="muted">Senha de acesso ISL do PC — não é salva</span>
                <input
                  className="field"
                  type="password"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Exigida apenas para Execute"
                />
              </label>
              <button
                className="btn btn-primary"
                disabled={working || !details?.islComputerId || !settings?.remoteExecuteEnabled}
                onClick={action}
              >
                <Wrench size={15} /> Solicitar execução
              </button>
              {!settings?.remoteExecuteEnabled && (
                <p className="support-help">
                  Execução desligada no `.env` por segurança. Diagnósticos remotos precisam ser
                  autorizados e testados no ISL.
                </p>
              )}
              {report && <pre className="support-report">{report}</pre>}
              {reportAnalysis.map((item, i) => (
                <p className="support-note" key={i}>
                  {item}
                </p>
              ))}
              <SupportHistory
                jobs={details?.supportJobs ?? []}
                accessKey={accessKey}
                working={working}
                run={run}
                onMessage={setMessage}
                onReport={(action, content) => {
                  setReport(content);
                  setReportAnalysis(
                    action === 'printer_inventory'
                      ? comparePrinters(
                          content,
                          details?.assignedPrinters.map((p) => p.printer) ?? [],
                        )
                      : [],
                  );
                }}
              />
            </>
          )}
          {isPrinter && (
            <>
              <h4>
                <Printer size={15} /> Padrão corporativo
              </h4>
              <p className="support-help">
                Cadastre a fila aprovada; o diagnóstico do PC poderá ser comparado com este padrão.
              </p>
              <PrintDiscoveryPanel accessKey={accessKey} initialServer={printConfig.printServer} />
              <PrinterConfigurationFields
                value={printConfig}
                onChange={(change) => setPrintConfig((current) => ({ ...current, ...change }))}
                disabled={working}
              />
              <button
                className="btn"
                disabled={working}
                onClick={() =>
                  void run(async () => {
                    const updated = await secureRequest<Device>(
                      `/devices/${encodeURIComponent(device.id)}/print-config`,
                      accessKey,
                      { method: 'PATCH', body: JSON.stringify(printConfig) },
                    );
                    onDeviceSaved(updated);
                    notifyCatalogChanged();
                    setMessage('Configuração salva.');
                  })
                }
              >
                Salvar configuração da impressora
              </button>
              {details?.assignedComputers.map((c) => (
                <div className="support-result" key={c.computerId}>
                  <MonitorUp size={14} />
                  {c.computer.name}
                </div>
              ))}
            </>
          )}
          {error && (
            <p className="support-error" role="alert">
              {error}
            </p>
          )}
          {message && (
            <p className="support-success" role="status">
              <CheckCircle2 size={15} />
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
