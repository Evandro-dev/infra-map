'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  samePrintServer,
  printServerSchema,
  type ManagedCredentialSummary,
  type PrintDiscoveryResult,
} from '@infra/contracts';
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
  const [credentialMode, setCredentialMode] = useState<'current' | 'temporary' | 'saved'>(
    'current',
  );
  const [windowsUsername, setWindowsUsername] = useState('');
  const [windowsPassword, setWindowsPassword] = useState('');
  const [savedCredentials, setSavedCredentials] = useState<ManagedCredentialSummary[]>([]);
  const [savedCredentialId, setSavedCredentialId] = useState('');
  const [credentialLoadError, setCredentialLoadError] = useState('');
  const [available, setAvailable] = useState<boolean | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const referenceServer = catalog?.defaultServer ?? '';
  const server = serverDraft ?? (initialServer || referenceServer);
  const matchingCredentials = useMemo(
    () =>
      savedCredentials.filter(
        (credential) =>
          !credential.targetServer || samePrintServer(credential.targetServer, server),
      ),
    [savedCredentials, server],
  );
  const selectedSavedCredentialId = matchingCredentials.some(
    (credential) => credential.id === savedCredentialId,
  )
    ? savedCredentialId
    : (matchingCredentials[0]?.id ?? '');
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
  useEffect(() => {
    const controller = new AbortController();
    void api<{ credentials: ManagedCredentialSummary[] }>('/credentials', {
      headers: { 'x-support-token': accessKey },
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted) {
          setSavedCredentials(result.credentials);
          setCredentialLoadError('');
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setCredentialLoadError(reason instanceof Error ? reason.message : 'Cofre indisponível.');
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
    if (credentialMode === 'temporary' && (!windowsUsername.trim() || !windowsPassword)) {
      setWindowsPassword('');
      setError('Informe usuário e senha Windows para esta consulta.');
      return;
    }
    if (
      credentialMode === 'saved' &&
      !matchingCredentials.some((item) => item.id === selectedSavedCredentialId)
    ) {
      setError('Selecione uma credencial salva compatível com este servidor.');
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
          ...(credentialMode === 'temporary'
            ? { credentials: { username: windowsUsername.trim(), password: windowsPassword } }
            : credentialMode === 'saved'
              ? { credentialId: selectedSavedCredentialId }
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
      <fieldset className="print-discovery-auth" disabled={working}>
        <legend>Conta Windows para a consulta</legend>
        <label className="support-help">
          <input
            type="radio"
            name="print-discovery-auth"
            checked={credentialMode === 'current'}
            onChange={() => {
              setCredentialMode('current');
              setWindowsPassword('');
            }}
          />{' '}
          Conta que executa o Infra Map
        </label>
        <label className="support-help">
          <input
            type="radio"
            name="print-discovery-auth"
            checked={credentialMode === 'temporary'}
            onChange={() => {
              setCredentialMode('temporary');
              setWindowsPassword('');
            }}
          />{' '}
          Outra conta somente nesta consulta
        </label>
        <label className="support-help">
          <input
            type="radio"
            name="print-discovery-auth"
            checked={credentialMode === 'saved'}
            onChange={() => {
              setCredentialMode('saved');
              setWindowsPassword('');
              setSavedCredentialId(matchingCredentials[0]?.id ?? '');
            }}
          />{' '}
          Usar credencial salva no cofre
        </label>
      </fieldset>
      {credentialMode === 'temporary' && (
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
      {credentialMode === 'saved' && (
        <div className="field-stack">
          {matchingCredentials.length ? (
            <label className="form-row">
              <span className="muted">Credencial</span>
              <select
                className="field"
                value={selectedSavedCredentialId}
                disabled={working}
                onChange={(event) => setSavedCredentialId(event.target.value)}
              >
                {matchingCredentials.map((credential) => (
                  <option key={credential.id} value={credential.id}>
                    {credential.name}
                    {credential.targetServer ? ` · ${credential.targetServer}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="support-help">
              {credentialLoadError || 'Nenhuma credencial salva está associada a este servidor.'}{' '}
              <Link href="/credentials">Gerenciar credenciais</Link>
            </p>
          )}
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
        .filter((snapshot) => samePrintServer(snapshot.server, server))
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
