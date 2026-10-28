'use client';

import Link from 'next/link';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { House, PanelLeftClose, PanelLeftOpen, Plus, Search, UserRound } from 'lucide-react';
import { OptionsMenu } from '@/components/action-menu/options-menu';
import { IconTip } from '@/components/ui-tooltip';
import { newWorkflowDraftPath } from '@/features/workflows/workflow-path';

export function LeftSidebar({
  active,
  collapsed,
  onToggleCollapsed,
}: {
  active: 'overview' | 'personal';
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const workflowPath = active === 'personal' ? '/personal' : '/workflows';
  const credentialsPath = active === 'personal' ? '/personal/credentials' : '/credentials';

  function openCreateCredential() {
    if (pathname === credentialsPath) {
      window.dispatchEvent(new Event('infra-map:create-credential'));
      return;
    }
    router.push(`${credentialsPath}?create=1` as Route);
  }

  function openWorkflowSearch() {
    if (pathname === workflowPath) {
      window.dispatchEvent(new Event('infra-map:focus-workflow-search'));
      return;
    }
    router.push(`${workflowPath}?focus=search` as Route);
  }

  const createItems = [
    {
      id: 'workflow',
      label: 'Novo workflow',
      onSelect: () => router.push(newWorkflowDraftPath(active)),
    },
    {
      id: 'credential',
      label: 'Nova credencial',
      onSelect: openCreateCredential,
    },
  ];

  return (
    <aside className="sidebar workspace-sidebar" aria-label="Navegação principal">
      <div className="workspace-sidebar-header">
        <div className="workspace-sidebar-brand-row">
          <Link className="workspace-sidebar-brand" href={workflowPath as Route}>
            <OrionLogo />
            <span>Infra Map</span>
          </Link>
          {collapsed ? (
            <IconTip
              label="Expandir navegação"
              side="right"
              className="workspace-sidebar-toggle-tip"
            >
              <button
                className="workspace-sidebar-toggle workspace-sidebar-toggle-overlay"
                type="button"
                aria-label="Expandir sidebar"
                onClick={onToggleCollapsed}
              >
                <PanelLeftOpen size={16} strokeWidth={1.8} />
              </button>
            </IconTip>
          ) : (
            <div className="workspace-sidebar-actions">
              <IconTip label="Criar">
                <OptionsMenu label="Criar" items={createItems} triggerIcon={Plus} />
              </IconTip>
              <IconTip label="Pesquisar workflows">
                <button
                  className="workspace-sidebar-toggle workspace-sidebar-search"
                  type="button"
                  aria-label="Pesquisar workflows"
                  onClick={openWorkflowSearch}
                >
                  <Search size={15} strokeWidth={1.8} />
                </button>
              </IconTip>
              <IconTip label="Recolher navegação">
                <button
                  className="workspace-sidebar-toggle"
                  type="button"
                  aria-label="Recolher sidebar"
                  onClick={onToggleCollapsed}
                >
                  <PanelLeftClose size={16} strokeWidth={1.8} />
                </button>
              </IconTip>
            </div>
          )}
        </div>
        {collapsed && (
          <div className="workspace-sidebar-collapsed-create">
            <IconTip label="Criar" side="right">
              <OptionsMenu label="Criar" items={createItems} placement="right" triggerIcon={Plus} />
            </IconTip>
            <IconTip label="Pesquisar workflows" side="right">
              <button
                className="workspace-sidebar-toggle workspace-sidebar-search"
                type="button"
                aria-label="Pesquisar workflows"
                onClick={openWorkflowSearch}
              >
                <Search size={15} strokeWidth={1.8} />
              </button>
            </IconTip>
          </div>
        )}
      </div>

      <nav className="workspace-sidebar-nav" aria-label="Overview e Personal">
        {collapsed ? (
          <IconTip label="Overview" side="right" className="workspace-sidebar-nav-tip">
            <Link
              className={`workspace-sidebar-link ${active === 'overview' ? 'is-active' : ''}`}
              href={'/workflows' as Route}
              aria-current={active === 'overview' ? 'page' : undefined}
            >
              <House size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Overview</span>
            </Link>
          </IconTip>
        ) : (
          <Link
            className={`workspace-sidebar-link ${active === 'overview' ? 'is-active' : ''}`}
            href={'/workflows' as Route}
            aria-current={active === 'overview' ? 'page' : undefined}
          >
            <House size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Overview</span>
          </Link>
        )}
        {collapsed ? (
          <IconTip label="Personal" side="right" className="workspace-sidebar-nav-tip">
            <Link
              className={`workspace-sidebar-link ${active === 'personal' ? 'is-active' : ''}`}
              href={'/personal' as Route}
              aria-current={active === 'personal' ? 'page' : undefined}
            >
              <UserRound size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Personal</span>
            </Link>
          </IconTip>
        ) : (
          <Link
            className={`workspace-sidebar-link ${active === 'personal' ? 'is-active' : ''}`}
            href={'/personal' as Route}
            aria-current={active === 'personal' ? 'page' : undefined}
          >
            <UserRound size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>Personal</span>
          </Link>
        )}
      </nav>
    </aside>
  );
}

function OrionLogo() {
  return (
    <svg
      className="workspace-sidebar-logo"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 223.5 207"
      role="img"
      aria-label="Logo Orion"
    >
      <g>
        <g>
          <path
            d="M81.19 129.76l57.22-36.04 27.81 16.88v4.43c0 3.57-1.9 6.87-5 8.66l-46.87 27.08c-1.6.92-3.58.89-5.15-.09l-28.01-17.51c-1.25-.78-1.26-2.61 0-3.4Z"
            fill="var(--orion-red-orange, #df563c)"
            stroke="var(--orion-dark-orange, #b94132)"
            strokeWidth=".25"
          />
          <path
            d="M138.41 93.72v42.98c0 .08.08.12.15.08l22.62-13.07c3.12-1.8 5.04-5.13 5.04-8.73v-4.38l-27.81-16.88Z"
            fill="var(--orion-dark-orange, #b94132)"
          />
        </g>
        <path
          d="M67.2 66.63v55.94c0 3.9 4.27 6.29 7.6 4.26l24.23-14.77c1.49-.91 2.39-2.52 2.39-4.26V82.69c0-1.68-.84-3.24-2.24-4.16L74.95 62.48c-3.32-2.2-7.75.18-7.75 4.16Z"
          fill="#fff"
          stroke="#d5d5da"
          strokeWidth=".25"
        />
        <path
          d="M81.24 55.61l27.93-17.46c1.58-.99 3.59-1.01 5.2-.06l46.99 27.84c3.01 1.78 4.86 5.02 4.86 8.52v36.16L81.27 59.02c-1.28-.77-1.29-2.62-.02-3.41Z"
          fill="var(--orion-orange, #f18458)"
          stroke="var(--orion-red-orange, #df563c)"
          strokeWidth=".25"
        />
      </g>
    </svg>
  );
}
