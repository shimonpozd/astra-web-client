import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import {
  Layers,
  Sparkles,
  LayoutGrid,
  Circle,
  StickyNote,
  Users,
  Sigma,
  Trash2,
  HelpCircle,
} from 'lucide-react';

type CustomNodeData = {
  title_he?: string | null;
  title_ru?: string | null;
  iconKey?: string | null;
  editMode?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stage: Layers,
  mechanism: Sparkles,
  structure: LayoutGrid,
  concept: Circle,
  meta: StickyNote,
  partzuf: Users,
  sefira: Sigma,
};

export default function CustomNode({ id, data }: NodeProps) {
  const nodeData = data as CustomNodeData;
  const Icon = data.iconKey ? ICONS[data.iconKey] ?? HelpCircle : HelpCircle;
  const isConnectable = Boolean(nodeData.editMode);

  return (
    <div
      className="relative rounded-xl border border-border bg-background/80 px-3 py-2 shadow-sm"
      style={{ pointerEvents: 'auto', overflow: 'visible' }}
    >
      {nodeData.editMode ? (
        <button
          type="button"
          className="nodrag absolute right-1 top-1 z-30 rounded-md border border-border/60 bg-background/90 p-1 text-muted-foreground hover:text-destructive"
          onClick={() => nodeData.onDelete?.(id)}
          title="Удалить узел"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      ) : null}

      {/* Аккуратные маленькие хендлы в стиле стандартного React Flow */}
      <Handle
        id="top"
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !rounded-full !bg-primary !border-2 !border-background"
        style={{
          top: -6,
          opacity: isConnectable ? 1 : 0.4,
          pointerEvents: 'auto',
          position: 'absolute',
        }}
        isConnectable={isConnectable}
        title={isConnectable ? 'Перетащите для соединения' : 'Включите режим редактирования'}
      />
      <Handle
        id="bottom"
        type="source"
        position={Position.Bottom}
        className="!w-3 !h-3 !rounded-full !bg-primary !border-2 !border-background"
        style={{
          bottom: -6,
          opacity: isConnectable ? 1 : 0.4,
          pointerEvents: 'auto',
          position: 'absolute',
        }}
        isConnectable={isConnectable}
        title={isConnectable ? 'Перетащите для соединения' : 'Включите режим редактирования'}
      />

      <div className="nodrag flex flex-col items-center gap-1 text-center">
        <Icon className="h-4 w-4 text-muted-foreground" />
        {nodeData.title_he ? (
          <div dir="rtl" className="text-sm font-semibold leading-snug">
            {nodeData.title_he}
          </div>
        ) : null}
        {nodeData.title_ru ? (
          <div className="text-xs leading-snug text-muted-foreground">
            {nodeData.title_ru}
          </div>
        ) : null}
      </div>
    </div>
  );
}
