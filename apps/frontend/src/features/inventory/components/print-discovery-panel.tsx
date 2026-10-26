'use client';
import { useEffect, useState } from 'react';
import { printServerSchema, type PrintDiscoveryResult } from '@infra/contracts';
import { api } from '@/lib/api';
import { CatalogField } from './catalog-field';
import { useInventoryCatalog } from '../use-inventory-catalog';
import { catalogSourceLabels } from '../catalog-options';
import { notifyCatalogChanged } from '../catalog-events';

export function PrintDiscoveryPanel({
  accessKey,
  initialServer,
}: {
  accessKey: string;
  initialServer?: string | null;
}) {
  const [serverDraft, setServerDraft] = useState<string | null>(null);
  const { catalog } = useInventoryCatalog('PRINTER', serverDraft ?? initialServer ?? '');
  const [useCredentials, setUseCredentials] = useState(false);
  const [windowsUsername, setWindowsUsername] = useState('');
  const [windowsPassword, setWindowsPassword] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const referenceServer = catalog?.defaultServer ?? '';
  const server = serverDraft ?? (initialServer || referenceServer);
  useEffect(() => {
    const controller = new AbortController();
    void api<{ available: boolean }>('/inventory/print-discovery/capabilities', {
      headers: { 'x-support-token': accessKey },
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) setAvailable(result.available);
      })
      .catch(() => {
        if (!controller.signal.aborted) setAvailable(false);
      });
    return () => controller.abort();
  }, [accessKey]);
  async function collect() {
    const parsed = printServerSchema.safeParse(server);
    if (!parsed.success) {
      setWindowsPassword('');
      setError(parsed.error.issues[0].message);
      return;
    }
    if (useCredentials && (!windowsUsername.trim() || !windowsPassword)) {
      setWindowsPassword('');
      setError('Informe usuário e senha Windows para esta consulta.');
      return;
    }
    setWorking(true);
    setError('');
    setMessage('');
    try {
      const snapshot = await api<PrintDiscoveryResult>('/inventory/print-discovery', {
        method: 'POST',
        headers: { 'x-support-token': accessKey },
        body: JSON.stringify({
          server: parsed.data,
          ...(useCredentials
            ? { credentials: { username: windowsUsername.trim(), password: windowsPassword } }
            : {}),
        }),
      });
      notifyCatalogChanged();
      setMessage(
        `${snapshot.queueCount} filas, ${snapshot.driverCount} drivers e ${snapshot.portCount} portas coletados. As opções já estão disponíveis nos campos de cadastro.`,
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Falha na coleta.');
    } finally {
      setWindowsPassword('');
      setWorking(false);
    }
  }
  return (
    <details className="print-discovery" open>
      <summary>Descobrir filas, drivers e portas</summary>
      <p className="support-help">
        Consulta somente o servidor escolhido, usando as permissões do Windows deste computador. Não
        instala nem altera impressoras. O cadastro manual continua disponível.
      </p>
      <CatalogField
        field="printServer"
        kind="PRINTER"
        label="Servidor para consulta"
        value={server}
        onChange={(value) => {
          setServerDraft(value);
          setWindowsPassword('');
        }}
        disabled={working}
      />
      <label className="support-help">
        <input
          type="checkbox"
          checked={useCredentials}
          disabled={working}
          onChange={(event) => {
            setUseCredentials(event.target.checked);
            setWindowsPassword('');
          }}
        />{' '}
        Usar outra conta Windows somente nesta consulta
      </label>
      {useCredentials && (
        <div className="field-stack">
          <label className="form-row">
            <span className="muted">Usuário Windows para consulta</span>
            <input
              className="field"
              value={windowsUsername}
              disabled={working}
              maxLength={180}
              autoComplete="off"
              onChange={(event) => {
                setWindowsUsername(event.target.value);
                setWindowsPassword('');
              }}
              placeholder="DOMINIO\usuario ou usuario@dominio"
            />
          </label>
          <label className="form-row">
            <span className="muted">Senha Windows temporária</span>
            <input
              className="field"
              type="password"
              value={windowsPassword}
              disabled={working}
              maxLength={512}
              autoComplete="off"
              onChange={(event) => setWindowsPassword(event.target.value)}
            />
          </label>
          <p className="support-help">
            A senha é descartada após a tentativa. Não é salva no cadastro e não substitui a senha
            de acesso do ISL.
          </p>
        </div>
      )}
      <button
        className="btn"
        disabled={working || !available || !server.trim()}
        onClick={() => void collect()}
      >
        {working ? 'Consultando servidor...' : 'Consultar servidor de impressão'}
      </button>
      {available === false && (
        <p className="support-help">
          Consulta direta indisponível. É necessário Windows com gerenciamento de impressão e acesso
          ao servidor.
        </p>
      )}
      {catalog?.snapshots
        .filter((snapshot) => snapshot.server.toLowerCase() === server.trim().toLowerCase())
        .map((snapshot) => (
          <div className="support-note" key={`${snapshot.source}:${snapshot.server}`}>
            <strong>{catalogSourceLabels[snapshot.source]}</strong> · {snapshot.queueCount} filas
            <br />
            {snapshot.source === 'REFERENCE' && snapshot.referenceDate
              ? `Documento de ${snapshot.referenceDate.split('-').reverse().join('/')}`
              : `Coleta: ${new Date(snapshot.collectedAt).toLocaleString('pt-BR')}`}
            {snapshot.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        ))}
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="support-success" role="status">
          {message}
        </p>
      )}
    </details>
  );
}
