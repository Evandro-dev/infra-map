'use client';

import { useEffect, useRef, useState } from 'react';
import { Ellipsis, type LucideIcon } from 'lucide-react';
import styles from './options-menu.module.css';

export interface OptionsMenuItem {
  id: string;
  label: string;
  onSelect: () => void;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
}

export function OptionsMenu({
  label = 'Mais opções',
  triggerIcon: Icon = Ellipsis,
  placement = 'left',
  items,
}: {
  label?: string;
  triggerIcon?: LucideIcon;
  placement?: 'left' | 'right';
  items: OptionsMenuItem[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('pointerdown', closeOnPointerDown);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnPointerDown);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`}
        type="button"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon size={15} strokeWidth={1.8} aria-hidden="true" />
      </button>
      {open && (
        <div
          className={`${styles.menu} ${placement === 'right' ? styles.menuRight : ''}`}
          role="menu"
          aria-label={label}
        >
          {items.map((item) => (
            <div className={styles.itemGroup} key={item.id}>
              {item.separatorBefore && <div className={styles.separator} role="separator" />}
              <button
                className={`${styles.item} ${item.danger ? styles.danger : ''}`}
                role="menuitem"
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
