import { useAuth } from '@/contexts/AuthContext';
import { useMapStore } from '../../store/useMapStore';
import { useMapActions } from '../../hooks/useMapActions';

export default function Toolbar() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { editMode, selectedEdgeId, selectedEdgeType, domains, savingLayout, layoutError, flowNodes, setState } =
    useMapStore();
  const { saveLayout, deleteEdge, createNode, createDomain, createNote } = useMapActions();

  return (
    <div className="flex items-center gap-2 mb-3">
      {isAdmin ? (
        <button
          type="button"
          className={`text-xs px-2 py-1 rounded border ${editMode ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
          onClick={() => setState({ editMode: !editMode })}
        >
          {editMode ? 'Builder Mode: Вкл' : 'Builder Mode: Выкл'}
        </button>
      ) : null}
      {editMode ? (
        <>
          <div className="flex items-center gap-1">
            {[
              { id: 'stage', label: 'Stage' },
              { id: 'mechanism', label: 'Mechanism' },
              { id: 'structure', label: 'Structure' },
              { id: 'concept', label: 'Concept' },
              { id: 'meta', label: 'Meta' },
              { id: 'partzuf', label: 'Partzuf' },
              { id: 'sefira', label: 'Sefira' },
            ].map((nodeType) => (
              <button
                key={nodeType.id}
                type="button"
                className="text-[11px] px-2 py-1 rounded border border-border"
                onClick={() => createNode(nodeType.id)}
              >
                + {nodeType.label}
              </button>
            ))}
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded border border-border"
              onClick={() => createNote('note')}
            >
              + Note
            </button>
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded border border-border"
              onClick={() => createNote('label')}
            >
              + Label
            </button>
            <button
              type="button"
              className="text-[11px] px-2 py-1 rounded border border-border"
              onClick={async () => {
                const id = window.prompt('Domain ID (unique key, e.g. BEFORE_TZIMTZUM)');
                if (!id) return;
                const title_ru = window.prompt('Domain title RU', id) || id;
                const title_he = window.prompt('Domain title HE (optional)') || null;
                await createDomain({
                  id,
                  title_ru,
                  title_he,
                  pos_x: -200,
                  pos_y: (domains.length || 0) * 500,
                  width: 1200,
                  height: 420,
                });
              }}
            >
              + Domain
            </button>
          </div>
          <div className="flex items-center gap-1">
            {[
              { id: 'flow', label: 'Flow' },
              { id: 'becomes', label: 'Becomes' },
              { id: 'contains', label: 'Contains' },
              { id: 'reference', label: 'Reference' },
            ].map((edgeType) => (
              <button
                key={edgeType.id}
                type="button"
                className={`text-[11px] px-2 py-1 rounded border ${
                  selectedEdgeType === edgeType.id
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border'
                }`}
                onClick={() => setState({ selectedEdgeType: edgeType.id as any })}
              >
                {edgeType.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-border"
            onClick={() => saveLayout(flowNodes)}
            disabled={savingLayout}
          >
            {savingLayout ? 'Сохранение…' : 'Сохранить раскладку'}
          </button>
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-border"
            onClick={() => selectedEdgeId && deleteEdge(selectedEdgeId)}
            disabled={!selectedEdgeId}
          >
            Удалить связь
          </button>
          {layoutError ? <span className="text-xs text-red-500">{layoutError}</span> : null}
        </>
      ) : null}
    </div>
  );
}
