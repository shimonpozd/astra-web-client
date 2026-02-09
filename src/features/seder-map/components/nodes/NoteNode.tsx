import type { NodeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

type NoteNodeData = {
  title_he?: string | null;
  title_ru?: string | null;
  text_he?: string | null;
  text_ru?: string | null;
  color?: string | null;
  kind?: string | null;
  editMode?: boolean;
  noteId?: string;
  onDelete?: (id: string) => void;
};

export default function NoteNode({ data }: NodeProps<NoteNodeData>) {
  const isLabel = data.kind === 'label';
  const accent = data.color || (isLabel ? '#64748b' : '#eab308');

  return (
    <div
      className={`h-full w-full ${isLabel ? '' : 'rounded-lg border border-border/60 shadow-sm'} px-2 py-2 text-xs text-foreground`}
      style={{
        background: isLabel ? 'transparent' : 'rgba(15, 23, 42, 0.45)',
        borderColor: isLabel ? 'transparent' : accent,
        boxShadow: isLabel ? 'none' : undefined,
      }}
    >
      {data.editMode && data.noteId ? (
        <button
          type="button"
          className="absolute right-1 top-1 rounded-md border border-border/60 bg-background/90 p-1 text-muted-foreground hover:text-destructive"
          onClick={() => data.onDelete?.(data.noteId!)}
          title="Удалить заметку"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
      {data.title_ru ? <div className={`text-[11px] ${isLabel ? 'font-medium' : 'font-semibold'}`}>{data.title_ru}</div> : null}
      {data.title_he ? (
        <div dir="rtl" className="text-[11px] mt-1">
          {data.title_he}
        </div>
      ) : null}
      {!isLabel ? (
        <>
          {data.text_ru ? <div className="mt-2 text-[11px] text-muted-foreground">{data.text_ru}</div> : null}
          {data.text_he ? (
            <div dir="rtl" className="mt-2 text-[11px] text-muted-foreground">
              {data.text_he}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
