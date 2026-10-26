'use client';
import type { PointerEvent } from 'react';
import type { ConnectionPortPosition, PortSide } from './connection-geometry';
interface Props {
  ports: ConnectionPortPosition[];
  pending: string | null;
  targetId: string | null;
  onPointerDown: (event: PointerEvent<HTMLButtonElement>, id: string, side: PortSide) => void;
  onKeyboardClick: (id: string, side: PortSide) => void;
  onCancel: () => void;
}
export function ConnectionPorts({
  ports,
  pending,
  targetId,
  onPointerDown,
  onKeyboardClick,
  onCancel,
}: Props) {
  const connectionPorts = ports,
    pendingConnection = pending;
  return (
    <>
      {' '}
      {connectionPorts.map((port) => (
        <div
          key={port.id}
          className="device-connection-ports"
          style={{ left: port.x, top: port.y, width: port.width, height: port.height }}
        >
          <button
            className={`connection-port connection-port-input ${targetId === port.id ? 'is-target' : ''}`}
            type="button"
            aria-label={`Conectar a ${port.name}`}
            title={
              pendingConnection ? `Concluir conexão com ${port.name}` : `Entrada de ${port.name}`
            }
            onPointerDown={(event) => onPointerDown(event, port.id, 'input')}
            onClick={(event) => {
              if (event.detail === 0) onKeyboardClick(port.id, 'input');
            }}
          />
          <button
            className={`connection-port connection-port-output ${pendingConnection === port.id ? 'is-pending' : ''} ${targetId === port.id ? 'is-target' : ''}`}
            type="button"
            title={
              pendingConnection === port.id
                ? 'Cancelar conexão'
                : `Iniciar conexão a partir de ${port.name}`
            }
            aria-label={`Iniciar conexão de ${port.name}`}
            onPointerDown={(event) => onPointerDown(event, port.id, 'output')}
            onClick={(event) => {
              if (event.detail === 0) onKeyboardClick(port.id, 'output');
            }}
          />
        </div>
      ))}
      {pendingConnection && (
        <div className="connection-hint" role="status">
          Arraste o ponto até outro dispositivo ou clique no próximo ponto. Esc cancela.{' '}
          <button type="button" onClick={() => onCancel()}>
            Cancelar
          </button>
        </div>
      )}
    </>
  );
}
