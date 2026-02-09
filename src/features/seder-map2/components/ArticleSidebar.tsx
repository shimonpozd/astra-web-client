import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { api } from '@/services/api';
import ArticlePanel from './ArticlePanel';
import type { MapNode } from '../types';

type Props = {
  selectedId: string | null;
  selectedNode: MapNode | null;
  nodesData: MapNode[];
  setNodesData: Dispatch<SetStateAction<MapNode[]>>;
  isAdmin: boolean;
  editMode: boolean;
  onNavigate: (nodeId: string) => void;
};

type ArticleState = {
  id: string;
  title_ru: string;
  title_he: string;
  text_ru: string;
  text_he: string;
};

export default function ArticleSidebar({
  selectedId,
  selectedNode,
  nodesData,
  setNodesData,
  isAdmin,
  editMode,
  onNavigate,
}: Props) {
  const [articleMode, setArticleMode] = useState<'ru' | 'he'>('ru');
  const [articleEditing, setArticleEditing] = useState(false);
  const [articleData, setArticleData] = useState<ArticleState | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string; title: string }>>([]);

  const mergeNodeUpdate = (nodeId: string, updated: MapNode) => {
    setNodesData((prev) =>
      prev.map((n) =>
        String(n.id) === String(nodeId)
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
  };

  const loadArticleForNode = async (nodeData: MapNode, options?: { allowCreate?: boolean }) => {
    const allowCreate = options?.allowCreate ?? true;
    if (!nodeData.article_id) {
      if (!allowCreate) {
        setArticleData({
          id: '',
          title_ru: nodeData.title_ru || '',
          title_he: nodeData.title_he || '',
          text_ru: '',
          text_he: '',
        });
        return;
      }
      const created = await api.createSederArticle({
        title_ru: nodeData.title_ru || '',
        title_he: nodeData.title_he || '',
        text_ru: '',
        text_he: '',
        source_type: 'internal',
      });
      const updated = await api.updateSederNode(String(nodeData.id), { article_id: created.id });
      mergeNodeUpdate(nodeData.id, updated);
      setArticleData(created);
      return;
    }
    const article = await api.getSederArticle(nodeData.article_id);
    setArticleData(article);
  };

  useEffect(() => {
    if (!selectedNode) {
      setArticleData(null);
      setArticleEditing(false);
      return;
    }
    setArticleEditing(false);
    if (editMode && isAdmin && !selectedNode.article_id) {
      setArticleData({
        id: '',
        title_ru: selectedNode.title_ru || '',
        title_he: selectedNode.title_he || '',
        text_ru: '',
        text_he: '',
      });
      return;
    }
    void loadArticleForNode(selectedNode, { allowCreate: !editMode || !isAdmin });
  }, [selectedNode, editMode, isAdmin]);

  const handleArticleSave = async () => {
    if (!articleData || !selectedNode) return;
    if (!articleData.id) {
      const created = await api.createSederArticle({
        title_ru: articleData.title_ru,
        title_he: articleData.title_he,
        text_ru: articleData.text_ru,
        text_he: articleData.text_he,
        source_type: 'internal',
      });
      const updatedNode = await api.updateSederNode(String(selectedNode.id), { article_id: created.id });
      mergeNodeUpdate(selectedNode.id, updatedNode);
      setArticleData(created);
      setArticleEditing(false);
      return;
    }
    const updated = await api.updateSederArticle(articleData.id, {
      text_ru: articleData.text_ru,
      text_he: articleData.text_he,
      title_ru: articleData.title_ru,
      title_he: articleData.title_he,
    });
    setArticleData(updated);
    setArticleEditing(false);
  };

  const handleArticleEditToggle = async () => {
    if (!selectedNode) return;
    if (!articleEditing) {
      await loadArticleForNode(selectedNode, { allowCreate: true });
    }
    setArticleEditing((v) => !v);
  };

  const navigateToNode = async (nodeId: string) => {
    const node = nodesData.find((n) => String(n.id) === String(nodeId));
    if (!node) return;
    onNavigate(String(node.id));
    await loadArticleForNode(node, { allowCreate: true });
  };

  const handleLinkClick = async (nodeId: string) => {
    const node = nodesData.find((n) => String(n.id) === String(nodeId));
    if (!node) return;
    setBreadcrumbs((prev) => {
      const next = [...prev];
      const current = selectedNode
        ? { id: String(selectedNode.id), title: selectedNode.title_ru || selectedNode.title_he || String(selectedNode.id) }
        : null;
      if (current && (next.length === 0 || next[next.length - 1].id !== current.id)) {
        next.push(current);
      }
      next.push({ id: String(node.id), title: node.title_ru || node.title_he || String(node.id) });
      return next.slice(-20);
    });
    await navigateToNode(nodeId);
  };

  const handleBreadcrumbClick = (nodeId: string) => {
    setBreadcrumbs((prev) => {
      const idx = prev.findIndex((b) => b.id === nodeId);
      if (idx === -1) return prev;
      return prev.slice(0, idx + 1);
    });
    void navigateToNode(nodeId);
  };

  return (
    <ArticlePanel
      nodeId={selectedId}
      titleRu={articleData?.title_ru || ''}
      titleHe={articleData?.title_he || ''}
      fallbackTitleRu={selectedNode?.title_ru || ''}
      fallbackTitleHe={selectedNode?.title_he || ''}
      textRu={articleData?.text_ru || ''}
      textHe={articleData?.text_he || ''}
      mode={articleMode}
      editing={articleEditing}
      canEdit={isAdmin}
      onModeChange={setArticleMode}
      onEditToggle={handleArticleEditToggle}
      onSave={handleArticleSave}
      onChange={(patch) =>
        setArticleData((prev) => {
          const update: Partial<ArticleState> = {};
          if (patch.textRu !== undefined) update.text_ru = patch.textRu;
          if (patch.textHe !== undefined) update.text_he = patch.textHe;

          return prev
            ? { ...prev, ...update }
            : {
                id: '',
                title_ru: selectedNode?.title_ru || '',
                title_he: selectedNode?.title_he || '',
                text_ru: patch.textRu ?? '',
                text_he: patch.textHe ?? '',
              };
        })
      }
      onLinkClick={handleLinkClick}
      breadcrumbs={breadcrumbs}
      onBreadcrumbClick={handleBreadcrumbClick}
    />
  );
}
