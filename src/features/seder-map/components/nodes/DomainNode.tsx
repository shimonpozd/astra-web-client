import type { NodeProps } from '@xyflow/react';

type DomainNodeData = {
  title_he?: string | null;
  title_ru?: string | null;
  description?: string | null;
  editMode?: boolean;
};

export default function DomainNode({ data }: NodeProps<DomainNodeData>) {
  return (
    <div
      className={`h-full w-full rounded-2xl border border-border/60 bg-muted/20 px-4 py-3 text-xs text-muted-foreground ${
        data.editMode ? 'pointer-events-auto' : 'pointer-events-none'
      }`}
    >
      <div className="text-sm font-semibold text-foreground">
        {data.title_ru || 'Domain'}
      </div>
      {data.title_he ? (
        <div dir="rtl" className="text-xs mt-1">
          {data.title_he}
        </div>
      ) : null}
      {data.description ? <div className="text-[11px] mt-2">{data.description}</div> : null}
    </div>
  );
}
