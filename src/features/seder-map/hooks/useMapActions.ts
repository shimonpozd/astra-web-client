import { api } from '@/services/api';
import { useMapStore } from '../store/useMapStore';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function useMapActions() {
  const store = useMapStore();

  const loadMap = async () => {
    store.setState({ loading: true, error: null });
    try {
      const [payload, layoutPayload, domainPayload] = await Promise.all([
        api.getSederMap(),
        api.getSederLayouts(),
        api.getSederDomains(),
      ]);
      const layouts = Array.isArray(layoutPayload) ? layoutPayload : [];
      const canonical = layouts.find((l: any) => l.is_canonical);
      store.setState({
        nodesData: payload?.nodes ?? [],
        edgesData: payload?.edges ?? [],
        notesData: payload?.notes ?? [],
        layouts,
        domains: Array.isArray(domainPayload) ? domainPayload : [],
        activeLayoutId: canonical?.id ?? layouts[0]?.id ?? null,
      });
    } catch (err: any) {
      store.setState({ error: err?.message ?? 'Failed to load map' });
    } finally {
      store.setState({ loading: false });
    }
  };

  const selectNode = async (nodeId: string) => {
    const node = store.nodesData.find((n) => n.id === nodeId) || null;
    store.setState({
      selectedNodeId: nodeId,
      article: null,
      segments: null,
      articleError: null,
      articleLoading: false,
    });
    if (!node?.article_id) {
      store.setState({ articleError: 'У узла нет статьи' });
      return;
    }
    store.setState({ articleLoading: true });
    try {
      const [article, segments] = await Promise.all([
        api.getSederArticle(node.article_id),
        api.getSederArticleSegments(node.article_id),
      ]);
      store.setState({
        article,
        segments: Array.isArray(segments) ? segments : [],
      });
    } catch (err: any) {
      store.setState({ articleError: err?.message ?? 'Не удалось загрузить статью' });
    } finally {
      store.setState({ articleLoading: false });
    }
  };

  const createArticleForNode = async (nodeId: string) => {
    const node = store.nodesData.find((n) => n.id === nodeId);
    if (!node) return;
    const article = await api.createSederArticle({
      title_he: node.title_he || null,
      title_ru: node.title_ru || null,
      source_type: 'internal',
    });
    const updated = await api.updateSederNode(nodeId, { article_id: article.id });
    await api.createSederSegments(article.id, [
      { order_index: 0, text_he: '', text_ru: '', status_he: 'draft', status_ru: 'draft' },
    ]);
    store.setState({
      nodesData: store.nodesData.map((n) => (n.id === updated.id ? updated : n)),
    });
    await selectNode(nodeId);
  };

  const addSegment = async (articleId: string) => {
    const orderIndex = (store.segments?.length ?? 0) + 1;
    const created = await api.createSederSegments(articleId, [
      { order_index: orderIndex, text_he: '', text_ru: '', status_he: 'draft', status_ru: 'draft' },
    ]);
    store.setState({ segments: [...(store.segments ?? []), ...created] });
  };

  const updateSegment = async (segmentId: string, payload: any) => {
    const updated = await api.updateSederSegment(segmentId, payload);
    store.setState({
      segments: (store.segments ?? []).map((s) => (s.id === updated.id ? updated : s)),
    });
    return updated;
  };

  const createNode = async (node_type: string) => {
    const defaultDomain = store.domains[0]?.id ?? null;
    const payload = {
      title_ru: 'Новый узел',
      node_type,
      domain_id: defaultDomain,
      pos_x: 100,
      pos_y: 100,
      width: 220,
      height: 90,
    };
    const created = await api.createSederNode(payload);
    store.setState({ nodesData: [...store.nodesData, created] });
  };

  const createNote = async (kind: 'note' | 'label' = 'note') => {
    const center = store.canvasCenter ?? { x: 100, y: 100 };
    const payload = {
      kind,
      title_ru: kind === 'label' ? 'Label' : 'Заметка',
      text_ru: kind === 'label' ? '' : 'Текст заметки',
      pos_x: center.x,
      pos_y: center.y,
      width: kind === 'label' ? 220 : 260,
      height: kind === 'label' ? 60 : 140,
      color: kind === 'label' ? '#64748b' : '#eab308',
    };
    const created = await api.createSederNote(payload);
    store.setState({ notesData: [...store.notesData, created] });
    return created;
  };

  const updateNote = async (noteId: string, payload: any) => {
    const updated = await api.updateSederNote(noteId, payload);
    store.setState({
      notesData: store.notesData.map((n) => (n.id === updated.id ? updated : n)),
    });
    return updated;
  };

  const deleteNote = async (noteId: string) => {
    await api.deleteSederNote(noteId);
    store.setState({
      notesData: store.notesData.filter((n) => n.id !== noteId),
      selectedNoteId: null,
    });
  };

  const updateDomain = async (domainId: string, payload: any) => {
    const updated = await api.updateSederDomain(domainId, payload);
    store.setState({
      domains: store.domains.map((d) => (d.id === updated.id ? updated : d)),
    });
    return updated;
  };

  const createDomain = async (payload: any) => {
    const created = await api.createSederDomain(payload);
    store.setState({ domains: [...store.domains, created] });
    return created;
  };

  const deleteNode = async (nodeId: string) => {
    await api.deleteSederNode(nodeId);
    store.setState({
      nodesData: store.nodesData.filter((n) => n.id !== nodeId),
      edgesData: store.edgesData.filter((e) => e.source_id !== nodeId && e.target_id !== nodeId),
      selectedNodeId: null,
    });
  };

  const updateNode = async (nodeId: string) => {
    const form = store.editForm;
    const payload: Record<string, any> = {
      title_he: form.title_he || null,
      title_ru: form.title_ru || null,
      node_type: form.node_type || null,
      phase: form.phase || null,
      domain_id: form.domain_id || null,
    };
    if (form.definition_id && isUuid(form.definition_id)) {
      payload.definition_id = form.definition_id;
    }
    if (form.spine_parent_id && isUuid(form.spine_parent_id)) {
      payload.spine_parent_id = form.spine_parent_id;
    }
    const updated = await api.updateSederNode(nodeId, payload);
    store.setState({
      nodesData: store.nodesData.map((n) => (n.id === updated.id ? updated : n)),
      editNodeOpen: false,
    });
  };

  const updateNodePosition = async (nodeId: string, payload: { pos_x?: number; pos_y?: number }) => {
    const updated = await api.updateSederNode(nodeId, payload);
    store.setState({
      nodesData: store.nodesData.map((n) => (n.id === updated.id ? updated : n)),
    });
    return updated;
  };

  const createEdge = async (sourceId: string, targetId: string, connection_type = 'flow') => {
    const tempId = `temp-${Date.now()}`;
    const optimistic = {
      id: tempId,
      source_id: sourceId,
      target_id: targetId,
      connection_type,
    };
    const prevEdges = useMapStore.getState().edgesData;
    store.setState({ edgesData: [...prevEdges, optimistic] });
    const created = await api.createSederEdge({
      source_id: sourceId,
      target_id: targetId,
      connection_type,
    });
    store.setState({
      edgesData: useMapStore.getState().edgesData
        .filter((e) => e.id !== tempId)
        .concat(created),
    });
    return created;
  };

  const deleteEdge = async (edgeId: string) => {
    await api.deleteSederEdge(edgeId);
    store.setState({
      edgesData: useMapStore.getState().edgesData.filter((e) => e.id !== edgeId),
      selectedEdgeId: null,
    });
  };

  const saveLayout = async (nodes: any[]) => {
    store.setState({ savingLayout: true, layoutError: null });
    const layoutPayload = {
      name: 'canonical',
      is_canonical: true,
      layout_json: {
        nodes: nodes
          .filter((n) => !(n.data as any)?.isDomain)
          .map((n) => ({
            id: n.id,
            x: n.position.x,
            y: n.position.y,
            width: typeof n.width === 'number' ? n.width : undefined,
            height: typeof n.height === 'number' ? n.height : undefined,
          })),
      },
    };
    const request = store.activeLayoutId
      ? api.updateSederLayout(store.activeLayoutId, layoutPayload)
      : api.createSederLayout(layoutPayload);
    try {
      const saved = await request;
      const nextLayouts = store.layouts.filter((l) => l.id !== saved.id).concat(saved);
      store.setState({ layouts: nextLayouts, activeLayoutId: saved.id });
    } catch (err: any) {
      store.setState({ layoutError: err?.message ?? 'Не удалось сохранить раскладку' });
    } finally {
      store.setState({ savingLayout: false });
    }
  };

  return {
    loadMap,
    selectNode,
    createArticleForNode,
    addSegment,
    updateSegment,
    createNode,
    createNote,
    updateNote,
    deleteNote,
    deleteNode,
    updateNode,
    updateNodePosition,
    createEdge,
    deleteEdge,
    saveLayout,
    updateDomain,
    createDomain,
  };
}
