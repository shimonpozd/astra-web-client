import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CompiledSageHighlight, CompiledConceptHighlight } from '../types';
import { ConceptHighlight } from '../../types/highlight';

export const useTextSelection = (
  sagesBySlug: Map<string, CompiledSageHighlight>,
  conceptsBySlug: Map<string, CompiledConceptHighlight>,
  setHoveredCommentRef: (ref: string | null) => void,
  isAdminMode: boolean
) => {
  const navigate = useNavigate();

  const [hoverCard, setHoverCard] = useState<{
    slug: string;
    type: 'sage' | 'concept';
    x: number;
    y: number;
    summary: string | null;
    label: string;
  } | null>(null);

  const [profileModalSlug, setProfileModalSlug] = useState<string | null>(null);

  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    selectedText: string;
  } | null>(null);

  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleHighlightMouseOver = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rawTarget = event.target as HTMLElement | null;
    const dhSpan = rawTarget?.closest('.highlight-dh') as HTMLElement | null;
    if (dhSpan) {
      const commentRef = dhSpan.dataset.commentRef;
      if (commentRef) {
        const refs = commentRef.split('|');
        if (refs[0]) setHoveredCommentRef(refs[0]);
      }
    }

    const target = rawTarget?.closest('.hover-target') as HTMLElement | null;
    if (!target) return;
    const slug = target.dataset.slug;
    const entityType = target.dataset.entityType as 'sage' | 'concept' | undefined;
    if (!slug || (entityType !== 'sage' && entityType !== 'concept')) return;
    const rect = target.getBoundingClientRect();
    const source = entityType === 'sage' ? sagesBySlug.get(slug) : conceptsBySlug.get(slug);

    let summary: string | undefined;
    let label: string | undefined;

    if (entityType === 'concept') {
      summary = (source as ConceptHighlight | undefined)?.short_summary_html || undefined;
      label = (source as ConceptHighlight | undefined)?.term_he || slug;
    } else {
      const s = source as CompiledSageHighlight | undefined;
      label = s?.name_he || s?.name_ru || slug;
      const lines: string[] = [];
      if (s?.name_ru) lines.push(`<strong>Имя (RU):</strong> ${s.name_ru}`);
      if (s?.period_label_ru) {
        lines.push(`<strong>Эра:</strong> ${s.period_label_ru}`);
      } else if (s?.period) {
        const base = (s.period.split('_')[0] || s.period).toLowerCase();
        const baseLabel = base === 'zugot'
          ? 'Зугот'
          : base === 'tannaim'
            ? 'Таннаим'
            : base === 'amoraim'
              ? 'Амораим'
              : s.period;
        lines.push(`<strong>Эра:</strong> ${baseLabel}`);
      }
      if (s?.generation != null) lines.push(`<strong>Поколение:</strong> ${s.generation}`);
      if (s?.region) lines.push(`<strong>Регион:</strong> ${s.region}`);
      if (s?.lifespan) lines.push(`<strong>Годы жизни:</strong> ${s.lifespan}`);
      if (lines.length) {
        summary = `<div class="space-y-1">${lines.map((l) => `<div>${l}</div>`).join('')}</div>`;
      }
    }
    setHoverCard({
      slug,
      type: entityType,
      x: rect.left + rect.width / 2,
      y: rect.top,
      summary: summary || null,
      label: label || slug,
    });
  }, [conceptsBySlug, sagesBySlug, setHoveredCommentRef]);

  const handleHighlightMouseOut = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rawTarget = event.target as HTMLElement | null;
    const dhSpan = rawTarget?.closest('.highlight-dh');
    if (dhSpan) {
      setHoveredCommentRef(null);
    }

    const target = rawTarget?.closest('.hover-target');
    const related = event.relatedTarget as HTMLElement | null;
    if (target && related && related.closest('.hover-target')) {
      return;
    }
    setHoverCard(null);
  }, [setHoveredCommentRef]);

  const handleHighlightClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement | null)?.closest('.hover-target') as HTMLElement | null;
    if (!target) return;
    const slug = target.dataset.slug;
    const entityType = target.dataset.entityType as 'sage' | 'concept' | undefined;
    if (!slug || (entityType !== 'sage' && entityType !== 'concept')) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (entityType === 'sage') {
      setProfileModalSlug(slug);
      return;
    }
    const path = `/concept/${slug}`;
    navigate(path);
  }, [navigate]);

  const handleTouchStart = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement | null)?.closest('.hover-target') as HTMLElement | null;
    if (!target) return;
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
    touchTimerRef.current = setTimeout(() => {
      const slug = target.dataset.slug;
      const entityType = target.dataset.entityType as 'sage' | 'concept' | undefined;
      if (slug && entityType === 'sage') {
        setProfileModalSlug(slug);
      }
    }, 400);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current);
      touchTimerRef.current = null;
    }
  }, []);

  const handleGemaraMouseUp = useCallback(() => {
    if (!isAdminMode) return;
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (text && text.length > 0) {
      const range = selection?.getRangeAt(0);
      const rect = range?.getBoundingClientRect();
      if (rect) {
        setSelectionMenu({
          x: rect.left + rect.width / 2,
          y: rect.top,
          selectedText: text,
        });
      }
    }
  }, [isAdminMode]);

  return {
    hoverCard,
    profileModalSlug,
    setProfileModalSlug,
    selectionMenu,
    setSelectionMenu,
    handleHighlightMouseOver,
    handleHighlightMouseOut,
    handleHighlightClick,
    handleTouchStart,
    handleTouchEnd,
    handleGemaraMouseUp,
  };
};
