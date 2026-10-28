'use client';
import { useRef } from 'react';
import { IconTip } from '@/components/ui-tooltip';
export function SidebarResizer({
  sidebarWidth,
  resizeSidebar,
  storageKey = 'infra-map-sidebar-width',
  direction = 'forward',
  defaultWidth = 224,
}: {
  sidebarWidth: number;
  resizeSidebar: (value: number) => void;
  storageKey?: string;
  direction?: 'forward' | 'reverse';
  defaultWidth?: number;
}) {
  const sidebarDrag = useRef<{ initialX: number; initialWidth: number } | null>(null);
  const directionFactor = direction === 'reverse' ? -1 : 1;
  function finishSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    const drag = sidebarDrag.current;
    if (!drag) return;
    const result = Math.max(
      180,
      Math.min(
        440,
        Math.round(drag.initialWidth + directionFactor * (event.clientX - drag.initialX)),
      ),
    );
    sidebarDrag.current = null;
    resizeSidebar(result);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* Already released */
    }
    try {
      window.localStorage.setItem(storageKey, String(result));
    } catch {
      /* Optional */
    }
  }
  return (
    <>
      {' '}
      <div
        className="sidebar-resizer"
        role="separator"
        aria-label="Redimensionar sidebar"
        aria-orientation="vertical"
        aria-valuenow={sidebarWidth}
        aria-valuemin={180}
        aria-valuemax={440}
        tabIndex={0}
        onPointerDown={(event) => {
          event.preventDefault();
          sidebarDrag.current = { initialX: event.clientX, initialWidth: sidebarWidth };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = sidebarDrag.current;
          if (drag)
            resizeSidebar(drag.initialWidth + directionFactor * (event.clientX - drag.initialX));
        }}
        onPointerUp={finishSidebarResize}
        onPointerCancel={finishSidebarResize}
        onDoubleClick={() => {
          resizeSidebar(defaultWidth);
          try {
            window.localStorage.setItem(storageKey, String(defaultWidth));
          } catch {
            /* optional */
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home') {
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? defaultWidth
                : Math.max(
                    180,
                    Math.min(
                      440,
                      sidebarWidth + directionFactor * (event.key === 'ArrowRight' ? 12 : -12),
                    ),
                  );
            resizeSidebar(next);
            try {
              window.localStorage.setItem(storageKey, String(next));
            } catch {
              /* optional */
            }
          }
        }}
      >
        <IconTip
          label="Redimensionar sidebar · duplo clique restaura"
          shortcut="Arrastar"
          side="right"
        >
          <span className="sidebar-resizer-handle" aria-hidden="true">
            <span className="sidebar-resizer-grip" />
          </span>
        </IconTip>
      </div>
    </>
  );
}
