'use client';
import { useRef } from 'react';
export function SidebarResizer({
  sidebarWidth,
  resizeSidebar,
}: {
  sidebarWidth: number;
  resizeSidebar: (value: number) => void;
}) {
  const sidebarDrag = useRef<{ initialX: number; initialWidth: number } | null>(null);
  function finishSidebarResize(event: React.PointerEvent<HTMLDivElement>) {
    const drag = sidebarDrag.current;
    if (!drag) return;
    const result = Math.max(
      180,
      Math.min(440, Math.round(drag.initialWidth + event.clientX - drag.initialX)),
    );
    sidebarDrag.current = null;
    resizeSidebar(result);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* Already released */
    }
    try {
      window.localStorage.setItem('infra-map-sidebar-width', String(result));
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
        title="Arraste para redimensionar · dois cliques para restaurar"
        onPointerDown={(event) => {
          event.preventDefault();
          sidebarDrag.current = { initialX: event.clientX, initialWidth: sidebarWidth };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = sidebarDrag.current;
          if (drag) resizeSidebar(drag.initialWidth + event.clientX - drag.initialX);
        }}
        onPointerUp={finishSidebarResize}
        onPointerCancel={finishSidebarResize}
        onDoubleClick={() => {
          resizeSidebar(224);
          try {
            window.localStorage.setItem('infra-map-sidebar-width', '224');
          } catch {
            /* optional */
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowRight' || event.key === 'ArrowLeft' || event.key === 'Home') {
            event.preventDefault();
            const next =
              event.key === 'Home'
                ? 224
                : Math.max(
                    180,
                    Math.min(440, sidebarWidth + (event.key === 'ArrowRight' ? 12 : -12)),
                  );
            resizeSidebar(next);
            try {
              window.localStorage.setItem('infra-map-sidebar-width', String(next));
            } catch {
              /* optional */
            }
          }
        }}
      >
        <span className="sidebar-resizer-grip" aria-hidden="true" />
      </div>
    </>
  );
}
