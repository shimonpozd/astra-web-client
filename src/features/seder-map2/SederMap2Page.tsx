import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  type Edge,
  type Node,
  BaseEdge,
  getBezierPath,
  type EdgeProps,
  addEdge,
  type Connection,
  useReactFlow,
  type Node as FlowNode,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import TopBar from '@/components/layout/TopBar';
import { api } from '@/services/api';
import styles from './SederMap2.module.css';
import { Cpu, Layers, Grid, Tag, MessageSquare, Sparkles, Network } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import type { InspectorForm, MapDomain, MapEdge, MapNode, MapNote, SelectedTarget, NodeTypeConfig } from './types';
import SederNode from './components/nodes/SederNode';
import NoteNode from './components/nodes/NoteNode';
import DomainNode from './components/nodes/DomainNode';
import EditToolbar from './components/EditToolbar';
import InspectorPanel from './components/InspectorPanel';
import ArticleSidebar from './components/ArticleSidebar';

function VisibleEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });

  return (
    <BaseEdge
      path={edgePath}
      className={styles.edgeFlow}
      style={{ stroke: 'var(--edge-color)', strokeWidth: 'var(--edge-width)', opacity: 0.9 }}
    />
  );
}

function BecomesEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return (
    <BaseEdge
      path={edgePath}
      className={styles.edgeBecomes}
      style={{ stroke: 'var(--edge-becomes)', strokeWidth: 'var(--edge-width)', opacity: 0.9 }}
    />
  );
}

function ContainsEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return (
    <BaseEdge
      path={edgePath}
      className={styles.edgeContains}
      style={{ stroke: 'var(--edge-contains)', strokeWidth: 'var(--edge-width)', opacity: 0.85 }}
    />
  );
}

function ReferenceEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });
  return (
    <BaseEdge
      path={edgePath}
      className={styles.edgeReference}
      style={{ stroke: 'var(--edge-reference)', strokeWidth: 'var(--edge-width)', opacity: 0.8 }}
    />
  );
}

const edgeTypes = {
  flow: VisibleEdge,
  becomes: BecomesEdge,
  contains: ContainsEdge,
  reference: ReferenceEdge,
};

const NODE_TYPES: NodeTypeConfig[] = [
  { id: 'stage', icon: Layers, className: 'nodeType_stage' },
  { id: 'world', icon: Layers, className: 'nodeType_stage' },
  { id: 'mechanism', icon: Cpu, className: 'nodeType_mechanism' },
  { id: 'structure', icon: Grid, className: 'nodeType_structure' },
  { id: 'concept', icon: Tag, className: 'nodeType_concept' },
  { id: 'definition', icon: Tag, className: 'nodeType_concept' },
  { id: 'meta', icon: MessageSquare, className: 'nodeType_meta' },
  { id: 'annotation', icon: MessageSquare, className: 'nodeType_meta' },
  { id: 'sefira', icon: Sparkles, className: 'nodeType_sefira' },
  { id: 'partzuf', icon: Network, className: 'nodeType_partzuf' },
];

const NODE_TYPE_MAP = new Map(NODE_TYPES.map((item) => [item.id, item]));

const SederNodeWrapper = (props: any) => <SederNode {...props} nodeTypeMap={NODE_TYPE_MAP} />;

