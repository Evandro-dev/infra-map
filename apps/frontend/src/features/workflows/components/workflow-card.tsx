'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { UserRound } from 'lucide-react';
import { OptionsMenu } from '@/components/action-menu/options-menu';
import type { WorkflowSummary } from '../workflow-types';
import styles from './workflows-page.module.css';

export function WorkflowCard({
  workflow,
  onOpen,
  onCopyLink,
  onDelete,
}: {
  workflow: WorkflowSummary;
  onOpen: (workflow: WorkflowSummary) => void;
  onCopyLink: (workflow: WorkflowSummary) => void;
  onDelete: (workflow: WorkflowSummary) => void;
}) {
  const editorPath = `/workflow/${encodeURIComponent(workflow.id)}` as Route;
  const created = new Date(workflow.createdAt);
  const updated = new Date(workflow.updatedAt);
  const updatedLabel = Number.isNaN(updated.getTime())
    ? 'data indisponível'
    : updated.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  const createdLabel = Number.isNaN(created.getTime())
    ? 'data indisponível'
    : created.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' });

  return (
    <article className={styles.card}>
      <Link className={styles.cardOpen} href={editorPath}>
        <span className={styles.cardText}>
          <strong>{workflow.name}</strong>
          <small>
            Atualizado {updatedLabel} <span aria-hidden="true">|</span> Criado {createdLabel}
          </small>
        </span>
      </Link>
      <span className={styles.ownerBadge}>
        <UserRound size={12} strokeWidth={1.7} aria-hidden="true" /> Personal
      </span>
      <OptionsMenu
        label={`Opções do workflow ${workflow.name}`}
        items={[
          { id: 'open', label: 'Abrir', onSelect: () => onOpen(workflow) },
          { id: 'copy-link', label: 'Copiar link', onSelect: () => onCopyLink(workflow) },
          {
            id: 'delete',
            label: 'Excluir',
            onSelect: () => onDelete(workflow),
            danger: true,
            separatorBefore: true,
          },
        ]}
      />
    </article>
  );
}
