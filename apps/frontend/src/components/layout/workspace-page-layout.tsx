'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { Route } from 'next';
import { api } from '@/lib/api';
import { LeftSidebar } from './left-sidebar';
import { SidebarResizer } from './sidebar-resizer';
import { useSidebarLayout } from './use-sidebar-layout';
import styles from './workspace-page-layout.module.css';

export type WorkspaceTab = 'workflows' | 'credentials';
export type WorkspaceScope = 'overview' | 'personal';

type WorkspaceSummary = {
  workflows: number;
  devices: number;
  computers: number;
  printers: number;
  connections: number;
};

const summaryItems: { key: keyof WorkspaceSummary; label: string }[] = [
  { key: 'workflows', label: 'Workflows' },
  { key: 'devices', label: 'Dispositivos' },
  { key: 'computers', label: 'Computadores' },
  { key: 'printers', label: 'Impressoras' },
  { key: 'connections', label: 'Conexões' },
];

const tabLabels: Record<WorkspaceTab, string> = {
  workflows: 'Workflows',
  credentials: 'Credentials',
};

export function WorkspacePageLayout({
  scope = 'overview',
  active,
  headerAction,
  children,
}: {
  scope?: WorkspaceScope;
  active: WorkspaceTab;
  headerAction?: ReactNode;
  children: ReactNode;
}) {
  const [summary, setSummary] = useState<WorkspaceSummary | null>(null);
  const { sidebarWidth, sidebarCollapsed, resizeSidebar, toggleSidebar } = useSidebarLayout();
  const title = scope === 'overview' ? 'Overview' : 'Personal';
  const description =
    scope === 'overview'
      ? 'Todos os workflows, credenciais e mapas disponíveis neste workspace.'
      : 'Workflows, credenciais e mapas organizados no espaço pessoal.';

  useEffect(() => {
    const controller = new AbortController();
    void api<WorkspaceSummary>('/maps/summary', { signal: controller.signal })
      .then(setSummary)
      .catch(() => {
        if (!controller.signal.aborted) setSummary(null);
      });
    return () => controller.abort();
  }, []);

  function tabHref(tab: WorkspaceTab): Route {
    if (scope === 'personal')
      return (tab === 'workflows' ? '/personal' : '/personal/credentials') as Route;
    return (tab === 'workflows' ? '/workflows' : '/credentials') as Route;
  }

  return (
    <div
      className={`app workspace-app ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
      style={
        {
          '--infra-sidebar-width': `${sidebarCollapsed ? 49 : sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      <LeftSidebar active={scope} collapsed={sidebarCollapsed} onToggleCollapsed={toggleSidebar} />
      {!sidebarCollapsed && (
        <SidebarResizer sidebarWidth={sidebarWidth} resizeSidebar={resizeSidebar} />
      )}
      <main className="workspace" aria-label="Área de trabalho">
        <div className={styles.content}>
          <header className={styles.header}>
            <div>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {headerAction && <div className={styles.headerAction}>{headerAction}</div>}
          </header>

          <section className={styles.summary} aria-label="Resumo da infraestrutura">
            {summaryItems.map(({ key, label }) => (
              <div className={styles.summaryItem} key={key}>
                <span>{label}</span>
                <strong>{summary ? summary[key].toLocaleString('pt-BR') : '—'}</strong>
              </div>
            ))}
          </section>

          <nav className={styles.tabs} aria-label="Seções do workspace">
            {(Object.keys(tabLabels) as WorkspaceTab[]).map((tab) => (
              <Link
                className={`${styles.tab} ${active === tab ? styles.activeTab : ''}`}
                href={tabHref(tab)}
                key={tab}
                aria-current={active === tab ? 'page' : undefined}
              >
                {tabLabels[tab]}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}
