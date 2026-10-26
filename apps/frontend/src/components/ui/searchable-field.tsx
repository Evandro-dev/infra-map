'use client';
import { useCallback, useEffect, useId, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import type { SearchableLoader, SearchableOption, SearchablePage } from './searchable-field.types';
import styles from './searchable-field.module.css';

interface Props<T extends SearchableOption> {
  label: string;
  value: string;
  onChange: (value: string) => void;
  loadOptions: SearchableLoader<T>;
  queryKey: string;
  onSelect?: (option: T) => void;
  disabled?: boolean;
  maxLength?: number;
  help?: string;
}
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
const pageSize = 20;

/** Busca somente a página aberta; portal mantém o menu fora do recorte das sidebars. */
export function SearchableField<T extends SearchableOption>({
  label,
  value,
  onChange,
  loadOptions,
  queryKey,
  onSelect,
  disabled,
  maxLength = 180,
  help,
}: Props<T>) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [active, setActive] = useState(-1);
  const [placement, setPlacement] = useState<CSSProperties>({});
  const search = browseAll ? '' : value;
  const scope = `${queryKey}:${search}`;
  const [pagination, setPagination] = useState({ scope: '', page: 1 });
  const page = pagination.scope === scope ? pagination.page : 1;
  const signature = `${scope}:${page}`;
  const [response, setResponse] = useState<{
    signature: string;
    data: SearchablePage<T> | null;
    error: string;
    loading: boolean;
  } | null>(null);
  const [retry, setRetry] = useState(0);
  const current = response?.signature === signature ? response : null;
  const data = current?.data;
  const loading = !current || current.loading;
  const items = data?.items ?? [];
  const manual =
    Boolean(value.trim()) &&
    !items.some((item) => normalize(item.value) === normalize(value.trim()));
  const count = items.length + (manual ? 1 : 0);
  const visibleActive = active >= 0 && active < count ? active : -1;

  const measure = useCallback(() => {
    const box = controlRef.current?.getBoundingClientRect();
    if (!box) return;
    const below = window.innerHeight - box.bottom - 10;
    const above = box.top - 10;
    const upwards = below < 240 && above > below;
    setPlacement({
      left: Math.max(6, Math.min(box.left, window.innerWidth - box.width - 6)),
      width: Math.min(box.width, window.innerWidth - 12),
      maxHeight: Math.max(100, Math.min(340, upwards ? above : below)),
      ...(upwards ? { bottom: window.innerHeight - box.top + 4 } : { top: box.bottom + 4 }),
    });
  }, []);
  const show = () => {
    measure();
    setOpen(true);
  };
  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setResponse((previous) => ({
        signature,
        data: previous?.signature === signature ? previous.data : null,
        error: '',
        loading: true,
      }));
      void loadOptions({ search, page, pageSize, signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted)
            setResponse({ signature, data: result, error: '', loading: false });
        })
        .catch((error) => {
          if (!controller.signal.aborted)
            setResponse({
              signature,
              data: null,
              error: error instanceof Error ? error.message : 'Não foi possível buscar opções.',
              loading: false,
            });
        });
    }, 180);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, disabled, signature, search, page, loadOptions, retry]);
  useEffect(() => {
    if (!open) return;
    const reposition = () => measure();
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    document.addEventListener('pointerdown', outside);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
      document.removeEventListener('pointerdown', outside);
    };
  }, [open, measure]);
  useEffect(() => {
    if (open && visibleActive >= 0)
      document
        .getElementById(`${id}-option-${visibleActive}`)
        ?.scrollIntoView({ block: 'nearest' });
  }, [id, open, visibleActive]);

  const choose = (index: number) => {
    const option = items[index];
    if (option) {
      onChange(option.value);
      onSelect?.(option);
    } else if (manual) onChange(value.trim());
    setOpen(false);
    setActive(-1);
  };
  const navigate = (next: number) => {
    setActive(-1);
    setPagination({ scope, page: next });
  };
  const menu =
    open && !disabled && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={menuRef}
            className={styles.popover}
            style={placement}
            onMouseDown={(event) => event.preventDefault()}
          >
            {loading && (
              <div className={styles.status} role="status">
                Buscando opções...
              </div>
            )}
            {current?.error && (
              <div className={`${styles.status} ${styles.error}`} role="alert">
                {current.error} Você pode digitar manualmente.{' '}
                <button type="button" onClick={() => setRetry((value) => value + 1)}>
                  Tentar novamente
                </button>
              </div>
            )}
            <ul
              id={`${id}-list`}
              role="listbox"
              aria-label={`Opções de ${label.toLowerCase()}`}
              aria-busy={loading}
              className={styles.options}
            >
              {items.map((option, index) => (
                <li
                  key={option.key ?? option.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={visibleActive === index}
                  className={`${styles.option} ${visibleActive === index ? styles.active : ''}`}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(index)}
                >
                  <span>{option.label ?? option.value}</span>
                  {option.detail && <small>{option.detail}</small>}
                </li>
              ))}
              {manual && (
                <li
                  id={`${id}-option-${items.length}`}
                  role="option"
                  aria-selected={visibleActive === items.length}
                  className={`${styles.option} ${visibleActive === items.length ? styles.active : ''}`}
                  onMouseEnter={() => setActive(items.length)}
                  onClick={() => choose(items.length)}
                >
                  Usar “{value.trim()}” como valor manual
                </li>
              )}
            </ul>
            {!loading && !current?.error && !count && (
              <div className={styles.status}>Nenhuma opção cadastrada. Digite um valor manual.</div>
            )}
            {data && data.total > 0 && (
              <div className={styles.pagination} aria-label={`Paginação de ${label.toLowerCase()}`}>
                <button
                  type="button"
                  aria-label={`Página anterior de ${label.toLowerCase()}`}
                  disabled={loading || page <= 1}
                  onClick={() => navigate(page - 1)}
                >
                  Anterior
                </button>
                <span>
                  Página {page} de {Math.max(1, data.totalPages)} · {data.total} opções
                </span>
                <button
                  type="button"
                  aria-label={`Próxima página de ${label.toLowerCase()}`}
                  disabled={loading || !data.hasNext}
                  onClick={() => navigate(page + 1)}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;
  return (
    <div
      ref={rootRef}
      className={styles.field}
      onBlur={(event) => {
        if (
          !event.currentTarget.contains(event.relatedTarget) &&
          !menuRef.current?.contains(event.relatedTarget)
        )
          setOpen(false);
      }}
    >
      <label className="muted" htmlFor={id}>
        {label}
      </label>
      <div ref={controlRef} className={styles.control}>
        <input
          id={id}
          ref={inputRef}
          className={`field ${styles.input}`}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !disabled}
          aria-controls={open ? `${id}-list` : undefined}
          aria-activedescendant={
            open && visibleActive >= 0 ? `${id}-option-${visibleActive}` : undefined
          }
          aria-describedby={help ? `${id}-help` : undefined}
          autoComplete="off"
          value={value}
          disabled={disabled}
          maxLength={maxLength}
          placeholder="Pesquisar, selecionar ou digitar..."
          onFocus={show}
          onChange={(event) => {
            onChange(event.target.value);
            setBrowseAll(false);
            show();
            setActive(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              if (!open) {
                setBrowseAll(true);
                show();
              }
              if (count)
                setActive((previous) =>
                  Math.max(0, Math.min(count - 1, previous + (event.key === 'ArrowDown' ? 1 : -1))),
                );
            } else if (event.key === 'Enter' && open) {
              event.preventDefault();
              if (visibleActive >= 0) choose(visibleActive);
              else setOpen(false);
            } else if (event.key === 'Escape' || event.key === 'Tab') {
              setOpen(false);
              setActive(-1);
            }
          }}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-label={`Mostrar opções de ${label.toLowerCase()}`}
          aria-expanded={open && !disabled}
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            const wasOpen = open;
            inputRef.current?.focus();
            setBrowseAll(true);
            setActive(-1);
            if (wasOpen) setOpen(false);
            else show();
          }}
        >
          <ChevronDown size={14} />
        </button>
      </div>
      {help && (
        <small id={`${id}-help`} className="support-help">
          {help}
        </small>
      )}
      {menu}
    </div>
  );
}
