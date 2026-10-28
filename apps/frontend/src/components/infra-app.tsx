'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Workflow } from 'lucide-react';
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
import { LeftSidebar } from './layout/left-sidebar';
import { RightSidebar } from './layout/right-sidebar';
import { SidebarResizer } from './layout/sidebar-resizer';
import { useSidebarLayout } from './layout/use-sidebar-layout';
import { useMapMonitoring } from '@/features/monitoring/use-map-monitoring';
import { secureRequest } from '@/features/support/api';
import { useRouter } from 'next/navigation';
import type { Route } from 'next';
import { workflowContextPath, type WorkflowListScope } from '@/features/workflows/workflow-path';

export function InfraApp({
  workflowId,
  isDraft = false,
  workflowScope = 'overview',
}: {
  workflowId: string;
  isDraft?: boolean;
  workflowScope?: WorkflowListScope;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [supportAccessKey, setSupportAccessKey] = useState('');
  const [errorState, setErrorState] = useState<{ workflowId: string; message: string } | null>(
    null,
  );
  const error = errorState?.workflowId === workflowId ? errorState.message : '';
  const setError = useCallback(
    (message: string) => {
      setErrorState(message ? { workflowId, message } : null);
    },
    [workflowId],
  );
  const [map, setMap] = useState<MapRecord | null>(() =>
    isDraft
      ? {
          id: workflowId,
          name: 'Novo workflow',
          widthMeters: 120,
          heightMeters: 80,
          hasTerritory: false,
          elements: [],
        }
      : null,
  );
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
  const { sidebarWidth, sidebarCollapsed, resizeSidebar, toggleSidebar } = useSidebarLayout();
  const [linkRevision, setLinkRevision] = useState(0);
  const metaRevision = useRef(0);
  const draftRef = useRef(isDraft);
  const draftSaveRequested = useRef(false);
  const loadedWorkflowId = useRef<string | null>(null);
  const saveRef = useRef<() => Promise<void>>(async () => {});
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
  const monitoring = useMapMonitoring(isDraft ? undefined : mapId, monitorRevision + linkRevision);

  // Carregamento assíncrono: React só recebe as atualizações depois da resposta da API.
  // O cancelamento evita que uma resposta antiga altere um componente desmontado.
  useEffect(() => {
    let cancelled = false;
    draftRef.current = isDraft;
    draftSaveRequested.current = false;
    if (isDraft) {
      loadedWorkflowId.current = workflowId;
      load([]);
      metaRevision.current = 0;
      const loadingFrame = window.requestAnimationFrame(() => setLoading(false));
      return () => {
        window.cancelAnimationFrame(loadingFrame);
        cancelled = true;
      };
    }
    if (loadedWorkflowId.current === workflowId) {
      return () => {
        cancelled = true;
      };
    }
    loadedWorkflowId.current = null;
    void api<MapRecord>('/maps/' + encodeURIComponent(workflowId))
      .then((detail) => {
        if (cancelled) return;
        loadedWorkflowId.current = workflowId;
        setMap(detail);
        setConnections([]);
        setRelationships([]);
        load(detail.elements ?? []);
        setMapDirty(false);
        metaRevision.current = 0;
      })
      .catch((err) => {
        if (!cancelled) {
          setMap(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isDraft, load, setError, workflowId]);

  useEffect(() => {
    if (!mapId || isDraft) return;
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
  }, [isDraft, linkRevision, mapId, selectedId, setError]);
  useEffect(() => {
    if (!mapId || isDraft) return;
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
  }, [isDraft, linkRevision, mapId, setError]);
  async function connectDevices(sourceElementId: string, targetElementId: string) {
    if (!map || map.hasTerritory === false) return;
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
  async function deleteTerritory() {
    if (!map || map.hasTerritory === false || deleting || saving) return;
    const current = map;
    if (
      !window.confirm(
        `Excluir o território de "${current.name}" e limpar setores, posições e conexões deste workflow? Os cadastros e históricos do inventário serão preservados.`,
      )
    )
      return;
    setDeleting(true);
    setError('');
    try {
      await api<void>(`/maps/${encodeURIComponent(current.id)}/territory`, {
        method: 'DELETE',
        body: JSON.stringify({
          name: current.name,
          widthMeters: current.widthMeters,
          heightMeters: current.heightMeters,
        }),
      });
      setMap({ ...current, hasTerritory: false, originXMeters: 0, originYMeters: 0, elements: [] });
      load([]);
      setConnections([]);
      setRelationships([]);
      setZoom(1);
      setMapDirty(false);
      metaRevision.current++;
      setLinkRevision((value) => value + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDeleting(false);
    }
  }
  function addArea(x = 2, y = 2, parentId: string | null = parent?.id ?? null) {
    if (!map || map.hasTerritory === false) return null;
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
    if (!map || map.hasTerritory === false) return;
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
    if (!map || map.hasTerritory === false) return;
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
    if (saving || deleting) return;
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
  function removeElement(ids: string | string[]) {
    const requested = Array.isArray(ids) ? ids : [ids];
    const targets = elements.filter((item) => requested.includes(item.id));
    if (!targets.length) return;
    const hasChildren = elements.some((item) =>
      targets.some((target) => item.parentId === target.id),
    );
    const confirmation =
      targets.length > 1
        ? `Excluir ${targets.length} elementos selecionados e todos os elementos dentro deles?`
        : hasChildren
          ? `Excluir "${targets[0].name}" e todos os elementos dentro dele?`
          : `Excluir "${targets[0].name}" do mapa?`;
    if (!window.confirm(confirmation)) return;
    remove(requested);
  }
  const save = useCallback(async () => {
    if (!map || saving || deleting) return;
    if (draftRef.current && !dirty && !mapDirty && !connectionDirty) return;
    setSaving(true);
    setError('');
    const elementsAtSave = useEditorStore.getState().elements;
    const before = JSON.stringify(elementsAtSave);
    const revision = metaRevision.current;
    const connectionsAtSave = connections;
    try {
      let savedMap = map;
      let createdWorkflowId: string | null = null;
      if (draftRef.current) {
        const created = await api<{ id: string }>('/maps', {
          method: 'POST',
          body: JSON.stringify({
            name: map.name.trim() || 'Novo workflow',
            widthMeters: map.widthMeters,
            heightMeters: map.heightMeters,
            originXMeters: map.originXMeters ?? 0,
            originYMeters: map.originYMeters ?? 0,
            hasTerritory: map.hasTerritory !== false,
            elements: elementsAtSave.map((element) => ({
              id: element.id,
              parentId: element.parentId,
              deviceId: element.deviceId,
              kind: element.kind,
              name: element.name,
              iconKey: element.iconKey,
              xMeters: element.xMeters,
              yMeters: element.yMeters,
              widthMeters: element.widthMeters,
              heightMeters: element.heightMeters,
              level: element.level,
              orderIndex: element.orderIndex ?? 0,
              hidden: element.hidden ?? false,
              locked: element.locked ?? false,
            })),
          }),
        });
        savedMap = { ...map, id: created.id, elements: elementsAtSave };
        createdWorkflowId = created.id;
        draftRef.current = false;
        loadedWorkflowId.current = created.id;
        setMap(savedMap);
      } else {
        await api('/maps/' + map.id + '/layout', {
          method: 'PUT',
          body: JSON.stringify({
            name: map.name,
            widthMeters: map.widthMeters,
            heightMeters: map.heightMeters,
            hasTerritory: map.hasTerritory !== false,
            originXMeters: map.originXMeters ?? 0,
            originYMeters: map.originYMeters ?? 0,
            elements: elementsAtSave.map((el) => ({
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
      }
      if (JSON.stringify(useEditorStore.getState().elements) === before) markSaved();
      if (metaRevision.current === revision) setMapDirty(false);
      const placedIds = new Set(elementsAtSave.map((element) => element.id));
      const pendingConnections = connectionsAtSave.filter(
        (item) =>
          item.id.startsWith('local-') &&
          placedIds.has(item.sourceElementId) &&
          placedIds.has(item.targetElementId),
      );
      for (const link of pendingConnections) {
        await api<MapConnection>(`/maps/${savedMap.id}/connections`, {
          method: 'POST',
          body: JSON.stringify({
            sourceElementId: link.sourceElementId,
            targetElementId: link.targetElementId,
          }),
        });
      }
      const updated = await api<{ connections: MapConnection[] }>(
        `/maps/${savedMap.id}/connections`,
      );
      setLinkRevision((value) => value + 1);
      const savedIds = new Set(
        connectionsAtSave.filter((item) => item.id.startsWith('local-')).map((link) => link.id),
      );
      setConnections((previous) => [
        ...updated.connections,
        ...previous.filter((link) => link.id.startsWith('local-') && !savedIds.has(link.id)),
      ]);
      const finalizedWorkflowId =
        createdWorkflowId ?? (!draftRef.current && map.id !== workflowId ? map.id : null);
      if (
        finalizedWorkflowId &&
        window.location.pathname === `/workflow/${encodeURIComponent(workflowId)}` &&
        new URLSearchParams(window.location.search).get('new') === 'true'
      )
        router.replace(workflowContextPath(finalizedWorkflowId, workflowScope));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }, [
    connectionDirty,
    connections,
    deleting,
    dirty,
    map,
    mapDirty,
    markSaved,
    router,
    saving,
    setError,
    workflowId,
    workflowScope,
  ]);

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    if (
      !isDraft ||
      !draftRef.current ||
      map?.id !== workflowId ||
      loadedWorkflowId.current !== workflowId ||
      loading ||
      saving ||
      deleting ||
      draftSaveRequested.current ||
      (!dirty && !mapDirty && !connectionDirty)
    )
      return;
    // The first real edit turns the local draft into a workflow. An untouched draft
    // stays only in the URL and never creates an empty database row.
    draftSaveRequested.current = true;
    void saveRef.current();
  }, [connectionDirty, deleting, dirty, isDraft, loading, map?.id, mapDirty, saving, workflowId]);

  const visibleDraft = isDraft && map?.id === workflowId;
  if (loading || (!map && !error) || (map?.id !== workflowId && !error))
    return <div className="loading">Carregando Infra Map...</div>;
  return (
    <div
      className={`app workspace-app workspace-editor-app ${
        inspectorOpen ? '' : 'inspector-hidden'
      } ${sidebarCollapsed ? 'sidebar-collapsed' : ''} ${saving ? 'is-saving' : ''}`}
      style={
        {
          '--infra-sidebar-width': `${sidebarCollapsed ? 49 : sidebarWidth}px`,
        } as React.CSSProperties
      }
    >
      <AppHeader
        name={map?.name ?? null}
        isDraft={visibleDraft}
        hasChanges={dirty || mapDirty || connectionDirty}
        saving={saving}
        canSave={
          Boolean(map) && !deleting && (!visibleDraft || dirty || mapDirty || connectionDirty)
        }
        canUndo={undoStack.length > 0 && !saving}
        canRedo={redoStack.length > 0 && !saving}
        onRename={renameMap}
        onUndo={undo}
        onRedo={redo}
        onSave={() => void save()}
      />
      <LeftSidebar
        active={workflowScope}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
      />
      {!sidebarCollapsed && (
        <SidebarResizer sidebarWidth={sidebarWidth} resizeSidebar={resizeSidebar} />
      )}
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
            onDeleteTerritory={() => void deleteTerritory()}
            onCreateTerritory={() => updateMap({ hasTerritory: true })}
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
            inspectorOpen={inspectorOpen}
            actionsDisabled={saving || deleting}
            hasTerritory={map.hasTerritory !== false}
            onToggleInspector={() => setInspectorOpen((value) => !value)}
            onAddArea={() => {
              addArea();
            }}
            onAddDevice={(kind) => void addDevice(kind)}
            onPlaceDevice={placeDevice}
            onOpenDevice={(nodeId) => {
              if (isDraft) {
                setError('Salve o workflow antes de abrir os parâmetros deste dispositivo.');
                return;
              }
              router.push(
                `/workflow/${encodeURIComponent(workflowId)}/${encodeURIComponent(nodeId)}`,
              );
            }}
            onActionError={setError}
          />
        ) : (
          <div className="empty-state">
            <Workflow size={36} />
            <h2>Workflow não encontrado</h2>
            <p>O workflow solicitado não está disponível.</p>
            <Link href={'/workflows' as Route}>Voltar ao Overview</Link>
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
        onDeleteTerritory={() => void deleteTerritory()}
        onDeviceSaved={(value) => {
          updateDevice(value.id, value);
        }}
        onOpenDevice={(nodeId) => {
          if (isDraft) {
            setError('Salve o workflow antes de abrir os parâmetros deste dispositivo.');
            return;
          }
          router.push(`/workflow/${encodeURIComponent(workflowId)}/${encodeURIComponent(nodeId)}`);
        }}
        onRelationshipsChanged={() => setLinkRevision((value) => value + 1)}
        onMonitoringChanged={() => setMonitorRevision((value) => value + 1)}
        deleting={deleting}
        saving={saving}
      />
    </div>
  );
}
