'use client';

import { LockKeyhole, Server, X } from 'lucide-react';
import { credentialProviders, unsupportedCredentialProviders } from '../credential-providers';
import type { ManagedCredentialProvider } from '@infra/contracts';
import styles from './credentials-page.module.css';

export function CredentialProviderDialog({
  onClose,
  onSelect,
}: {
  onClose: () => void;
  onSelect: (provider: ManagedCredentialProvider) => void;
}) {
  return (
    <div className={styles.backdrop} role="presentation" onMouseDown={onClose}>
      <section
        className={styles.providerDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="provider-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.dialogHeader}>
          <div>
            <h2 id="provider-title">Adicionar credencial</h2>
            <p>Selecione uma integração disponível.</p>
          </div>
          <button className={styles.iconButton} type="button" aria-label="Fechar" onClick={onClose}>
            <X size={17} />
          </button>
        </header>
        <div className={styles.providerList}>
          {credentialProviders.map((provider) => (
            <button
              className={styles.providerOption}
              type="button"
              key={provider.id}
              onClick={() => onSelect(provider.id)}
            >
              <span className={styles.providerIcon}>
                <Server size={18} />
              </span>
              <span>
                <strong>{provider.name}</strong>
                <small>{provider.description}</small>
              </span>
            </button>
          ))}
          <div className={styles.catalogDivider}>
            Integrações sem autenticação confirmada no projeto
          </div>
          {unsupportedCredentialProviders.map((provider) => (
            <div className={styles.providerUnavailable} key={provider.name}>
              <span className={`${styles.providerIcon} ${styles.muted}`}>
                <LockKeyhole size={17} />
              </span>
              <span>
                <strong>{provider.name}</strong>
                <small>{provider.description}</small>
              </span>
              <span className={styles.unavailableBadge}>Indisponível</span>
            </div>
          ))}
          <p className={styles.providerFootnote}>
            Não criamos campos para senhas ou protocolos que ainda não foram confirmados e
            integrados.
          </p>
        </div>
      </section>
    </div>
  );
}
