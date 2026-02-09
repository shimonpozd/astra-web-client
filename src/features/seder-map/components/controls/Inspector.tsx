import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useMapStore } from '../../store/useMapStore';
import { useMapActions } from '../../hooks/useMapActions';
import Markdown from '../Markdown';

export default function Inspector() {
  const {
    nodesData,
    selectedNodeId,
    editMode,
    article,
    segments,
    articleLoading,
    articleError,
    articleView,
    editForm,
    editNodeOpen,
    showAdvanced,
    domains,
    selectedDomainId,
    notesData,
    selectedNoteId,
  } = useMapStore();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const { updateNode, createArticleForNode, addSegment, updateSegment, updateDomain, updateNote, deleteNote } = useMapActions();

  const selectedNode = nodesData.find((n) => n.id === selectedNodeId) || null;
  const selectedDomain = domains.find((d) => d.id === selectedDomainId) || null;
  const selectedNote = notesData.find((n) => n.id === selectedNoteId) || null;

  const updateSegmentLocal = (segmentId: string, field: 'text_he' | 'text_ru', value: string) => {
    const next = (segments ?? []).map((seg) => (seg.id === segmentId ? { ...seg, [field]: value } : seg));
    useMapStore.setState({ segments: next });
  };

  useEffect(() => {
    if (!selectedNode) return;
    useMapStore.setState({
      editForm: {
        title_he: selectedNode.title_he ?? '',
        title_ru: selectedNode.title_ru ?? '',
        node_type: selectedNode.node_type ?? 'stage',
        phase: selectedNode.phase ?? '',
        definition_id: selectedNode.definition_id ?? '',
        spine_parent_id: selectedNode.spine_parent_id ?? '',
        domain_id: selectedNode.domain_id ?? '',
      },
      editNodeOpen: true,
    });
  }, [selectedNodeId]);

  return (
    <aside className="rounded-xl border border-border bg-card p-4 shadow-sm flex flex-col">
      {selectedNote && editMode ? (
        <div className="mb-4 space-y-3">
          <div className="text-sm font-semibold">Note / Label</div>
          <label className="block text-xs text-muted-foreground">
            Kind
            <select
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedNote.kind ?? 'note'}
              onChange={(e) =>
                useMapStore.setState({
                  notesData: notesData.map((n) =>
                    n.id === selectedNote.id ? { ...n, kind: e.target.value } : n,
                  ),
                })
              }
            >
              <option value="note">Note</option>
              <option value="label">Label</option>
            </select>
          </label>
          <label className="block text-xs text-muted-foreground">
            Title RU
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedNote.title_ru ?? ''}
              onChange={(e) =>
                useMapStore.setState({
                  notesData: notesData.map((n) =>
                    n.id === selectedNote.id ? { ...n, title_ru: e.target.value } : n,
                  ),
                })
              }
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Title HE
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedNote.title_he ?? ''}
              dir="rtl"
              onChange={(e) =>
                useMapStore.setState({
                  notesData: notesData.map((n) =>
                    n.id === selectedNote.id ? { ...n, title_he: e.target.value } : n,
                  ),
                })
              }
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Text RU
            <textarea
              className="mt-1 w-full min-h-[72px] rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedNote.text_ru ?? ''}
              onChange={(e) =>
                useMapStore.setState({
                  notesData: notesData.map((n) =>
                    n.id === selectedNote.id ? { ...n, text_ru: e.target.value } : n,
                  ),
                })
              }
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Text HE
            <textarea
              className="mt-1 w-full min-h-[72px] rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedNote.text_he ?? ''}
              dir="rtl"
              onChange={(e) =>
                useMapStore.setState({
                  notesData: notesData.map((n) =>
                    n.id === selectedNote.id ? { ...n, text_he: e.target.value } : n,
                  ),
                })
              }
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Color
            <input
              type="color"
              className="mt-1 h-8 w-16 rounded border border-border bg-background p-1"
              value={selectedNote.color ?? '#eab308'}
              onChange={(e) =>
                useMapStore.setState({
                  notesData: notesData.map((n) =>
                    n.id === selectedNote.id ? { ...n, color: e.target.value } : n,
                  ),
                })
              }
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs px-3 py-1 rounded border border-primary bg-primary text-primary-foreground"
              onClick={() =>
                updateNote(selectedNote.id, {
                  kind: selectedNote.kind ?? 'note',
                  title_ru: selectedNote.title_ru ?? null,
                  title_he: selectedNote.title_he ?? null,
                  text_ru: selectedNote.text_ru ?? null,
                  text_he: selectedNote.text_he ?? null,
                  color: selectedNote.color ?? null,
                })
              }
            >
              Сохранить заметку
            </button>
            <button
              type="button"
              className="text-xs px-3 py-1 rounded border border-border text-destructive"
              onClick={() => deleteNote(selectedNote.id)}
            >
              Удалить
            </button>
          </div>
        </div>
      ) : null}
      {selectedDomain && editMode ? (
        <div className="mb-4 space-y-3">
          <div className="text-sm font-semibold">Domain</div>
          <label className="block text-xs text-muted-foreground">
            Title RU
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedDomain.title_ru ?? ''}
              onChange={(e) =>
                useMapStore.setState({
                  domains: domains.map((d) =>
                    d.id === selectedDomain.id ? { ...d, title_ru: e.target.value } : d,
                  ),
                })
              }
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Title HE
            <input
              className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedDomain.title_he ?? ''}
              dir="rtl"
              onChange={(e) =>
                useMapStore.setState({
                  domains: domains.map((d) =>
                    d.id === selectedDomain.id ? { ...d, title_he: e.target.value } : d,
                  ),
                })
              }
            />
          </label>
          <label className="block text-xs text-muted-foreground">
            Description
            <textarea
              className="mt-1 w-full min-h-[72px] rounded border border-border bg-background px-2 py-1 text-sm"
              value={selectedDomain.description ?? ''}
              onChange={(e) =>
                useMapStore.setState({
                  domains: domains.map((d) =>
                    d.id === selectedDomain.id ? { ...d, description: e.target.value } : d,
                  ),
                })
              }
            />
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border"
              onClick={() =>
                updateDomain(selectedDomain.id, {
                  width: Math.max(300, (selectedDomain.width ?? 1200) - 100),
                })
              }
            >
              W-
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border"
              onClick={() =>
                updateDomain(selectedDomain.id, {
                  width: (selectedDomain.width ?? 1200) + 100,
                })
              }
            >
              W+
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border"
              onClick={() =>
                updateDomain(selectedDomain.id, {
                  height: Math.max(200, (selectedDomain.height ?? 420) - 60),
                })
              }
            >
              H-
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border"
              onClick={() =>
                updateDomain(selectedDomain.id, {
                  height: (selectedDomain.height ?? 420) + 60,
                })
              }
            >
              H+
            </button>
            <button
              type="button"
              className="text-xs px-2 py-1 rounded border border-border"
              onClick={() => useMapStore.setState({ selectedDomainId: null })}
            >
              Снять выбор
            </button>
          </div>
          <button
            type="button"
            className="text-xs px-3 py-1 rounded border border-primary bg-primary text-primary-foreground w-fit"
            onClick={() =>
              updateDomain(selectedDomain.id, {
                title_ru: selectedDomain.title_ru || null,
                title_he: selectedDomain.title_he || null,
                description: selectedDomain.description || null,
              })
            }
          >
            Сохранить домен
          </button>
        </div>
      ) : null}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold">Статья</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`text-xs px-2 py-1 rounded border ${articleView === 'split' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
            onClick={() => useMapStore.setState({ articleView: 'split' })}
          >
            Split
          </button>
          <button
            type="button"
            className={`text-xs px-2 py-1 rounded border ${articleView === 'he' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
            onClick={() => useMapStore.setState({ articleView: 'he' })}
          >
            HE
          </button>
          <button
            type="button"
            className={`text-xs px-2 py-1 rounded border ${articleView === 'ru' ? 'bg-primary text-primary-foreground border-primary' : 'border-border'}`}
            onClick={() => useMapStore.setState({ articleView: 'ru' })}
          >
            RU
          </button>
        </div>
      </div>

      {selectedNode ? (
        <div className="space-y-3">
          <div className="text-xs text-muted-foreground">
            Узел: {selectedNode.title_ru || selectedNode.title_he || selectedNode.id}
          </div>

          {editMode && editNodeOpen ? (
            <div className="rounded-lg border border-border/60 p-3 space-y-3">
              <div className="text-xs font-semibold">Свойства узла</div>
              <label className="block text-xs text-muted-foreground">
                Заголовок (HE)
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  value={editForm.title_he}
                  onChange={(e) => useMapStore.setState({ editForm: { ...editForm, title_he: e.target.value } })}
                  dir="rtl"
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Заголовок (RU)
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  value={editForm.title_ru}
                  onChange={(e) => useMapStore.setState({ editForm: { ...editForm, title_ru: e.target.value } })}
                />
              </label>
              <label className="block text-xs text-muted-foreground">
                Тип узла
                <select
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  value={editForm.node_type}
                  onChange={(e) => useMapStore.setState({ editForm: { ...editForm, node_type: e.target.value } })}
                >
                  <option value="stage">Stage / World</option>
                  <option value="mechanism">Mechanism</option>
                  <option value="structure">Structure</option>
                  <option value="concept">Concept</option>
                  <option value="meta">Meta / Annotation</option>
                  <option value="partzuf">Partzuf</option>
                  <option value="sefira">Sefira</option>
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Domain
                <select
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  value={editForm.domain_id}
                  onChange={(e) => useMapStore.setState({ editForm: { ...editForm, domain_id: e.target.value } })}
                >
                  <option value="">—</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title_ru || d.id}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-muted-foreground">
                Phase
                <input
                  className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                  value={editForm.phase}
                  onChange={(e) => useMapStore.setState({ editForm: { ...editForm, phase: e.target.value } })}
                />
              </label>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-border w-fit"
                onClick={() => useMapStore.setState({ showAdvanced: !showAdvanced })}
              >
                {showAdvanced ? 'Скрыть доп. поля' : 'Показать доп. поля'}
              </button>
              {showAdvanced ? (
                <div className="space-y-3">
                  <label className="block text-xs text-muted-foreground">
                    Definition ID (UUID)
                    <input
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                      value={editForm.definition_id}
                      onChange={(e) => useMapStore.setState({ editForm: { ...editForm, definition_id: e.target.value } })}
                    />
                  </label>
                  <label className="block text-xs text-muted-foreground">
                    Spine Parent ID (UUID)
                    <input
                      className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-sm"
                      value={editForm.spine_parent_id}
                      onChange={(e) => useMapStore.setState({ editForm: { ...editForm, spine_parent_id: e.target.value } })}
                    />
                  </label>
                </div>
              ) : null}
              <button
                type="button"
                className="text-xs px-3 py-1 rounded border border-primary bg-primary text-primary-foreground"
                onClick={() => selectedNodeId && updateNode(selectedNodeId)}
              >
                Сохранить
              </button>
            </div>
          ) : null}

          {articleLoading ? <div className="text-xs text-muted-foreground">Загрузка статьи…</div> : null}
          {articleError ? <div className="text-xs text-red-500">{articleError}</div> : null}
          {!article && editMode && isAdmin ? (
            <button
              type="button"
              className="text-xs px-3 py-1 rounded border border-primary bg-primary text-primary-foreground"
              onClick={() => selectedNodeId && createArticleForNode(selectedNodeId)}
            >
              Создать статью
            </button>
          ) : null}
          {article ? (
            <div>
              <div className="text-sm font-semibold mb-2">
                {article.title_ru || article.title_he || 'Без названия'}
              </div>
              <div className="h-[60vh] overflow-auto border border-border/60 rounded-lg p-3">
                {segments && segments.length ? (
                  <div className={articleView === 'split' ? 'grid grid-cols-2 gap-4' : 'space-y-4'}>
                    {segments.map((seg) => (
                      <div key={seg.id} className="space-y-2">
                        {(articleView === 'split' || articleView === 'he') ? (
                          editMode ? (
                            <textarea
                              className="w-full min-h-[80px] rounded border border-border bg-background px-2 py-1 text-sm"
                              dir="rtl"
                              value={seg.text_he || ''}
                              onChange={(e) => updateSegmentLocal(seg.id, 'text_he', e.target.value)}
                            />
                          ) : seg.text_he ? (
                            <Markdown
                              dir="rtl"
                              className="prose prose-sm max-w-none text-foreground"
                              content={seg.text_he}
                            />
                          ) : null
                        ) : null}
                        {(articleView === 'split' || articleView === 'ru') ? (
                          editMode ? (
                            <textarea
                              className="w-full min-h-[80px] rounded border border-border bg-background px-2 py-1 text-sm"
                              value={seg.text_ru || ''}
                              onChange={(e) => updateSegmentLocal(seg.id, 'text_ru', e.target.value)}
                            />
                          ) : seg.text_ru ? (
                            <Markdown
                              className="prose prose-sm max-w-none text-muted-foreground"
                              content={seg.text_ru}
                            />
                          ) : null
                        ) : null}
                        {editMode ? (
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-border"
                            onClick={() =>
                              updateSegment(seg.id, {
                                version: seg.version || 1,
                                text_he: seg.text_he ?? '',
                                text_ru: seg.text_ru ?? '',
                              })
                            }
                          >
                            Сохранить сегмент
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground">Сегменты отсутствуют</div>
                )}
                {editMode ? (
                  <div className="mt-3">
                    <button
                      type="button"
                      className="text-xs px-2 py-1 rounded border border-border"
                      onClick={() => addSegment(article.id)}
                    >
                      Добавить сегмент
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="text-xs text-muted-foreground">Выберите узел на карте, чтобы открыть статью</div>
      )}
    </aside>
  );
}
