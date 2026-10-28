'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LockKeyhole, Plus } from 'lucide-react';
import type { ManagedCredentialProvider, ManagedCredentialSummary } from '@infra/contracts';
import { api } from '@/lib/api';
import {
  WorkspacePageLayout,
  type WorkspaceScope,
} from '@/components/layout/workspace-page-layout';
import { CredentialProviderDialog } from './credential-provider-dialog';
import { CredentialFormDialog } from './credential-form-dialog';
import { CredentialList } from './credential-list';
import styles from './credentials-page.module.css';

export function CredentialsPage({ scope = 'overview' }: { scope?: WorkspaceScope }) {
  const accessInputRef = useRef<HTMLInputElement>(null);
  const [accessKey, setAccessKey] = useState('');
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(false);
  const [createAfterUnlock, setCreateAfterUnlock] = useState(false);
  const [credentials, setCredentials] = useState<ManagedCredentialSummary[]>([]);
  const [providerDialog, setProviderDialog] = useState(false);
  const [formProvider, setFormProvider] = useState<ManagedCredentialProvider | null>(null);
  const [editing, setEditing] = useState<ManagedCredentialSummary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    function requestCredentialCreation() {
      if (authorized) {
        setProviderDialog(true);
        return;
      }
      setCreateAfterUnlock(true);
      accessInputRef.current?.focus();
    }

    window.addEventListener('infra-map:create-credential', requestCredentialCreation);
    const params = new URLSearchParams(window.location.search);
    let timer: number | undefined;
    if (params.get('create') === '1') {
      window.history.replaceState(window.history.state, '', window.location.pathname);
      timer = window.setTimeout(requestCredentialCreation, 0);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      window.removeEventListener('infra-map:create-credential', requestCredentialCreation);
    };
  }, [authorized]);

  async function refresh() {
    const result = await api<{ credentials: ManagedCredentialSummary[] }>('/credentials', {
      headers: { 'x-support-token': accessKey },
      cache: 'no-store',
    });
    setCredentials(result.credentials);
    setAuthorized(true);
  }

  async function unlock(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessKey || checking) return;
    setChecking(true);
    setError('');
    try {
      await refresh();
      if (createAfterUnlock) {
        setCreateAfterUnlock(false);
        setProviderDialog(true);
      }
    } catch (reason) {
      setAuthorized(false);
      setError(reason instanceof Error ? reason.message : 'A chave do operador não foi aceita.');
    } finally {
      setChecking(false);
    }
  }

  async function remove(credential: ManagedCredentialSummary) {
    if (
      !window.confirm(`Excluir a credencial "${credential.name}"? Esta ação não pode ser desfeita.`)
    )
      return;
    setError('');
    try {
      await api(`/credentials/${encodeURIComponent(credential.id)}`, {
        method: 'DELETE',
        headers: { 'x-support-token': accessKey },
      });
      setCredentials((current) => current.filter((item) => item.id !== credential.id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir a credencial.');
    }
  }

  function lock() {
    setAccessKey('');
    setAuthorized(false);
    setCredentials([]);
    setError('');
  }

  const headerAction = authorized ? (
    <button className={styles.compactButton} type="button" onClick={() => setProviderDialog(true)}>
      <Plus size={14} strokeWidth={2} /> Criar credencial
    </button>
  ) : (
    <button
      className={styles.compactButton}
      type="button"
      onClick={() => accessInputRef.current?.focus()}
    >
      Acessar credenciais
    </button>
  );

  return (
    <WorkspacePageLayout scope={scope} active="credentials" headerAction={headerAction}>
      {authorized ? (
        <>
          <div className={styles.vaultStatus}>
            <span>O cofre fica desbloqueado somente nesta sessão.</span>
            <button className={styles.secondaryButton} type="button" onClick={lock}>
              <LockKeyhole size={13} /> Bloquear cofre
            </button>
          </div>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <CredentialList
            credentials={credentials}
            onEdit={(credential) => {
              setEditing(credential);
              setFormProvider(credential.provider);
            }}
            onDelete={(credential) => void remove(credential)}
            onCreate={() => setProviderDialog(true)}
          />
        </>
      ) : (
        <section className={styles.keyGate}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <LockKeyhole size={24} strokeWidth={1.6} />
          </span>
          <div className={styles.gateHeading}>
            <h2>Cofre de credenciais protegido</h2>
            <p>
              O acesso exige <code>SUPPORT_OPERATOR_TOKEN</code> de <code>apps/backend/.env</code>.{' '}
              <code>CREDENTIALS_ENCRYPTION_KEY</code> apenas cifra os dados e não serve para acessar
              o cofre.
            </p>
            <p>A chave de suporte permanece somente na memória desta página.</p>
          </div>
          <form onSubmit={(event) => void unlock(event)}>
            <label className={styles.field}>
              <span>Chave de suporte</span>
              <input
                ref={accessInputRef}
                required
                type="password"
                autoComplete="off"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
              />
            </label>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={!accessKey || checking}
            >
              {checking ? 'Verificando…' : 'Acessar credenciais'}
            </button>
          </form>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
        </section>
      )}
      {providerDialog && (
        <CredentialProviderDialog
          onClose={() => setProviderDialog(false)}
          onSelect={(provider) => {
            setProviderDialog(false);
            setEditing(null);
            setFormProvider(provider);
          }}
        />
      )}
      {formProvider && (
        <CredentialFormDialog
          key={`${formProvider}:${editing?.id ?? 'new'}`}
          accessKey={accessKey}
          provider={formProvider}
          current={editing ?? undefined}
          onClose={() => {
            setFormProvider(null);
            setEditing(null);
          }}
          onSaved={() => {
            setFormProvider(null);
            setEditing(null);
            void refresh().catch((reason: unknown) =>
              setError(
                reason instanceof Error
                  ? reason.message
                  : 'Credencial salva, mas a lista não atualizou.',
              ),
            );
          }}
        />
      )}
    </WorkspacePageLayout>
  );
}
