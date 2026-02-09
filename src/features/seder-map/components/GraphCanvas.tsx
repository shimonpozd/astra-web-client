import { useCallback, useEffect, useMemo } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  useEdgesState,
  useNodesState,
  BaseEdge,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useMapStore } from '../store/useMapStore';
import { useMapActions } from '../hooks/useMapActions';

function VisibleEdge(props: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX: props.sourceX,
    sourceY: props.sourceY,
    targetX: props.targetX,
    targetY: props.targetY,
  });

  return <BaseEdge path={edgePath} style={{ stroke: '#ff0000', strokeWidth: 3 }} />;
}

const edgeTypes = { visible: VisibleEdge };

function FlowCanvasInner() {
  const { nodesData, edgesData, loading, error } = useMapStore();
  const { loadMap, createEdge } = useMapActions();

  // Подтягиваем карту при первом рендере.
  // Важно: не зависим от loadMap, чтобы не попасть в цикл «рендер → новый loadMap → рендер».
  useEffect(() => {
    if (!nodesData.length) {
      loadMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodesData.length]);

  // Преобразуем доменные ноды в формат React Flow (минимальный, как в доках)
  const initialNodes: Node[] = useMemo(
    () =>
      nodesData.map((node, index) => ({
        id: String(node.id),
        type: 'default',
        position: {
          x: node.pos_x ?? (index % 4) * 240,
          y: node.pos_y ?? Math.floor(index / 4) * 160,
        },
        data: {
          label: node.title_ru || node.title_he || node.id,
        },
      })),
    [nodesData],
  );

  // Преобразуем связи в стандартные edges
  const initialEdges: Edge[] = useMemo(() => {
    const nodeIds = new Set(initialNodes.map((node) => node.id));
    return edgesData
      .filter((edge) => nodeIds.has(String(edge.source_id)) && nodeIds.has(String(edge.target_id)))
      .map((edge) => ({
        id: String(edge.id),
        source: String(edge.source_id),
        target: String(edge.target_id),
        type: 'visible',
      }));
  }, [edgesData, initialNodes]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Синхронизируемся, когда backend-данные обновляются
  useEffect(() => {
    setNodes(initialNodes);
  }, [initialNodes, setNodes]);

  // Инициализируем рёбра из backend. Если какие-то рёбра не мапятся, они
  // отсеиваются в initialEdges (нет соответствующих нод).
  useEffect(() => {
    setEdges(initialEdges);
  }, [initialEdges, setEdges]);

  // Минимальный onConnect: сразу рисуем edge на клиенте и параллельно шлём на backend
  const handleConnect = useCallback(
    (connection: Connection) => {
      console.log('handleConnect', connection);
      setEdges((eds) => addEdge(connection, eds));
      if (connection.source && connection.target) {
        void createEdge(connection.source, connection.target, 'flow');
      }
    },
    [setEdges, createEdge],
  );

  return (
    <div className="relative h-full min-h-0 w-full rounded-lg border border-border/60 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#ff0000', strokeWidth: 3 },
        }}
        fitView
        style={{ width: '100%', height: '100%' }}
      >
        <Background gap={20} size={1} color="hsl(var(--border))" />
        <Controls />
        <MiniMap pannable zoomable />
      </ReactFlow>

      <div className="pointer-events-none absolute left-2 top-2 z-20 rounded bg-background/80 px-2 py-1 text-[11px] text-muted-foreground shadow">
        nodes:{nodesData.length} · edges:{edgesData.length} · viewNodes:{nodes.length} · viewEdges:{edges.length}
      </div>

      {!loading && !nodesData.length ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 text-sm text-muted-foreground">
          <div>Карта пустая или не загрузилась.</div>
          {error ? <div className="text-xs text-red-500">{error}</div> : null}
          <button
            type="button"
            className="rounded border border-border bg-card px-3 py-1 text-xs"
            onClick={() => loadMap()}
          >
            Перезагрузить
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function GraphCanvas() {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner />
    </ReactFlowProvider>
  );
}
