'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Filter, Plus, Search, UserRound, Workflow } from 'lucide-react';
import { api } from '@/lib/api';
import { OptionsMenu } from '@/components/action-menu/options-menu';
import { newWorkflowDraftPath } from '../workflow-path';
import {
  WorkspacePageLayout,
  type WorkspaceScope,
} from '@/components/layout/workspace-page-layout';
import type { WorkflowPageResult, WorkflowSummary } from '../workflow-types';
import { WorkflowCard } from './workflow-card';
import styles from './workflows-page.module.css';

type WorkflowSort = 'updated' | 'created' | 'name';
type WorkflowFilter = 'all' | 'recent';

export function WorkflowsPage({ scope = 'overview' }: { scope?: WorkspaceScope }) {
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<WorkflowSummary[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [sort, setSort] = useState<WorkflowSort>('updated');
  const [filter, setFilter] = useState<WorkflowFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const focusSearch = () => searchInputRef.current?.focus();
    window.addEventListener('infra-map:focus-workflow-search', focusSearch);

    const params = new URLSearchParams(window.location.search);
    const timers: number[] = [];
    if (params.get('focus') === 'search') timers.push(window.setTimeout(focusSearch, 0));
    if (params.has('focus'))
      window.history.replaceState(window.history.state, '', window.location.pathname);

    return () => {
      timers.forEach(window.clearTimeout);
      window.removeEventListener('infra-map:focus-workflow-search', focusSearch);
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const query = new URLSearchParams({
      page: String(page),
      pageSize: String(pageSize),
      search: debouncedSearch,
      sort,
      recentOnly: String(filter === 'recent'),
    });
    void api<WorkflowPageResult>(`/maps/paged?${query.toString()}`, {
      signal: controller.signal,
    })
      .then((result) => {
        setItems(result.items);
        setTotal(result.total);
        setTotalPages(result.totalPages);
      })
      .catch((reason) => {
        if (!controller.signal.aborted)
          setError(
            reason instanceof Error ? reason.message : 'Não foi possível carregar os workflows.',
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [debouncedSearch, filter, page, pageSize, sort]);

  function beginListUpdate(update: () => void) {
    setLoading(true);
    setError('');
    update();
  }

  function createWorkflow() {
    router.push(newWorkflowDraftPath(scope));
  }

  async function remove(workflow: WorkflowSummary) {
    if (
      !window.confirm(
        `Excluir "${workflow.name}" e o desenho associado? Os equipamentos cadastrados e o histórico de suporte serão preservados.`,
      )
    )
      return;
    setError('');
    try {
      await api<void>(`/maps/${encodeURIComponent(workflow.id)}`, { method: 'DELETE' });
      setItems((current) => current.filter((item) => item.id !== workflow.id));
      setTotal((current) => Math.max(0, current - 1));
      if (items.length === 1 && page > 1) {
        setLoading(true);
        setPage((current) => current - 1);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível excluir o workflow.');
    }
  }

  async function copyLink(workflow: WorkflowSummary) {
    try {
      await navigator.clipboard.writeText(
        new URL(`/workflow/${encodeURIComponent(workflow.id)}`, window.location.origin).toString(),
      );
      setNotice('Link copiado para a área de transferência.');
      window.setTimeout(() => setNotice(''), 2400);
    } catch {
      setError('O navegador não permitiu copiar o link deste workflow.');
    }
  }

  const createButton = (
    <button className={styles.primaryButton} type="button" onClick={createWorkflow}>
      <Plus size={14} strokeWidth={2} /> Criar workflow
    </button>
  );

  return (
    <WorkspacePageLayout scope={scope} active="workflows" headerAction={createButton}>
      {scope === 'personal' && (
        <div className={styles.personalLocation}>
          <span>
            <UserRound size={13} strokeWidth={1.8} aria-hidden="true" /> Personal
          </span>
          <OptionsMenu
            label="Opções da pasta Personal"
            items={[{ id: 'create', label: 'Criar workflow', onSelect: createWorkflow }]}
          />
        </div>
      )}
      <div className={styles.toolbar}>
        <div className={styles.listControls}>
          <label className={styles.search}>
            <Search size={14} aria-hidden="true" />
            <input
              ref={searchInputRef}
              aria-label="Pesquisar workflows"
              placeholder="Pesquisar"
              value={search}
              onChange={(event) => {
                const value = event.target.value;
                setSearch(value);
                if (value.trim() !== debouncedSearch || page !== 1)
                  beginListUpdate(() => setPage(1));
              }}
            />
          </label>
          <select
            className={styles.sortSelect}
            aria-label="Ordenar workflows"
            value={sort}
            onChange={(event) => {
              beginListUpdate(() => {
                setSort(event.target.value as WorkflowSort);
                setPage(1);
              });
            }}
          >
            <option value="updated">Ordenar por atualização</option>
            <option value="created">Ordenar por criação</option>
            <option value="name">Ordenar por nome</option>
          </select>
          <OptionsMenu
            label="Filtrar workflows"
            triggerIcon={Filter}
            items={[
              {
                id: 'all',
                label: 'Todos os workflows',
                onSelect: () => {
                  if (filter !== 'all')
                    beginListUpdate(() => {
                      setFilter('all');
                      setPage(1);
                    });
                },
              },
              {
                id: 'recent',
                label: 'Atualizados nos últimos 7 dias',
                onSelect: () => {
                  if (filter !== 'recent')
                    beginListUpdate(() => {
                      setFilter('recent');
                      setPage(1);
                    });
                },
              },
            ]}
          />
        </div>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      {loading ? (
        <p className={styles.loading} role="status">
          Carregando workflows…
        </p>
      ) : items.length ? (
        <>
          <div className={styles.list} aria-label="Lista de workflows">
            {items.map((workflow) => (
              <WorkflowCard
                key={workflow.id}
                workflow={workflow}
                onCopyLink={(item) => void copyLink(item)}
                onDelete={(item) => void remove(item)}
                onOpen={(item) => router.push(`/workflow/${encodeURIComponent(item.id)}`)}
              />
            ))}
          </div>
          <div className={styles.pagination}>
            <span>Total {total}</span>
            <button
              type="button"
              aria-label="Página anterior"
              disabled={page <= 1}
              onClick={() => beginListUpdate(() => setPage((current) => Math.max(1, current - 1)))}
            >
              ‹
            </button>
            <strong aria-current="page">{page}</strong>
            <button
              type="button"
              aria-label="Próxima página"
              disabled={page >= totalPages}
              onClick={() =>
                beginListUpdate(() => setPage((current) => Math.min(totalPages, current + 1)))
              }
            >
              ›
            </button>
            <select
              aria-label="Itens por página"
              value={pageSize}
              onChange={(event) => {
                beginListUpdate(() => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                });
              }}
            >
              {[25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size}/página
                </option>
              ))}
            </select>
          </div>
        </>
      ) : (
        <section className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden="true">
            <Workflow size={19} strokeWidth={1.7} />
          </span>
          <h2>
            {total || debouncedSearch || filter === 'recent'
              ? 'Nenhum workflow encontrado'
              : 'Crie seu primeiro workflow'}
          </h2>
          <p>
            {total || debouncedSearch || filter === 'recent'
              ? 'Ajuste a busca ou remova o filtro para encontrar seus mapas.'
              : 'Os workflows são mapas de infraestrutura. Abra um para editar setores, equipamentos e conexões.'}
          </p>
          {!total && !debouncedSearch && filter === 'all' && (
            <button className={styles.primaryButton} type="button" onClick={createWorkflow}>
              <Plus size={14} /> Criar workflow
            </button>
          )}
        </section>
      )}
    </WorkspacePageLayout>
  );
}