function Map2Canvas() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [nodesData, setNodesData] = useState<MapNode[]>([]);
  const [edgesData, setEdgesData] = useState<MapEdge[]>([]);
  const [notesData, setNotesData] = useState<MapNote[]>([]);
  const [domainsData, setDomainsData] = useState<MapDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [edgeType, setEdgeType] = useState<'flow' | 'becomes' | 'contains' | 'reference'>('flow');
  const [selected, setSelected] = useState<SelectedTarget>(null);
  const [form, setForm] = useState<InspectorForm>({
    title_he: '',
    title_ru: '',
    description: '',
    node_type: 'concept',
    domain_id: '',
    spine_parent_id: '',
    definition_id: '',
    text: '',
    width: '',
    height: '',
  });
  const { screenToFlowPosition, setCenter } = useReactFlow();
  const snapGrid: [number, number] = [20, 20];
  const isDraggingRef = useRef(false);
  const selectedNode = selected?.kind === 'node'
    ? nodesData.find((n) => String(n.id) === selected.id)
    : null;

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    Promise.all([api.getSederMap(), api.getSederDomains()])
      .then(([payload, domains]: any[]) => {
        if (!mounted) return;
        setNodesData(Array.isArray(payload?.nodes) ? payload.nodes : []);
        setEdgesData(Array.isArray(payload?.edges) ? payload.edges : []);
        setNotesData(Array.isArray(payload?.notes) ? payload.notes : []);
        setDomainsData(Array.isArray(domains) ? domains : []);
        setError(null);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setError(err?.message ?? 'Не удалось загрузить карту');
      })
      .finally(() => {
        if (!mounted) return;
        setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const mapToFlowNodes = useMemo(() => {
    const nodeItems: Node[] = nodesData.map((node, index) => ({
      id: String(node.id),
      type: 'seder',
      position: {
        x: node.pos_x ?? (index % 4) * 240,
        y: node.pos_y ?? Math.floor(index / 4) * 160,
      },
      data: {
        title_he: node.title_he || '',
        title_ru: node.title_ru || '',
        node_type: node.node_type || 'concept',
      },
      style: {
        zIndex: 2,
      },
    }));
    const noteItems: Node[] = notesData.map((note, index) => ({
      id: `note-${note.id}`,
      type: 'note',
      position: {
        x: note.pos_x ?? 100 + index * 40,
        y: note.pos_y ?? 100 + index * 30,
      },
      data: {
        text: note.kind === 'label' ? note.title_ru || '' : note.text_ru || '',
        kind: note.kind === 'label' ? 'label' : 'note',
        color: note.color || (note.kind === 'label' ? '#64748b' : '#eab308'),
        isResizable: false,
      },
      style: {
        width: note.width ?? (note.kind === 'label' ? 220 : 260),
        height: note.height ?? (note.kind === 'label' ? 60 : 140),
        zIndex: 3,
      },
    }));
    const domainItems: Node[] = domainsData.map((domain, index) => ({
      id: `domain-${domain.id}`,
      type: 'domain',
      position: {
        x: domain.pos_x ?? 40,
        y: domain.pos_y ?? 40 + index * 260,
      },
      data: {
        title_he: domain.title_he || '',
        title_ru: domain.title_ru || domain.id,
        description: domain.description || '',
        isResizable: false,
      },
      style: {
        width: domain.width ?? 900,
        height: domain.height ?? 220,
        zIndex: 0,
      },
    }));
    return [...domainItems, ...noteItems, ...nodeItems];
  }, [nodesData, notesData, domainsData]);

  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState(mapToFlowNodes);

  useEffect(() => {
    if (isDraggingRef.current) return;
    setFlowNodes(mapToFlowNodes);
  }, [mapToFlowNodes, setFlowNodes]);

  useEffect(() => {
    setFlowNodes((prev) =>
      prev.map((node) => {
        const nodeId = String(node.id);
        const isResizableNow =
          editMode &&
          isAdmin &&
          (nodeId.startsWith('note-') || nodeId.startsWith('domain-'));
        return {
          ...node,
          data: {
            ...node.data,
            isResizable: isResizableNow,
          },
        };
      }),
    );
  }, [editMode, isAdmin, setFlowNodes]);

  const edges: Edge[] = useMemo(() => {
    const nodeIds = new Set(nodesData.map((node) => String(node.id)));
    return edgesData
      .filter((edge) => nodeIds.has(String(edge.source_id)) && nodeIds.has(String(edge.target_id)))
      .map((edge) => {
        const rawType = edge.connection_type || 'flow';
        const normalized = String(rawType).toLowerCase();
        const edgeType = (normalized in edgeTypes ? normalized : 'flow') as keyof typeof edgeTypes;
        return {
          id: String(edge.id),
          source: String(edge.source_id),
          target: String(edge.target_id),
          type: edgeType,
          data: { connection_type: rawType },
        };
      });
  }, [edgesData, nodesData]);

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const localEdge = addEdge(
      { ...connection, type: 'visible' },
      edges,
    );
    const created = {
      id: `temp-${Date.now()}`,
      source_id: connection.source,
      target_id: connection.target,
      connection_type: edgeType,
    };
    setEdgesData((prev) => prev.concat(created));
    api
      .createSederEdge({
        source_id: connection.source,
        target_id: connection.target,
        connection_type: edgeType,
      })
      .then((saved: any) => {
        setEdgesData((prev) => prev.filter((e) => e.id !== created.id).concat(saved));
      })
      .catch((err: any) => {
        setEdgesData((prev) => prev.filter((e) => e.id !== created.id));
        setError(err?.message ?? 'Не удалось создать связь');
      });
    return localEdge;
  };

  const handleAddNode = (typeId: string) => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const payload = {
      title_ru: 'Новый узел',
      title_he: '',
      node_type: typeId,
      domain_id: null,
      pos_x: center.x,
      pos_y: center.y,
      width: 220,
      height: 90,
    };
    api
      .createSederNode(payload)
      .then((created: any) => {
        setNodesData((prev) => prev.concat(created));
      })
      .catch((err: any) => {
        setError(err?.message ?? 'Не удалось создать узел');
      });
  };

  const handleNodeDragStop = (_: unknown, node: FlowNode) => {
    if (!editMode || !isAdmin) return;
    const nextX = node.position.x;
    const nextY = node.position.y;
    const nextW = typeof node.width === 'number' ? node.width : undefined;
    const nextH = typeof node.height === 'number' ? node.height : undefined;
    if (String(node.id).startsWith('note-')) {
      const noteId = String(node.id).slice(5);
      setNotesData((prev) =>
        prev.map((n) =>
          String(n.id) === noteId ? { ...n, pos_x: nextX, pos_y: nextY, width: nextW ?? n.width, height: nextH ?? n.height } : n,
        ),
      );
      api.updateSederNote(noteId, { pos_x: nextX, pos_y: nextY, width: nextW, height: nextH }).catch((err: any) => {
        setError(err?.message ?? 'Не удалось сохранить позицию заметки');
      });
      return;
    }
    if (String(node.id).startsWith('domain-')) {
      const domainId = String(node.id).slice(7);
      setDomainsData((prev) =>
        prev.map((d) =>
          String(d.id) === domainId ? { ...d, pos_x: nextX, pos_y: nextY, width: nextW ?? d.width, height: nextH ?? d.height } : d,
        ),
      );
      api.updateSederDomain(domainId, { pos_x: nextX, pos_y: nextY, width: nextW, height: nextH }).catch((err: any) => {
        setError(err?.message ?? 'Не удалось сохранить позицию домена');
      });
      return;
    }
    setNodesData((prev) =>
      prev.map((n) => (String(n.id) === String(node.id) ? { ...n, pos_x: nextX, pos_y: nextY } : n)),
    );
    api.updateSederNode(String(node.id), { pos_x: nextX, pos_y: nextY }).catch((err: any) => {
      setError(err?.message ?? 'Не удалось сохранить позицию узла');
    });
  };

  const handleNodeDragStart = () => {
    if (!editMode || !isAdmin) return;
    isDraggingRef.current = true;
  };

  const handleNodeDragEnd = (evt: unknown, node: FlowNode) => {
    handleNodeDragStop(evt, node);
    // Let React Flow finish internal updates before resyncing external state.
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 80);
  };

  const selectNodeData = (nodeData: MapNode) => {
    setSelected({ kind: 'node', id: String(nodeData.id) });
    setForm((prev) => ({
      ...prev,
      title_he: nodeData.title_he || '',
      title_ru: nodeData.title_ru || '',
      node_type: nodeData.node_type || 'concept',
      domain_id: nodeData.domain_id || '',
      spine_parent_id: nodeData.spine_parent_id || '',
      definition_id: nodeData.definition_id || '',
    }));
  };

  const selectNodeById = (nodeId: string) => {
    const nodeData = nodesData.find((n) => String(n.id) === String(nodeId));
    if (!nodeData) return;
    selectNodeData(nodeData);
  };

  const handleNavigateToNode = (nodeId: string) => {
    selectNodeById(nodeId);
    const flowNode = flowNodes.find((n) => n.id === String(nodeId));
    if (flowNode) {
      const { x, y } = flowNode.position;
      setCenter(x + 120, y + 60, { zoom: 0.9, duration: 400 });
    }
  };

  const handleSelect = (_: unknown, node: FlowNode) => {
    const nodeId = String(node.id);
    if (!isAdmin && (nodeId.startsWith('note-') || nodeId.startsWith('domain-'))) {
      return;
    }
    if (nodeId.startsWith('note-')) {
      const noteId = nodeId.slice(5);
      const note = notesData.find((n) => String(n.id) === noteId);
      setSelected({ kind: 'note', id: noteId });
      setForm((prev) => ({
        ...prev,
        text: note?.kind === 'label' ? note?.title_ru || '' : note?.text_ru || '',
        width: note?.width ? String(note.width) : '',
        height: note?.height ? String(note.height) : '',
      }));
      return;
    }
    if (nodeId.startsWith('domain-')) {
      const domainId = nodeId.slice(7);
      const domain = domainsData.find((d) => String(d.id) === domainId);
      setSelected({ kind: 'domain', id: domainId });
      setForm((prev) => ({
        ...prev,
        title_he: domain?.title_he || '',
        title_ru: domain?.title_ru || '',
        description: domain?.description || '',
        width: domain?.width ? String(domain.width) : '',
        height: domain?.height ? String(domain.height) : '',
      }));
      return;
    }
    const nodeData = nodesData.find((n) => String(n.id) === nodeId);
    if (nodeData) {
      selectNodeData(nodeData);
      const flowNode = flowNodes.find((n) => n.id === String(nodeData.id));
      if (flowNode) {
        const { x, y } = flowNode.position;
        setCenter(x + 120, y + 60, { zoom: 0.9, duration: 350 });
      }
    }
  };

  const handlePaneClick = () => {
    setSelected(null);
  };

  const saveSelection = async () => {
    if (!selected) return;
    if (selected.kind === 'node') {
      const payload: Record<string, any> = {
        title_he: form.title_he || null,
        title_ru: form.title_ru || null,
        node_type: form.node_type || null,
        domain_id: form.domain_id || null,
        spine_parent_id: form.spine_parent_id || null,
        definition_id: form.definition_id || null,
      };
      const updated = await api.updateSederNode(selected.id, payload);
      setNodesData((prev) =>
        prev.map((n) =>
          String(n.id) === selected.id
            ? {
                ...n,
                ...updated,
                pos_x: updated.pos_x ?? n.pos_x,
                pos_y: updated.pos_y ?? n.pos_y,
                width: updated.width ?? n.width,
                height: updated.height ?? n.height,
              }
            : n,
        ),
      );
      return;
    }
    if (selected.kind === 'note') {
      const note = notesData.find((n) => String(n.id) === selected.id);
      const payload: Record<string, any> = {
        width: form.width ? Number(form.width) : undefined,
        height: form.height ? Number(form.height) : undefined,
      };
      if (note?.kind === 'label') {
        payload.title_ru = form.text;
      } else {
        payload.text_ru = form.text;
      }
      const updated = await api.updateSederNote(selected.id, payload);
      setNotesData((prev) =>
        prev.map((n) =>
          String(n.id) === selected.id
            ? {
                ...n,
                ...updated,
                pos_x: updated.pos_x ?? n.pos_x,
                pos_y: updated.pos_y ?? n.pos_y,
                width: updated.width ?? n.width,
                height: updated.height ?? n.height,
              }
            : n,
        ),
      );
      return;
    }
    if (selected.kind === 'domain') {
      const payload: Record<string, any> = {
        title_he: form.title_he || null,
        title_ru: form.title_ru || null,
        description: form.description || null,
        width: form.width ? Number(form.width) : undefined,
        height: form.height ? Number(form.height) : undefined,
      };
      const updated = await api.updateSederDomain(selected.id, payload);
      setDomainsData((prev) =>
        prev.map((d) =>
          String(d.id) === selected.id
            ? {
                ...d,
                ...updated,
                pos_x: updated.pos_x ?? d.pos_x,
                pos_y: updated.pos_y ?? d.pos_y,
                width: updated.width ?? d.width,
                height: updated.height ?? d.height,
              }
            : d,
        ),
      );
    }
  };

  const deleteSelection = async () => {
    if (!selected) return;
    if (selected.kind === 'node') {
      await api.deleteSederNode(selected.id);
      setNodesData((prev) => prev.filter((n) => String(n.id) !== selected.id));
      setEdgesData((prev) => prev.filter((e) => e.source_id !== selected.id && e.target_id !== selected.id));
      setSelected(null);
      return;
    }
    if (selected.kind === 'note') {
      await api.deleteSederNote(selected.id);
      setNotesData((prev) => prev.filter((n) => String(n.id) !== selected.id));
      setSelected(null);
      return;
    }
    if (selected.kind === 'domain') {
      await api.deleteSederDomain(selected.id);
      setDomainsData((prev) => prev.filter((d) => String(d.id) !== selected.id));
      // Detach domain from nodes/notes locally
      setNodesData((prev) => prev.map((n) => (n.domain_id === selected.id ? { ...n, domain_id: null } : n)));
      setNotesData((prev) => prev.map((n) => (n.domain_id === selected.id ? { ...n, domain_id: null } : n)));
      setSelected(null);
    }
  };

  const handleAddNote = (kind: 'note' | 'label') => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    });
    const payload = {
      kind,
      title_ru: kind === 'label' ? 'Label' : '',
      text_ru: kind === 'note' ? 'Текст заметки' : '',
      pos_x: center.x,
      pos_y: center.y,
      width: kind === 'label' ? 220 : 260,
      height: kind === 'label' ? 60 : 140,
      color: kind === 'label' ? '#64748b' : '#eab308',
    };
    api
      .createSederNote(payload)
      .then((created: any) => {
        setNotesData((prev) => prev.concat(created));
      })
      .catch((err: any) => {
        setError(err?.message ?? 'Не удалось создать заметку');
      });
  };

  const handleAddDomain = () => {
    const center = screenToFlowPosition({
      x: window.innerWidth / 2 - 400,
      y: window.innerHeight / 2 - 120,
    });
    const payload = {
      id: `CUSTOM_${Date.now()}`,
      title_ru: 'Новый домен',
      title_he: '',
      description: '',
      pos_x: center.x,
      pos_y: center.y,
      width: 900,
      height: 220,
    };
    api
      .createSederDomain(payload)
      .then((created: any) => {
        setDomainsData((prev) => prev.concat(created));
      })
      .catch((err: any) => {
        setError(err?.message ?? 'Не удалось создать домен');
      });
  };

  return (
    <div className={`${styles.panel} ${editMode ? styles.panelEdit : ''}`}>
      <div className={styles.articleColumn}>
        <ArticleSidebar
          selectedId={selected?.kind === 'node' ? selected.id : null}
          selectedNode={selectedNode}
          nodesData={nodesData}
          setNodesData={setNodesData}
          isAdmin={isAdmin}
          editMode={editMode}
          onNavigate={handleNavigateToNode}
        />
      </div>
      <div className={styles.canvasColumn}>
        <div className={styles.debug}>
          nodes:{nodesData.length} · edges:{edgesData.length} · viewNodes:{flowNodes.length} · viewEdges:{edges.length} ·
          edit:{editMode ? 'on' : 'off'} · admin:{isAdmin ? 'yes' : 'no'} ·
          types:{Array.from(new Set(edgesData.map((e) => (e.connection_type || 'flow')))).join(',')}
        </div>
        {isAdmin ? (
          <div className={styles.sidePanel}>
            <EditToolbar
              isAdmin={isAdmin}
              editMode={editMode}
              edgeType={edgeType}
              nodeTypes={NODE_TYPES}
              onToggleEdit={() => setEditMode((v) => !v)}
              onAddNode={handleAddNode}
              onAddNote={handleAddNote}
              onAddDomain={handleAddDomain}
              onEdgeTypeChange={setEdgeType}
            />
            <InspectorPanel
              selected={selected}
              form={form}
              nodeTypes={NODE_TYPES}
              domains={domainsData}
              onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
              onSave={saveSelection}
              onDelete={deleteSelection}
            />
          </div>
        ) : null}
        <ReactFlow
          className={styles.flow}
          nodes={flowNodes}
          onNodesChange={(changes) => {
            onNodesChange(changes);
            if (!editMode || !isAdmin) return;
            for (const change of changes) {
              if (change.type !== 'dimensions' || change.resizing) continue;
              const nodeId = String(change.id);
              const width = change.dimensions?.width;
              const height = change.dimensions?.height;
              if (nodeId.startsWith('note-')) {
                const noteId = nodeId.slice(5);
                setNotesData((prev) =>
                  prev.map((n) =>
                    String(n.id) === noteId ? { ...n, width: width ?? n.width, height: height ?? n.height } : n,
                  ),
                );
                void api.updateSederNote(noteId, { width, height });
              } else if (nodeId.startsWith('domain-')) {
                const domainId = nodeId.slice(7);
                setDomainsData((prev) =>
                  prev.map((d) =>
                    String(d.id) === domainId ? { ...d, width: width ?? d.width, height: height ?? d.height } : d,
                  ),
                );
                void api.updateSederDomain(domainId, { width, height });
              }
            }
          }}
          edges={edges}
          edgeTypes={edgeTypes}
          nodeTypes={{
            seder: SederNodeWrapper,
            note: NoteNode,
            domain: DomainNode,
          }}
        onConnect={editMode && isAdmin ? handleConnect : undefined}
        onNodeClick={handleSelect}
        onPaneClick={handlePaneClick}
        onNodeDragStart={editMode && isAdmin ? handleNodeDragStart : undefined}
        onNodeDragStop={editMode && isAdmin ? handleNodeDragEnd : undefined}
          nodesDraggable={editMode && isAdmin}
          panOnDrag={!editMode}
          snapToGrid={editMode && isAdmin}
          snapGrid={snapGrid}
          fitView
          defaultEdgeOptions={{ type: 'flow' }}
        >
          <Background variant="dots" gap={22} size={1} color="var(--map-grid)" />
          <Controls />
        </ReactFlow>
        {loading ? (
          <div className={styles.debug}>Загрузка...</div>
        ) : null}
        {error ? (
          <div className={styles.debug}>{error}</div>
        ) : null}
      </div>
    </div>
  );
}

export default function SederMap2Page() {
  return (
    <div className={styles.root}>
      <TopBar />
      <div className={styles.frame}>
        <ReactFlowProvider>
          <Map2Canvas />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
