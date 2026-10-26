'use client';
import type { RefObject } from 'react';
import { LockKeyhole, LockKeyholeOpen, Trash2, Ellipsis } from 'lucide-react';
import { type ContextMenuActionId, type ContextMenuAction } from './context-actions';
interface Props {
  actionTarget: string | null;
  targetIsTerritory: boolean;
  actionLocked: boolean;
  menuTarget: string | null;
  toolbarX: number;
  toolbarY: number;
  viewport: { width: number; height: number };
  actionRef: RefObject<HTMLDivElement | null>;
  onEnter: () => void;
  onLeave: () => void;
  onToggleMenu: () => void;
  onLock: () => void;
  onDelete: () => void;
  onAction: (id: ContextMenuActionId) => void;
  menuEntries: ContextMenuAction[];
}
export function ContextToolbar({
  actionTarget,
  targetIsTerritory,
  actionLocked,
  menuTarget,
  toolbarX,
  toolbarY,
  viewport,
  actionRef,
  onEnter,
  onLeave,
  onToggleMenu,
  onLock,
  onDelete,
  onAction,
  menuEntries,
}: Props) {
  const lockTarget = onLock,
    deleteTarget = onDelete,
    runMenuAction = onAction;
  return (
    <>
      {' '}
      {actionTarget && (
        <div
          ref={actionRef}
          className="context-toolbar-anchor"
          style={{ left: toolbarX, top: toolbarY }}
          onPointerEnter={onEnter}
          onPointerLeave={onLeave}
        >
          <div
            className="context-toolbar"
            role="toolbar"
            aria-label={targetIsTerritory ? 'Ações do território' : 'Ações do elemento'}
          >
            <ContextButton
              label={actionLocked ? 'Desbloquear' : 'Bloquear'}
              shortcut={targetIsTerritory ? undefined : 'L'}
              onClick={lockTarget}
            >
              {actionLocked ? (
                <LockKeyholeOpen size={18} strokeWidth={1.8} fill="none" />
              ) : (
                <LockKeyhole size={18} strokeWidth={1.8} fill="none" />
              )}
            </ContextButton>
            <ContextButton
              label={targetIsTerritory ? 'Excluir território' : 'Excluir elemento'}
              shortcut={targetIsTerritory ? undefined : 'Del'}
              onClick={deleteTarget}
            >
              <Trash2 size={18} strokeWidth={1.8} fill="none" />
            </ContextButton>
            <ContextButton
              label="Mais ações"
              expanded={menuTarget === actionTarget}
              onClick={onToggleMenu}
            >
              <Ellipsis size={19} strokeWidth={2} fill="none" />
            </ContextButton>
          </div>
          {menuTarget === actionTarget && (
            <div
              className="context-action-menu"
              role="menu"
              aria-label="Mais ações"
              style={{
                left: toolbarX > viewport.width - 340 ? 'auto' : undefined,
                right: toolbarX > viewport.width - 340 ? 0 : undefined,
                top: toolbarY > viewport.height - 310 ? 'auto' : undefined,
                bottom: toolbarY > viewport.height - 310 ? 'calc(100% + 7px)' : undefined,
              }}
            >
              {menuEntries.map((entry, index) => {
                const EntryIcon = entry.icon;
                return (
                  <div key={entry.label}>
                    {entry.divider && index > 0 && <div className="context-action-divider" />}
                    <button
                      role="menuitem"
                      className={`context-action-item ${entry.danger ? 'is-danger' : ''}`}
                      onClick={() => runMenuAction(entry.id)}
                    >
                      <EntryIcon size={15} strokeWidth={1.75} fill="none" aria-hidden="true" />
                      <span>{entry.label}</span>
                      {entry.shortcut && <kbd>{entry.shortcut}</kbd>}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </>
  );
}
function ContextButton({
  label,
  shortcut,
  expanded,
  onClick,
  children,
}: {
  label: string;
  shortcut?: string;
  expanded?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={`context-toolbar-button ${expanded ? 'is-open' : ''}`}
      aria-label={label}
      aria-expanded={expanded}
      onClick={onClick}
    >
      {children}
      <span className="context-tooltip" role="tooltip">
        {label}
        {shortcut && <kbd>{shortcut}</kbd>}
      </span>
    </button>
  );
}
