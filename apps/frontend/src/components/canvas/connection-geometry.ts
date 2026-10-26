export type PortSide = 'input' | 'output';
export interface Point {
  x: number;
  y: number;
}
export interface ConnectionPortPosition extends Point {
  id: string;
  name: string;
  width: number;
  height: number;
}
export interface ConnectionEndpoint extends Point {
  side: PortSide;
}
export interface ConnectionCurve {
  path: string;
  midpoint: Point;
}
export interface CanvasConnection {
  id: string;
  label: string;
  curve: ConnectionCurve;
  color: string;
  relationship?: { computerId: string; printerId: string };
  dashed?: boolean;
}

export function portEndpoint(port: ConnectionPortPosition, side: PortSide): ConnectionEndpoint {
  return { x: port.x + (side === 'output' ? port.width : 0), y: port.y + port.height / 2, side };
}
export function connectionCurve(from: ConnectionEndpoint, to: ConnectionEndpoint): ConnectionCurve {
  const bend = Math.min(100, Math.max(30, Math.abs(to.x - from.x) * 0.45));
  const c1 = { x: from.x + (from.side === 'output' ? bend : -bend), y: from.y };
  const c2 = { x: to.x + (to.side === 'output' ? bend : -bend), y: to.y };
  return {
    path: `M ${from.x} ${from.y} C ${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`,
    midpoint: {
      x: (from.x + 3 * c1.x + 3 * c2.x + to.x) / 8,
      y: (from.y + 3 * c1.y + 3 * c2.y + to.y) / 8,
    },
  };
}
/** Inclui as pequenas alças e permite concluir soltando sobre o corpo do dispositivo. */
export function connectionTarget(ports: ConnectionPortPosition[], point: Point, sourceId: string) {
  return [...ports]
    .reverse()
    .find(
      (port) =>
        port.id !== sourceId &&
        point.x >= port.x - 12 &&
        point.x <= port.x + port.width + 12 &&
        point.y >= port.y - 8 &&
        point.y <= port.y + port.height + 8,
    );
}
export function facingEndpoints(source: ConnectionPortPosition, target: ConnectionPortPosition) {
  const forward = target.x >= source.x;
  return {
    from: portEndpoint(source, forward ? 'output' : 'input'),
    to: portEndpoint(target, forward ? 'input' : 'output'),
  };
}
