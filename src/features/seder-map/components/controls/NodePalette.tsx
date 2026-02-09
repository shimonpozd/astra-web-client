import { useMapStore } from '../../store/useMapStore';
import { useMapActions } from '../../hooks/useMapActions';

const TYPES = [
  { id: 'stage', label: 'Stage / World', color: '#5b8bb5' },
  { id: 'mechanism', label: 'Mechanism', color: '#f59e0b' },
  { id: 'structure', label: 'Structure', color: '#10b981' },
  { id: 'concept', label: 'Concept', color: '#94a3b8' },
  { id: 'meta', label: 'Meta', color: '#9ca3af' },
];

export default function NodePalette() {
  const { editMode } = useMapStore();
  const { createNode } = useMapActions();

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-sm h-full">
      <div className="text-sm font-semibold mb-3">Node Palette</div>
      <div className="space-y-2">
        {TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            className="w-full text-left text-xs px-2 py-2 rounded border border-border hover:bg-accent disabled:opacity-50 flex items-center gap-2"
            disabled={!editMode}
            onClick={() => createNode(t.id)}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: t.color }}
            />
            {t.label}
          </button>
        ))}
      </div>
      {!editMode ? (
        <div className="mt-3 text-xs text-muted-foreground">Включите Builder Mode для добавления.</div>
      ) : null}
    </div>
  );
}
