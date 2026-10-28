'use client';

import { useState, type FormEvent } from 'react';
import { Eye, EyeOff, X } from 'lucide-react';
import type {
  CreateWindowsPrintCredential,
  ManagedCredentialProvider,
  ManagedCredentialSummary,
  UpdateManagedCredential,
} from '@infra/contracts';
import { api } from '@/lib/api';
import { credentialProviders } from '../credential-providers';
import styles from './credentials-page.module.css';

export function CredentialFormDialog({
  accessKey,
  provider,
  current,
  onClose,
  onSaved,
}: {
  accessKey: string;
  provider: ManagedCredentialProvider;
  current?: ManagedCredentialSummary;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(current?.name ?? '');
  const [targetServer, setTargetServer] = useState(current?.targetServer ?? '');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [replaceAccount, setReplaceAccount] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const definition = credentialProviders.find((item) => item.id === provider);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!definition || saving) return;
    setSaving(true);
    setError('');
    try {
      if (current) {
        const update: UpdateManagedCredential = {
          name: name.trim(),
          targetServer: targetServer.trim(),
          replaceAccount,
          username: replaceAccount ? username.trim() : '',
          password: replaceAccount ? password : '',
        };
        await api(`/credentials/${encodeURIComponent(current.id)}`, {
          method: 'PATCH',
          headers: { 'x-support-token': accessKey },
          body: JSON.stringify(update),
        });
      } else {
        const create: CreateWindowsPrintCredential = {
          provider,
          name: name.trim(),
          targetServer: targetServer.trim(),
          username: username.trim(),
          password,
        };
        await api('/credentials', {
          method: 'POST',
          headers: { 'x-support-token': accessKey },
          body: JSON.stringify(create),
        });
      }
      setUsername('');
      setPassword('');
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível salvar a credencial.');
      setSaving(false);
    }
  }

  if (!definition) return null;

  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={() => !saving && onClose()}>
      <section
        className={styles.formDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="credential-form-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <div className={styles.formIdentity}>
            <span className={styles.providerIcon}>
              <definition.icon size={19} />
            </span>
            <span>
              <h2 id="credential-form-title">{current ? 'Editar credencial' : definition.name}</h2>
              <small>{definition.category} · segredo criptografado localmente</small>
            </span>
          </div>
          <button
            className={styles.iconButton}
            type="button"
            aria-label="Fechar"
            disabled={saving}
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>
        <form className={styles.formBody} onSubmit={(event) => void save(event)}>
          <label className={styles.field}>
            <span>Nome da credencial</span>
            <input
              autoFocus
              required
              disabled={saving}
              maxLength={120}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Conta de consulta do servidor"
            />
          </label>
          <label className={styles.field}>
            <span>{definition.fields[0].label}</span>
            <input
              maxLength={180}
              disabled={saving}
              value={targetServer}
              onChange={(event) => setTargetServer(event.target.value)}
              placeholder="Ex.: SRV-SKY-PRT-01"
            />
            <small>O formato UNC (\\servidor) é aceito e normalizado para o nome do host.</small>
            <small>Deixe vazio para permitir o uso em qualquer servidor de impressão.</small>
            <small>
              Esta credencial serve para consultar filas no painel Suporte de uma impressora. Ela
              não é vinculada ao workflow nem concede administração remota aos computadores; essas
              ações dependem das permissões do provedor de suporte.
            </small>
          </label>
          {!current || replaceAccount ? (
            <>
              <label className={styles.field}>
                <span>{definition.fields[1].label}</span>
                <input
                  required
                  disabled={saving}
                  maxLength={180}
                  autoComplete="off"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="DOMINIO\usuario ou usuario@dominio"
                />
              </label>
              <label className={styles.field}>
                <span>{definition.fields[2].label}</span>
                <span className={styles.passwordWrap}>
                  <input
                    required
                    disabled={saving}
                    maxLength={512}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    className={styles.passwordToggle}
                    type="button"
                    disabled={saving}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </span>
              </label>
            </>
          ) : (
            <label className={styles.replaceAccount}>
              <input
                type="checkbox"
                disabled={saving}
                checked={replaceAccount}
                onChange={(event) => setReplaceAccount(event.target.checked)}
              />
              <span>Trocar usuário e senha armazenados</span>
            </label>
          )}
          <p className={styles.securityNote}>
            Esta conta serve somente para consultar filas, drivers e portas do servidor de
            impressão. Ela não habilita ações administrativas nos computadores nem preenche prompts
            do Windows ou do ISL. A senha fica criptografada no banco local, não é devolvida pela
            API e a chave de criptografia deve permanecer no backend.
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <footer className={styles.dialogActions}>
            <button
              className={styles.secondaryButton}
              type="button"
              disabled={saving}
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={saving || !name.trim()}
            >
              {saving ? 'Salvando…' : 'Salvar credencial'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  );
}
