'use client';

import { useEffect, useState } from 'react';

const WIDTH_STORAGE_KEY = 'infra-map-sidebar-width';
const COLLAPSED_STORAGE_KEY = 'infra-map-sidebar-collapsed';
const DEFAULT_WIDTH = 224;

export function useSidebarLayout() {
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const storedWidth = Number(window.localStorage.getItem(WIDTH_STORAGE_KEY));
        if (storedWidth >= 180 && storedWidth <= 440) setSidebarWidth(storedWidth);
        setSidebarCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');
      } catch {
        /* Optional browser storage */
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function resizeSidebar(next: number) {
    setSidebarWidth(Math.max(180, Math.min(440, Math.round(next))));
  }

  function toggleSidebar() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        /* Optional browser storage */
      }
      return next;
    });
  }

  return { sidebarWidth, sidebarCollapsed, resizeSidebar, toggleSidebar };
}
