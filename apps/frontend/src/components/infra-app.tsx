'use client';
import { useEffect, useRef, useState } from 'react';
import { DoorOpen } from 'lucide-react';
import { api } from '@/lib/api';
import { useEditorStore } from '@/lib/store';
import {
  DEFAULT_ICONS,
  DEVICE_LABELS,
  suggestedSectorIcon,
  type Device,
  type DeviceKind,
  type MapRecord,
  type MapConnection,
} from '@/lib/types';
import { EditorCanvas } from './editor-canvas';
import { AppHeader } from './layout/app-header';
import { AppRail } from './layout/app-rail';
import { LeftSidebar } from './layout/left-sidebar';
import { RightSidebar } from './layout/right-sidebar';
import { SidebarResizer } from './layout/sidebar-resizer';
import { useMapMonitoring } from '@/features/monitoring/use-map-monitoring';
import { secureRequest } from '@/features/support/api';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';

/** URL tipada do Next.js para um workflow persistido. */
function workflowPath(id: string): Route {
  return `/workflow/${encodeURIComponent(id)}` as Route;
}

export function InfraApp({ workflowId }: { workflowId?: string } = {}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [supportAccessKey, setSupportAccessKey] = useState('');
  const [error, setError] = useState('');
  const [maps, setMaps] = useState<MapRecord[]>([]);
  const [map, setMap] = useState<MapRecord | null>(null);
  const [zoom, setZoom] = useState(1);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [mapDirty, setMapDirty] = useState(false);
  const [relationships, setRelationships] = useState<{ computerId: string; printerId: string }[]>(
    [],
  );
  const [showLinks, setShowLinks] = useState(true);
  const [connections, setConnections] = useState<MapConnection[]>([]);
  const connectionDirty = connections.some((link) => link.id.startsWith('local-'));
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(224);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const stored = Number(window.localStorage.getItem('infra-map-sidebar-width'));
        if (stored >= 180 && stored <= 440) setSidebarWidth(stored);
      } catch {
        /* optional */
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  function resizeSidebar(next: number) {
    setSidebarWidth(Math.max(180, Math.min(440, Math.round(next))));
  }

  const territoriesRef = useRef<HTMLDivElement>(null);
  const devicesRef = useRef<HTMLDivElement>(null);
  const [linkRevision, setLinkRevision] = useState(0);
  const metaRevision = useRef(0);
  const {
    elements,
    selectedId,
    dirty,
    load,
    add,
    update,
    remove,
    undo,
    redo,
    markSaved,
    undoStack,
    redoStack,
    updateDevice,
  } = useEditorStore();
  const selected = elements.find((e) => e.id === selectedId) ?? null;
  const parent = selected?.kind === 'AREA' ? selected : null;
  const mapId = map?.id;
  const [monitorRevision, setMonitorRevision] = useState(0);
  const monitoring = useMapMonitoring(mapId, monitorRevision + linkRevision);

  // Carregamento assíncrono: React só recebe as atualizações depois da resposta da API.
  // O cancelamento evita que uma resposta antiga altere um componente desmontado.
  useEffect(() => {
    let cancelled = false;
    void api<MapRecord[]>('/maps')
      .then(async (list) => ({
        list,
        detail: workflowId
          ? await api<MapRecord>('/maps/' + encodeURIComponent(workflowId))
          : list.length
            ? await api<MapRecord>('/maps/' + list[0].id)
            : null,
      }))
      .then(({ list, detail }) => {
        if (cancelled) return;
        setMaps(list);
        setMap(detail);
        if (!workflowId && detail) router.replace(workflowPath(detail.id));
        load(detail?.elements ?? []);
        setMapDirty(false);
        metaRevision.current = 0;
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load, workflowId, router]);

  useEffect(() => {
    if (!mapId) return;
    let cancelled = false;
    void api<{ relationships: { computerId: string; printerId: string }[] }>(
      `/maps/${mapId}/relationships`,
    )
      .then((result) => {
        if (!cancelled) setRelationships(result.relationships);
      })
      .catch(() => {
        if (!cancelled) setRelationships([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mapId, selectedId, linkRevision]);
  useEffect(() => {
    if (!mapId) return;
    let cancelled = false;
    void api<{ connections: MapConnection[] }>(`/maps/${mapId}/connections`)
      .then((data) => {
        if (!cancelled)
          setConnections((previous) => [
            ...data.connections,
            ...previous.filter((link) => link.id.startsWith('local-')),
          ]);
      })
      .catch((err) => {
        if (!cancelled) {
          setConnections([]);
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [mapId, linkRevision]);
  async function connectDevices(sourceElementId: string, targetElementId: string) {
    if (!map) return;
    if (
      connections.some(
        (link) =>
          (link.sourceElementId === sourceElementId && link.targetElementId === targetElementId) ||
          (link.sourceElementId === targetElementId && link.targetElementId === sourceElementId),
      )
    )
      return;
    // New placements live in the editor until the user saves the layout.
    // Queue links locally so connecting unsaved devices does not cause an API 400.
    if (dirty) {
      setConnections((previous) => [
        ...previous,
        { id: 'local-' + crypto.randomUUID(), mapId: map.id, sourceElementId, targetElementId },
      ]);
      return;
    }
    try {
      setError('');
      const result = await api<MapConnection>(`/maps/${map.id}/connections`, {
        method: 'POST',
        body: JSON.stringify({ sourceElementId, targetElementId }),
      });
      setConnections((previous) =>
        previous.some((link) => link.id === result.id) ? previous : [...previous, result],
      );
      setLinkRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  async function clearDeviceConnections(id: string) {
    if (!map) return;
    const relevant = connections.filter(
      (link) => link.sourceElementId === id || link.targetElementId === id,
    );
    if (!relevant.length) return;
    if (
      !window.confirm(
        `Remover ${relevant.length} conexão(ões) deste dispositivo? Ligações de impressão também removem a associação esperada do computador, inclusive em outros mapas. Isso não desinstala filas no Windows.`,
      )
    )
      return;
    try {
      for (const link of relevant.filter((item) => !item.id.startsWith('local-')))
        await api<void>(`/maps/${map.id}/connections/${link.id}`, { method: 'DELETE' });
      setConnections((previous) =>
        previous.filter((link) => !relevant.some((item) => item.id === link.id)),
      );
      setLinkRevision((value) => value + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }
  async function removeConnection(id: string) {
    if (!map) return;
    const connection = connections.find((link) => link.id === id);
    if (!connection) return;
    if (connection.id.startsWith('local-')) {
      setConnections((previous) => previous.filter((link) => link.id !== id));
      return;
    }
    if (
      connection.kind === 'PRINTING' &&
      !window.confirm(
        'Remover esta conexão de impressão? A associação esperada também será removida dos outros mapas. Isso não desinstala filas no Windows.',
      )
    )
      return;
    try {
      setError('');
      await api<void>(`/maps/${map.id}/connections/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });
      setConnections((previous) =>
        previous.filter(
          (link) =>
            link.id !== id &&
            (!connection.printerAssignmentId ||
              link.printerAssignmentId !== connection.printerAssignmentId),
        ),
      );
      if (connection.kind === 'PRINTING') {
        const source = elements.find((el) => el.id === connection.sourceElementId)?.deviceId;
        const target = elements.find((el) => el.id === connection.targetElementId)?.deviceId;
        setRelationships((previous) =>
          previous.filter(
            (link) =>
              !(
                (link.computerId === source && link.printerId === target) ||
                (link.computerId === target && link.printerId === source)
              ),
          ),
        );
      }
      setLinkRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }
  async function removeRelationship(computerId: string, printerId: string) {
    if (!supportAccessKey) {
      setError('Autorize o acesso na aba Suporte para remover esta associação do inventário.');
      return;
    }
    if (
      !window.confirm(
        'Remover esta associação de impressão do computador? As linhas correspondentes em outros mapas também serão removidas. Isso não desinstala filas no Windows.',
      )
    )
      return;
    try {
      setError('');
      await secureRequest(
        `/devices/${encodeURIComponent(computerId)}/printers/${encodeURIComponent(printerId)}`,
        supportAccessKey,
        { method: 'DELETE' },
      );
      setRelationships((previous) =>
        previous.filter((link) => link.computerId !== computerId || link.printerId !== printerId),
      );
      setLinkRevision((value) => value + 1);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  }
  async function selectMap(id: string) {
    if (saving || deleting) return;
    if (
      (dirty || mapDirty || connectionDirty) &&
      !window.confirm('Existem alterações não salvas. Descartá-las para trocar de mapa?')
    )
      return;
    try {
      setError('');
      const data = await api<MapRecord>('/maps/' + id);
      setMap(data);
      router.push(workflowPath(data.id));
      load(data.elements);
      setZoom(1);
      setMapDirty(false);
      metaRevision.current = 0;
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function createMap() {
    if (saving || deleting) return;
    if (
      (dirty || mapDirty || connectionDirty) &&
      !window.confirm('Existem alterações não salvas. Descartá-las para criar outro mapa?')
    )
      return;
    try {
      setError('');
      const created = await api<MapRecord>('/maps', {
        method: 'POST',
        body: JSON.stringify({ name: 'Novo território', widthMeters: 120, heightMeters: 80 }),
      });
      setMaps((prev) => [created, ...prev]);
      setMap(created);
      setConnections([]);
      router.push(workflowPath(created.id));
      load(created.elements ?? []);
      setZoom(1);
      setMapDirty(false);
      metaRevision.current = 0;
    } catch (err) {
      setError((err as Error).message);
    }
  }
  async function deleteMap() {
    if (!map || deleting || saving) return;
    const current = map;
    if (
      !window.confirm(
        `Excluir o território "${current.name}", seus setores e posições de equipamentos? Os cadastros e históricos do inventário serão preservados. A exclusão do mapa não poderá ser desfeita.`,
      )
    )
      return;
    setDeleting(true);
    setError('');
    try {
      await api<void>('/maps/' + current.id, { method: 'DELETE' });
      const remaining = maps.filter((item) => item.id !== current.id);
      setMaps(remaining);
      if (remaining.length) {
        const detail = await api<MapRecord>('/maps/' + remaining[0].id);
        setMap(detail);
        router.replace(workflowPath(detail.id));
        load(detail.elements);
      } else {
        setMap(null);
        router.replace('/');
        load([]);
      }
      setZoom(1);
      setMapDirty(false);
      metaRevision.current = 0;
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  function addArea(x = 2, y = 2, parentId: string | null = parent?.id ?? null) {
    if (!map) return null;
    const id = crypto.randomUUID();
    const name = 'Novo setor';
    add({
      id,
      parentId,
      deviceId: null,
      kind: 'AREA',
      name,
      iconKey: suggestedSectorIcon(name),
      xMeters: x,
      yMeters: y,
      widthMeters: 16,
      heightMeters: 10,
      level: 0,
      orderIndex: elements.length,
      hidden: false,
      locked: false,
    });
    return id;
  }
  async function addDevice(
    kind: DeviceKind,
    x = 2,
    y = 2,
    parentId: string | null = parent?.id ?? null,
  ) {
    if (!map) return;
    try {
      setError('');
      const name = DEVICE_LABELS[kind];
      const device = await api<Device>('/devices', {
        method: 'POST',
        body: JSON.stringify({ name, kind }),
      });
      add({
        id: crypto.randomUUID(),
        parentId,
        deviceId: device.id,
        kind: 'DEVICE',
        name: device.name,
        iconKey: DEFAULT_ICONS[kind],
        xMeters: x,
        yMeters: y,
        widthMeters: 3,
        heightMeters: 3,
        level: 0,
        orderIndex: elements.length,
        hidden: false,
        locked: false,
        device,
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }
  function drop(kind: string, x: number, y: number, parentId: string | null) {
    if (kind === 'AREA') return addArea(x, y, parentId);
    if (kind.startsWith('DEVICE:')) void addDevice(kind.slice(7) as DeviceKind, x, y, parentId);
    return null;
  }
  function placeDevice(device: Device) {
    if (!map) return;
    const existing = elements.find((element) => element.deviceId === device.id);
    if (existing) {
      useEditorStore.getState().select(existing.id);
      return;
    }
    add({
      id: crypto.randomUUID(),
      parentId: parent?.id ?? null,
      deviceId: device.id,
      kind: 'DEVICE',
      name: device.name,
      iconKey: DEFAULT_ICONS[device.kind],
      xMeters: 2,
      yMeters: 2,
      widthMeters: 3,
      heightMeters: 3,
      level: 0,
      orderIndex: elements.length,
      hidden: false,
      locked: false,
      device,
    });
  }
  function updateMap(change: Partial<MapRecord>) {
    metaRevision.current++;
    setMapDirty(true);
    setMap((current) => (current ? { ...current, ...change } : current));
  }
  function renameMap(name: string) {
    const next = name.trim();
    if (map && next && next !== map.name) updateMap({ name: next });
  }
  function renameElement(id: string, name: string) {
    const next = name.trim();
    const element = elements.find((item) => item.id === id);
    if (!element || !next || next === element.name) return;
    update(id, {
      name: next,
      ...(element.kind === 'AREA' ? { iconKey: suggestedSectorIcon(next) } : {}),
    });
  }
  function removeElement(id: string) {
    const target = elements.find((item) => item.id === id);
    if (!target) return;
    const hasChildren = elements.some((item) => item.parentId === id);
    if (
      !window.confirm(
        hasChildren
          ? `Excluir "${target.name}" e todos os elementos dentro dele?`
          : `Excluir "${target.name}" do mapa?`,
      )
    )
      return;
    remove(id);
  }
  async function save() {
    if (!map || saving || deleting) return;
    setSaving(true);
    setError('');
    const before = JSON.stringify(elements);
    const revision = metaRevision.current;
    try {
      await api('/maps/' + map.id + '/layout', {
        method: 'PUT',
        body: JSON.stringify({
          name: map.name,
          widthMeters: map.widthMeters,
          heightMeters: map.heightMeters,
          originXMeters: map.originXMeters ?? 0,
          originYMeters: map.originYMeters ?? 0,
          elements: elements.map((el) => ({
            id: el.id,
            parentId: el.parentId,
            deviceId: el.deviceId,
            kind: el.kind,
            name: el.name,
            iconKey: el.iconKey,
            xMeters: el.xMeters,
            yMeters: el.yMeters,
            widthMeters: el.widthMeters,
            heightMeters: el.heightMeters,
            level: el.level,
            orderIndex: el.orderIndex ?? 0,
            hidden: el.hidden ?? false,
            locked: el.locked ?? false,
          })),
        }),
      });
      if (JSON.stringify(useEditorStore.getState().elements) === before) markSaved();
      if (metaRevision.current === revision) setMapDirty(false);
      setMaps((prev) =>
        prev.map((item) =>
          item.id === map.id
            ? {
                ...item,
                name: map.name,
                widthMeters: map.widthMeters,
                heightMeters: map.heightMeters,
              }
            : item,
        ),
      );
      const placedIds = new Set(elements.map((element) => element.id));
      const pendingConnections = connections.filter(
        (item) =>
          item.id.startsWith('local-') &&
          placedIds.has(item.sourceElementId) &&
          placedIds.has(item.targetElementId),
      );
      for (const link of pendingConnections) {
        await api<MapConnection>(`/maps/${map.id}/connections`, {
          method: 'POST',
          body: JSON.stringify({
            sourceElementId: link.sourceElementId,
            targetElementId: link.targetElementId,
          }),
        });
      }
      const updated = await api<{ connections: MapConnection[] }>(`/maps/${map.id}/connections`);
      setLinkRevision((value) => value + 1);
      const savedIds = new Set(
        connections.filter((item) => item.id.startsWith('local-')).map((link) => link.id),
      );
      setConnections((previous) => [
        ...updated.connections,
        ...previous.filter((link) => link.id.startsWith('local-') && !savedIds.has(link.id)),
      ]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="loading">Carregando Infra Map...</div>;
  return (
    <div
      className={`app ${inspectorOpen ? '' : 'inspector-hidden'}`}
      style={{ '--infra-sidebar-width': `${sidebarWidth}px` } as React.CSSProperties}
    >
      <AppHeader
        name={map?.name ?? null}
        hasChanges={dirty || mapDirty || connectionDirty}
        saving={saving}
        canSave={Boolean(map) && !deleting}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        onUndo={undo}
        onRedo={redo}
        onSave={() => void save()}
      />
      <AppRail
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((value) => !value)}
        onShowTerritories={() =>
          territoriesRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
        onShowDevices={() =>
          devicesRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        }
      />
      <LeftSidebar
        map={map}
        maps={maps}
        saving={saving}
        deleting={deleting}
        territoriesRef={territoriesRef}
        devicesRef={devicesRef}
        onSelect={(id) => void selectMap(id)}
        onCreate={() => void createMap()}
        onArea={() => {
          addArea();
        }}
        onDevice={(kind) => void addDevice(kind)}
        onPlaceDevice={placeDevice}
      />
      <SidebarResizer sidebarWidth={sidebarWidth} resizeSidebar={resizeSidebar} />
      <main className="workspace" aria-label="Área de edição do mapa">
        {error && (
          <div className="error-banner" role="alert">
            {error}
            <button className="icon-btn btn" aria-label="Fechar erro" onClick={() => setError('')}>
              ×
            </button>
          </div>
        )}
        {map ? (
          <EditorCanvas
            key={map.id}
            map={map}
            zoom={zoom}
            setZoom={setZoom}
            onDropItem={drop}
            onRenameElement={renameElement}
            onRenameMap={renameMap}
            onDeleteElement={removeElement}
            onDeleteMap={() => void deleteMap()}
            onMoveTerritory={(point) =>
              updateMap({ originXMeters: point.x, originYMeters: point.y })
            }
            relationships={showLinks ? relationships : []}
            monitoring={monitoring}
            connections={showLinks ? connections : []}
            onConnect={(from, to) => {
              setShowLinks(true);
              void connectDevices(from, to);
            }}
            onDisconnect={(id) => void clearDeviceConnections(id)}
            onRemoveConnection={(id) => void removeConnection(id)}
            onRemoveRelationship={(computerId, printerId) =>
              void removeRelationship(computerId, printerId)
            }
            showLinks={showLinks}
            toggleLinks={() => setShowLinks((value) => !value)}
          />
        ) : (
          <div className="empty-state">
            <DoorOpen size={36} />
            <h2>Seu espaço está vazio</h2>
            <p>Crie um território na barra lateral para começar seu mapa do zero.</p>
          </div>
        )}
      </main>
      <RightSidebar
        map={map}
        selected={selected}
        supportAccessKey={supportAccessKey}
        onSupportKeyChange={setSupportAccessKey}
        onUpdateMap={updateMap}
        onRemoveElement={removeElement}
        onDeleteMap={() => void deleteMap()}
        onDeviceSaved={(value) => {
          updateDevice(value.id, value);
        }}
        onRelationshipsChanged={() => setLinkRevision((value) => value + 1)}
        onMonitoringChanged={() => setMonitorRevision((value) => value + 1)}
        deleting={deleting}
        saving={saving}
      />
    </div>
  );
}
