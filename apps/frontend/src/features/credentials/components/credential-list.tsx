'use client';

import { KeyRound, Pencil, Server, Trash2 } from 'lucide-react';
import type { ManagedCredentialSummary } from '@infra/contracts';
import styles from './credentials-page.module.css';

export function CredentialList({
  credentials,
  onEdit,
  onDelete,
  onCreate,
}: {
  credentials: ManagedCredentialSummary[];
  onEdit: (credential: ManagedCredentialSummary) => void;
  onDelete: (credential: ManagedCredentialSummary) => void;
  onCreate: () => void;
}) {
  if (!credentials.length)
    return (
      <section className={styles.emptyState}>
        <span className={styles.emptyIcon} aria-hidden="true">
          <KeyRound size={20} />
        </span>
        <h2>Crie sua primeira credencial</h2>
        <p>Credenciais permitem consultar integrações com uma conta técnica aprovada.</p>
        <button className={styles.compactButton} type="button" onClick={onCreate}>
          Criar credencial
        </button>
      </section>
    );

  return (
    <div className={styles.credentialList} aria-label="Credenciais salvas">
      {credentials.map((credential) => (
        <article className={styles.credentialCard} key={credential.id}>
          <span className={styles.providerIcon}>
            <Server size={17} />
          </span>
          <div className={styles.credentialText}>
            <strong>{credential.name}</strong>
            <small>
              Windows Print Server
              {credential.targetServer ? ` · ${credential.targetServer}` : ' · qualquer servidor'}
            </small>
            <span className={styles.secretStatus}>
              <KeyRound size={12} /> Conta armazenada com criptografia
            </span>
          </div>
          <div className={styles.credentialActions}>
            <button
              className={styles.iconButton}
              type="button"
              aria-label={`Editar credencial ${credential.name}`}
              onClick={() => onEdit(credential)}
            >
              <Pencil size={15} />
            </button>
            <button
              className={`${styles.iconButton} ${styles.dangerButton}`}
              type="button"
              aria-label={`Excluir credencial ${credential.name}`}
              onClick={() => onDelete(credential)}
            >
              <Trash2 size={15} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
