import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Link2, Pencil, Trash2 } from 'lucide-react';

export type SederNodeData = {
  label: JSX.Element;
  editMode?: boolean;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
};

export function BaseNode({ id, data }: NodeProps<SederNodeData>) {
  return (
    <div className="relative overflow-visible">
      {data.editMode ? (
        <>
          <Handle
            type="target"
            position={Position.Top}
            className="!w-3 !h-3 !bg-primary !border-2 !border-background"
            style={{ top: 2 }}
            isConnectable={Boolean(data.editMode)}
          />
          <Handle
            type="source"
            position={Position.Bottom}
            className="!w-3 !h-3 !bg-primary !border-2 !border-background"
            style={{ bottom: 2 }}
            isConnectable={Boolean(data.editMode)}
          />
        </>
      ) : null}
      {data.editMode ? (
        <div className="absolute -top-3 -right-3 flex items-center gap-1 rounded-full border border-border bg-background/90 px-1.5 py-1 shadow-sm">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            title="Соединить: перетащите handle"
          >
            <Link2 className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground"
            onClick={() => data.onEdit?.(id)}
            title="Редактировать"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => data.onDelete?.(id)}
            title="Удалить"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      ) : null}
      <div>{data.label}</div>
    </div>
  );
}
