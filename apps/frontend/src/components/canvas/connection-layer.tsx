'use client';
import { useEffect, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { CanvasConnection, ConnectionCurve } from './connection-geometry';
import './connections.css';

export function ConnectionLayer({
  connections,
  preview,
  onRemove,
}: {
  connections: CanvasConnection[];
  preview: { curve: ConnectionCurve; valid: boolean } | null;
  onRemove: (connection: CanvasConnection) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = (id: string) => {
    if (timer.current) clearTimeout(timer.current);
    setActiveId(id);
  };
  const hide = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setActiveId(null), 180);
  };
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  const active = !preview
    ? connections.find((connection) => connection.id === activeId)
    : undefined;
  return (
    <>
      <svg className="connection-lines" aria-label="Conexões do mapa">
        {connections.map((connection) => (
          <g key={connection.id}>
            <path
              className="connection-stroke"
              d={connection.curve.path}
              stroke={connection.color}
              strokeWidth={active?.id === connection.id ? 3 : 2}
              strokeDasharray={connection.dashed ? '9 7' : undefined}
            />
            <path
              className="connection-hit"
              d={connection.curve.path}
              role="button"
              tabIndex={0}
              aria-label={connection.label}
              onPointerEnter={() => show(connection.id)}
              onPointerLeave={hide}
              onFocus={() => show(connection.id)}
              onBlur={hide}
              onPointerDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                show(connection.id);
              }}
              onClick={(event) => {
                event.stopPropagation();
                show(connection.id);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  show(connection.id);
                }
                if (event.key === 'Delete' || event.key === 'Backspace') {
                  event.preventDefault();
                  event.stopPropagation();
                  onRemove(connection);
                }
              }}
            />
          </g>
        ))}
        {preview && (
          <path
            className="connection-preview"
            data-testid="connection-preview"
            d={preview.curve.path}
            stroke={preview.valid ? '#23815b' : '#537ba4'}
          />
        )}
      </svg>
      {active && (
        <div
          className="connection-toolbar"
          role="toolbar"
          aria-label="Ações da conexão"
          style={{ left: active.curve.midpoint.x, top: active.curve.midpoint.y }}
          onPointerEnter={() => show(active.id)}
          onPointerLeave={hide}
          onFocus={() => show(active.id)}
          onBlur={hide}
        >
          <button
            className="context-toolbar-button"
            type="button"
            aria-label={`Excluir ${active.label.toLocaleLowerCase('pt-BR')}`}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              onRemove(active);
            }}
          >
            <Trash2 size={18} strokeWidth={1.8} />
            <span className="context-tooltip" role="tooltip">
              Excluir conexão
            </span>
          </button>
        </div>
      )}
    </>
  );
}
