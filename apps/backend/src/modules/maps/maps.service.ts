import { layoutSchema } from '@infra/contracts';
import { getTopologicalElements, LayoutValidationError } from '../../domain/layout-tree.js';
import { clearMapTerritory, persistLayout, deleteMapRecords } from './maps-layout.repository.js';
import { mapsRepository } from './maps.repository.js';
import { AppError } from '../../shared/errors.js';

export function saveLayout(mapId: string, body: unknown) {
  const layout = layoutSchema.parse(body);
  if (layout.hasTerritory === false && layout.elements.length)
    throw new LayoutValidationError(
      'Um workflow sem território não pode conter elementos posicionados',
    );
  return persistLayout(mapId, layout, getTopologicalElements(layout.elements));
}
export const deleteMapWithContents = deleteMapRecords;

export const mapsService = {
  list: () => mapsRepository.list(),
  page: (query: Parameters<typeof mapsRepository.page>[0]) => mapsRepository.page(query),
  summary: () => mapsRepository.summary(),
  create: (workflow: {
    name: string;
    widthMeters: number;
    heightMeters: number;
    originXMeters: number;
    originYMeters: number;
    hasTerritory: boolean;
    elements: import('@infra/contracts').MapElementInput[];
  }) => {
    if (!workflow.hasTerritory && workflow.elements.length)
      throw new LayoutValidationError(
        'Um workflow sem território não pode conter elementos posicionados',
      );
    return mapsRepository.create(workflow, getTopologicalElements(workflow.elements));
  },
  deleteTerritory: (
    id: string,
    territory: { name: string; widthMeters: number; heightMeters: number },
  ) => clearMapTerritory(id, territory),
  async byId(id: string) {
    const map = await mapsRepository.byId(id);
    if (!map) throw new AppError(404, 'Mapa não encontrado');
    return map;
  },
  relationships: (id: string) => mapsRepository.relationships(id),
  connections: (id: string) => mapsRepository.connections(id),
  connect: (mapId: string, source: string, target: string) => {
    if (source === target)
      throw new AppError(400, 'Não é possível conectar um dispositivo a ele mesmo');
    return mapsRepository.connect(mapId, source, target);
  },
  async disconnect(mapId: string, connectionId: string) {
    const result = await mapsRepository.disconnect(mapId, connectionId);
    if (!result.count) throw new AppError(404, 'Conexão não encontrada');
  },
};
