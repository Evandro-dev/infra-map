import type { MapElementInput } from '@infra/contracts';

export class LayoutValidationError extends Error {
  readonly statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'LayoutValidationError';
  }
}

/** Validate the entire proposed layout BEFORE making changes to persistent data. */
export function getTopologicalElements(items: MapElementInput[]): MapElementInput[] {
  const byId = new Map<string, MapElementInput>();
  const deviceNames = new Map<string, string>();
  for (const el of items) {
    if (byId.has(el.id)) throw new LayoutValidationError('IDs de elementos duplicados');
    byId.set(el.id, el);
    if (el.kind === 'DEVICE' && !el.deviceId)
      throw new LayoutValidationError('Dispositivo sem cadastro');
    if (el.kind === 'AREA' && el.deviceId)
      throw new LayoutValidationError('Área não pode ter equipamento associado');
    if (el.kind === 'DEVICE' && el.deviceId) {
      if (deviceNames.has(el.deviceId) && deviceNames.get(el.deviceId) !== el.name)
        throw new LayoutValidationError('Posições do mesmo equipamento devem usar o mesmo nome');
      deviceNames.set(el.deviceId, el.name);
    }
  }
  for (const el of items) {
    if (!el.parentId) continue;
    if (el.id === el.parentId)
      throw new LayoutValidationError('Elemento não pode conter a si mesmo');
    const parent = byId.get(el.parentId);
    if (!parent) throw new LayoutValidationError('Setor pai inexistente no mapa');
    if (parent.kind !== 'AREA')
      throw new LayoutValidationError('Somente retângulos/setores podem conter outros elementos');
  }
  const sorted: MapElementInput[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  function visit(el: MapElementInput) {
    if (visited.has(el.id)) return;
    if (visiting.has(el.id)) throw new LayoutValidationError('Ciclo na hierarquia de setores');
    visiting.add(el.id);
    if (el.parentId) visit(byId.get(el.parentId)!);
    visiting.delete(el.id);
    visited.add(el.id);
    sorted.push(el);
  }
  for (const el of items) visit(el);
  return sorted;
}
