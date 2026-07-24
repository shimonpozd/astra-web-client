import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { 
  BookOpen, 
  Languages, 
  Type,
  Quote,
  Loader2,
  Copy,
  Maximize2,
  Check,
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Shield,
  UserPlus,
  Sparkles,
  X
} from 'lucide-react';

import { addSageMapping, createSageProfile, addCustomConcept, addConceptMapping, fetchSageHighlights } from '../../../services/highlight';
import { stripHebrewVowels, stripPunctuation } from '../../../utils/hebrewUtils';
import { useTranslation } from '../../../hooks/useTranslation';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import ProfileInspectorModal from '../ProfileInspectorModal';
import { parseRefSmart } from '../../../utils/refUtils';

import {
  TraditionalComment,
  TraditionalTalmudDafProps,
  READER_CONFIG
} from './types';

import { escapeRegExp, getNextDafRef, getPrevDafRef, isSameRef } from './utils/refUtils';
import { parseCommentDh } from './utils/commentParsing';
import {
  highlightFullPhraseInHtml,
  buildHebrewFuzzyRegex,
  highlightDhInGemara,
  renderHighlightedText,
} from './utils/highlightMatching';
import { copyToClipboard } from './utils/clipboard';

import { useCommentaryOverrides } from './hooks/useCommentaryOverrides';
import { useHighlights } from './hooks/useHighlights';
import { useReadComments } from './hooks/useReadComments';
import { useTextSelection } from './hooks/useTextSelection';

import { CommentaryColumn } from './CommentaryColumn';
import { SageSearchModal } from './modals/SageSearchModal';
import { CreateSageModal } from './modals/CreateSageModal';
import { ConceptModal } from './modals/ConceptModal';
import { HoverCard } from './modals/HoverCard';
import { BookshelfDrawer } from './modals/BookshelfDrawer';

export {
  escapeRegExp,
  getNextDafRef,
  getPrevDafRef,
  parseCommentDh,
  highlightFullPhraseInHtml,
  buildHebrewFuzzyRegex,
  highlightDhInGemara,
};

export const DEFAULT_COMMENTARY_SETS: Record<string, { left: string; right: string }> = {
  talmud: { left: 'Tosafot', right: 'Rashi' },
  tanakh: { left: 'Ibn Ezra', right: 'Rashi' },
  shulchan_arukh_oc: { left: 'Turei Zahav (Taz)', right: 'Magen Avraham' },
  shulchan_arukh_yd: { left: 'Siftei Kohen (Shach)', right: 'Turei Zahav (Taz)' },
  rambam: { left: 'Maggid Mishneh', right: 'Kesef Mishneh' },
  default: { left: 'Commentary', right: 'Commentary' }
};

interface TextSegment {
  ref: string;
  he_text?: string;
  heText?: string;
  he?: string;
  en_text?: string;
  enText?: string;
  text?: string;
}

export const TraditionalTalmudDaf: React.FC<TraditionalTalmudDafProps> = ({
  dafRef,
  segments,
  onSegmentClick,
  onLexiconDoubleClick,
  sageHighlights: initialSageHighlights = [],
  conceptHighlights: initialConceptHighlights = [],
  isFullscreen = false,
  onToggleFullscreen,
  onDafChange,
  isAdmin = true
}) => {
  const [comments, setComments] = useState<TraditionalComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSegmentRef, setActiveSegmentRef] = useState<string | null>(null);
  const [activeCommentRef, setActiveCommentRef] = useState<string | null>(null);
  const [hoveredCommentRef, setHoveredCommentRef] = useState<string | null>(null);

  const [mobileTab, setMobileTab] = useState<'center' | 'left' | 'right'>('center');
  const [isBookshelfDrawerOpen, setIsBookshelfDrawerOpen] = useState(false);
  const [activeDrawerSide, setActiveDrawerSide] = useState<'left' | 'right'>('left');

  const [currentDafRef, setCurrentDafRef] = useState(dafRef);
  const [localSegments, setLocalSegments] = useState<TextSegment[]>([]);

  useEffect(() => {
    if (dafRef) {
      setCurrentDafRef(dafRef);
    }
  }, [dafRef]);

  const currentCategory = useMemo(() => {
    const parsed = parseRefSmart(currentDafRef || dafRef);
    if (!parsed) return 'default';
    if (parsed.type === 'talmud') return 'talmud';
    if (parsed.type === 'tanakh') return 'tanakh';
    if (parsed.book?.toLowerCase().includes('shulchan')) return 'shulchan_arukh_oc';
    if (parsed.book?.toLowerCase().includes('rambam') || parsed.book?.toLowerCase().includes('mishneh')) return 'rambam';
    return 'default';
  }, [currentDafRef, dafRef]);

  const readerConfig = useMemo(() => {
    return READER_CONFIG[currentCategory] || READER_CONFIG.default;
  }, [currentCategory]);

  const isTalmud = readerConfig.useTraditionalScript;

  const { commentaryOverrides, handleSetCommentatorOverride, handleResetCommentatorOverride } = useCommentaryOverrides(currentCategory);
  const { readComments, toggleReadComment } = useReadComments(currentDafRef);
  const {
    localSageHighlights,
    setLocalSageHighlights,
    localConceptHighlights,
    setLocalConceptHighlights,
    compiledSageHighlights,
    compiledConceptHighlights,
    sagesBySlug,
    conceptsBySlug,
  } = useHighlights(initialSageHighlights, initialConceptHighlights);

  const [isAdminMode, setIsAdminMode] = useState(false);
  const {
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
  } = useTextSelection(sagesBySlug, conceptsBySlug, setHoveredCommentRef, isAdminMode);

  const gemaraContainerRef = useRef<HTMLDivElement | null>(null);
  const gemaraRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const rashiRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tosafotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [commentFontSize, setCommentFontSize] = useState<'sm' | 'base' | 'lg' | 'xl'>(() => {
    return (localStorage.getItem('traditional-comment-font-size') as any) || 'base';
  });

  const handleIncreaseCommentFontSize = () => {
    const sizes: ('sm' | 'base' | 'lg' | 'xl')[] = ['sm', 'base', 'lg', 'xl'];
    const currentIdx = sizes.indexOf(commentFontSize);
    if (currentIdx < sizes.length - 1) {
      const next = sizes[currentIdx + 1];
      setCommentFontSize(next);
      localStorage.setItem('traditional-comment-font-size', next);
    }
  };

  const handleDecreaseCommentFontSize = () => {
    const sizes: ('sm' | 'base' | 'lg' | 'xl')[] = ['sm', 'base', 'lg', 'xl'];
    const currentIdx = sizes.indexOf(commentFontSize);
    if (currentIdx > 0) {
      const next = sizes[currentIdx - 1];
      setCommentFontSize(next);
      localStorage.setItem('traditional-comment-font-size', next);
    }
  };

  const displaySegments = useMemo(() => {
    const raw = (segments && segments.length > 0) ? segments : localSegments;
    const seen = new Set<string>();
    const unique: TextSegment[] = [];

    for (const item of raw) {
      if (!item || !item.ref) continue;
      const normKey = item.ref.replace(/[:\s,.]/g, '').toLowerCase();
      if (!seen.has(normKey)) {
        seen.add(normKey);
        unique.push(item);
      }
    }
    return unique;
  }, [segments, localSegments]);

  // Auto-select segment matching currentDafRef on load if no valid activeSegmentRef
  useEffect(() => {
    if (displaySegments && displaySegments.length > 0) {
      const isCurrentValid = activeSegmentRef && displaySegments.some(s => s.ref && isSameRef(s.ref, activeSegmentRef));
      if (!isCurrentValid) {
        const matchingRef = displaySegments.find(s => s.ref && isSameRef(s.ref, currentDafRef));
        setActiveSegmentRef(matchingRef ? matchingRef.ref : displaySegments[0].ref);
      }
    }
  }, [displaySegments, activeSegmentRef, currentDafRef]);

  const handleDafChange = useCallback((nextRef: string) => {
    if (!nextRef || nextRef === currentDafRef) return;
    setCurrentDafRef(nextRef);
    onDafChange?.(nextRef);
  }, [currentDafRef, onDafChange]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        handleDafChange(getPrevDafRef(currentDafRef));
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        handleDafChange(getNextDafRef(currentDafRef));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentDafRef, handleDafChange]);

  // Fetch comments based on READER_CONFIG (Talmud = whole page, Non-Talmud = exact segment)
  useEffect(() => {
    let active = true;
    const fallbackRef = currentDafRef || dafRef;

    const processCommentaryData = (commentaryItems: any[]) => {
      const parsedComments: TraditionalComment[] = [];

      for (const item of commentaryItems) {
        if (!item || (!item.he && !item.text)) continue;

        const rawCategory = (item.category || item.collectiveTitle?.en || item.index_title || '').toString();
        const refParts = (item.ref || '').split(' on ');
        const commentatorName = item.collectiveTitle?.en || rawCategory || (refParts.length > 1 ? refParts[0] : 'Commentary');

        const anchor = item.anchorRef || item.sourceRef || fallbackRef;
        const hebrew = Array.isArray(item.he) ? item.he.join('<br/>') : (typeof item.he === 'string' ? item.he : '');
        const english = Array.isArray(item.text) ? item.text.join('<br/>') : (typeof item.text === 'string' ? item.text : '');

        if ((hebrew && hebrew.trim()) || (english && english.trim())) {
          parsedComments.push({
            ref: item.ref || `${commentatorName} on ${anchor}`,
            anchorRef: anchor,
            commentator: commentatorName,
            he: hebrew || english,
            en: english,
          });
        }
      }
      setComments(parsedComments);
    };

    const fetchComments = async () => {
      setLoading(true);
      try {
        const rawRef = currentDafRef || dafRef || '';
        let targetRef = rawRef;
        let sefariaRef = '';

        if (readerConfig.loadCommentaryBy === 'daf') {
          // Talmud branch: strip segment number to whole amud (e.g. Berakhot 2a)
          const amudRef = rawRef.replace(/[:.]\d+.*$/, '').replace(/[:.]\d+$/, '').trim();
          sefariaRef = amudRef.replace(/\s+(?=\d+[ab]$)/i, '.').replace(/\s+/g, '_');
          targetRef = amudRef;
        } else {
          // Non-Talmud branch (Tanakh, Shulchan Arukh, Rambam): use specific passage ref
          targetRef = activeSegmentRef || rawRef;
          sefariaRef = targetRef.trim().replace(/\s+/g, '_').replace(/[:]/g, '.');
        }
        
        const processResponseData = (data: any) => {
          processCommentaryData(data.commentary || []);
          const heSource = data.he;
          const heArr = Array.isArray(heSource) ? heSource : (typeof heSource === 'string' ? [heSource] : []);

          if (heArr.length > 0) {
            const enSource = data.text || data.en;
            const enArr = Array.isArray(enSource) ? enSource : (typeof enSource === 'string' ? [enSource] : []);

            const fetchedSegments: TextSegment[] = heArr.map((heStr: string, idx: number) => {
              const segRef = (heArr.length === 1 && (targetRef.includes(':') || targetRef.includes('.')))
                ? targetRef
                : `${targetRef}:${idx + 1}`;
              return {
                ref: segRef,
                he_text: typeof heStr === 'string' ? heStr : '',
                heText: typeof heStr === 'string' ? heStr : '',
                en_text: typeof enArr[idx] === 'string' ? enArr[idx] : '',
                enText: typeof enArr[idx] === 'string' ? enArr[idx] : '',
                text: typeof enArr[idx] === 'string' ? enArr[idx] : '',
              };
            });
            setLocalSegments(fetchedSegments);
          }
        };

        const url = `https://www.sefaria.org/api/texts/${encodeURIComponent(sefariaRef)}?commentary=1&context=0&pad=0`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          processResponseData(data);
          return;
        }

        // Fallback fetch
        const fallbackUrl = `https://www.sefaria.org/api/texts/${encodeURIComponent(targetRef)}?commentary=1&context=0`;
        const res2 = await fetch(fallbackUrl);
        if (res2.ok) {
          const data2 = await res2.json();
          if (!active) return;
          processResponseData(data2);
        }
      } catch (err) {
        console.error('[TraditionalTalmudDaf] Error loading comments:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    void fetchComments();
    return () => {
      active = false;
    };
  }, [currentDafRef, dafRef, readerConfig.loadCommentaryBy, activeSegmentRef]);

  const [showVowels, setShowVowels] = useState(true);
  const [showPunctuation, setShowPunctuation] = useState(true);

  const [translationLang, setTranslationLang] = useState<'EN' | 'RU'>('EN');
  const [copiedGemara, setCopiedGemara] = useState(false);
  const [copyGemaraError, setCopyGemaraError] = useState<string | null>(null);
  const [copiedRashi, setCopiedRashi] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [tosafotViewMode, setTosafotViewMode] = useState<'tosafot' | 'translation'>('tosafot');

  const { translatedText, isTranslating, translate: triggerTranslate } = useTranslation({
    tref: activeSegmentRef || '',
  });

  useEffect(() => {
    if (activeSegmentRef && translationLang === 'RU') {
      void triggerTranslate();
    }
  }, [activeSegmentRef, translationLang, triggerTranslate]);

  const processText = useCallback((text: string) => {
    if (!text) return '';
    let result = text;
    if (!showVowels) {
      result = stripHebrewVowels(result);
    }
    if (!showPunctuation) {
      result = stripPunctuation(result);
    }
    return result;
  }, [showVowels, showPunctuation]);

  const commentsByAnchor = useMemo(() => {
    const map = new Map<string, TraditionalComment[]>();
    const normalize = (r: string) => (r || '').replace(/[:\s,.]/g, '').toLowerCase();
    for (let i = 0; i < comments.length; i++) {
      const c = comments[i];
      if (!c || !c.anchorRef) continue;
      const key = normalize(c.anchorRef);
      const existing = map.get(key);
      if (existing) {
        existing.push(c);
      } else {
        map.set(key, [c]);
      }
    }
    return map;
  }, [comments]);

  const renderedSegmentHtmls = useMemo(() => {
    const hasHighlights = compiledSageHighlights.length > 0 || compiledConceptHighlights.length > 0;
    const normalize = (r: string) => (r || '').replace(/[:\s,.]/g, '').toLowerCase();

    return displaySegments.map((segment, idx) => {
      const hebrewText = segment.he_text || segment.heText || segment.he || segment.text || '';
      const processed = processText(hebrewText);
      const key = normalize(segment.ref);
      const segmentComments = commentsByAnchor.get(key) || [];
      const withDh = segmentComments.length > 0 ? highlightDhInGemara(processed, segmentComments) : processed;
      const highlighted = hasHighlights ? renderHighlightedText(withDh, compiledSageHighlights, compiledConceptHighlights) : withDh;
      return `${highlighted}${idx < displaySegments.length - 1 ? ' ' : ''}`;
    });
  }, [displaySegments, commentsByAnchor, processText, compiledSageHighlights, compiledConceptHighlights]);

  useEffect(() => {
    const container = gemaraContainerRef.current;
    if (!container) return;
    const dhSpans = container.querySelectorAll('.highlight-dh');
    dhSpans.forEach(span => {
      const el = span as HTMLElement;
      const refs = (el.dataset.commentRef || '').split('|');
      if (
        (activeCommentRef && refs.includes(activeCommentRef)) ||
        (hoveredCommentRef && refs.includes(hoveredCommentRef))
      ) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }, [activeCommentRef, hoveredCommentRef]);

  // Admin modals state
  const [showSageModal, setShowSageModal] = useState(false);
  const [showCreateSageModal, setShowCreateSageModal] = useState(false);
  const [createSageInitialName, setCreateSageInitialName] = useState('');
  const [showConceptModal, setShowConceptModal] = useState(false);

  const handleLinkSage = async (sageSlug: string) => {
    if (!selectionMenu?.selectedText) return;
    const rawText = selectionMenu.selectedText;
    const ok = await addSageMapping(sageSlug, rawText);
    if (ok) {
      const updated = await fetchSageHighlights();
      if (updated && updated.length > 0) {
        setLocalSageHighlights(updated);
      } else {
        const escaped = escapeRegExp(rawText);
        setLocalSageHighlights(prev => {
          return prev.map(s => {
            if (s.slug === sageSlug) {
              return { ...s, regex_pattern: s.regex_pattern ? `${s.regex_pattern}|${escaped}` : escaped };
            }
            return s;
          });
        });
      }
    }
    setShowSageModal(false);
    setSelectionMenu(null);
  };

  const handleCreateAndLinkSage = async (name: string, period: string, periodRu: string) => {
    if (!name.trim() || !selectionMenu?.selectedText) return;
    const rawText = selectionMenu.selectedText;
    const created = await createSageProfile({
      name: name.trim(),
      period: period,
      period_ru: periodRu,
    });
    if (created && created.slug) {
      await addSageMapping(created.slug, rawText);
      const updated = await fetchSageHighlights();
      if (updated && updated.length > 0) {
        setLocalSageHighlights(updated);
      } else {
        const escaped = escapeRegExp(rawText);
        setLocalSageHighlights(prev => [
          ...prev,
          {
            slug: created.slug!,
            name_he: name.trim(),
            period: period,
            period_label_ru: periodRu,
            regex_pattern: escaped,
          }
        ]);
      }
    }
    setShowCreateSageModal(false);
    setSelectionMenu(null);
  };

  const handleLinkConcept = async (conceptSlug: string) => {
    if (!selectionMenu?.selectedText) return;
    const rawText = selectionMenu.selectedText;
    const ok = await addConceptMapping(conceptSlug, rawText);
    if (ok) {
      setLocalConceptHighlights(prev => {
        return prev.map(c => {
          if (c.slug === conceptSlug) {
            const patterns = [...(c.search_patterns || [])];
            if (!patterns.includes(rawText)) patterns.push(rawText);
            return { ...c, search_patterns: patterns };
          }
          return c;
        });
      });
    }
    setShowConceptModal(false);
    setSelectionMenu(null);
  };

  const handleSaveConcept = async (termHe: string, pattern: string, summary: string) => {
    if (!termHe.trim() || !pattern.trim()) return;
    const cleanTermHe = DOMPurify.sanitize(termHe.trim());
    const cleanSummaryText = DOMPurify.sanitize(summary.trim());
    const summaryHtml = cleanSummaryText ? `<p>${cleanSummaryText}</p>` : `<p>${cleanTermHe}</p>`;
    const ok = await addCustomConcept(termHe.trim(), pattern.trim(), summaryHtml);
    if (ok) {
      const cleanTerm = cleanTermHe.replace(/\s+/g, '-');
      const slug = `custom-${cleanTerm}`;
      setLocalConceptHighlights(prev => [
        ...prev,
        {
          slug,
          term_he: cleanTermHe,
          search_patterns: [pattern.trim()],
          short_summary_html: summaryHtml,
        }
      ]);
    }
    setShowConceptModal(false);
    setSelectionMenu(null);
  };

  const activeSegmentData = useMemo(() => {
    if (!activeSegmentRef) return null;
    return displaySegments.find(s => s && isSameRef(s.ref, activeSegmentRef));
  }, [activeSegmentRef, displaySegments]);

  const isHebrewText = useCallback((str?: string): boolean => {
    if (!str) return false;
    return /[\u0590-\u05FF]/.test(str);
  }, []);

  const activeHebrewText = useMemo(() => {
    if (!activeSegmentData) return '';
    if (activeSegmentData.he_text) return activeSegmentData.he_text;
    if (activeSegmentData.heText) return activeSegmentData.heText;
    if (isHebrewText(activeSegmentData.text)) return activeSegmentData.text;
    if (isHebrewText((activeSegmentData as any).he)) return (activeSegmentData as any).he;
    return '';
  }, [activeSegmentData, isHebrewText]);

  const activeEnglishText = useMemo(() => {
    if (!activeSegmentData) return null;
    if (activeSegmentData.en_text && !isHebrewText(activeSegmentData.en_text)) return activeSegmentData.en_text;
    if (activeSegmentData.enText && !isHebrewText(activeSegmentData.enText)) return activeSegmentData.enText;
    if (activeSegmentData.text && !isHebrewText(activeSegmentData.text)) return activeSegmentData.text;
    if ((activeSegmentData as any).en && !isHebrewText((activeSegmentData as any).en)) return (activeSegmentData as any).en;
    return null;
  }, [activeSegmentData, isHebrewText]);

  const handleCopySegment = async () => {
    setCopyGemaraError(null);
    if (!activeSegmentData) {
      setCopyGemaraError("Нет выделенного фрагмента");
      return;
    }
    
    try {
      const stripHtml = (html: string) => {
        if (!html) return "";
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          return doc.body.textContent || "";
        } catch (e) {
          return String(html);
        }
      };

      const hebrew = stripHtml(activeHebrewText || activeSegmentData.he_text || activeSegmentData.heText || '');
      const translationHtml = translationLang === 'EN' ? activeEnglishText : translatedText;
      const translation = stripHtml(translationHtml || '');
      
      const textToCopy = `Оригинал (${activeSegmentRef}):\n${hebrew}\n\nПеревод (${translationLang}):\n${translation || 'Недоступен'}`;
      
      const success = await copyToClipboard(textToCopy);
      if (success) {
        setCopiedGemara(true);
        setTimeout(() => setCopiedGemara(false), 1500);
      } else {
        setCopyGemaraError("Ошибка буфера обмена");
      }
    } catch (err: any) {
      setCopyGemaraError(err?.message || "Ошибка при копировании");
    }
  };

  const handleCopyRashi = async () => {
    setCopyError(null);
    if (!activeSegmentRef) {
      setCopyError("Нет выделенного фрагмента");
      return;
    }

    try {
      const segmentRashi = comments.filter(
        c => c && isSameRef(c.anchorRef, activeSegmentRef) && c.commentator?.toLowerCase().includes('rashi')
      );

      if (segmentRashi.length === 0) {
        setCopyError("Нет комментариев Раши для этого фрагмента");
        return;
      }

      const stripHtml = (html: string) => {
        if (!html) return "";
        try {
          const doc = new DOMParser().parseFromString(html, 'text/html');
          return doc.body.textContent || "";
        } catch (e) {
          return String(html);
        }
      };

      const formattedComments = segmentRashi.map((comment, index) => {
        const heText = comment.he || "";
        const { dh, restHtml } = parseCommentDh(heText);
        const hebrewText = dh ? `${dh} ${stripHtml(restHtml)}` : stripHtml(heText);
        
        let entry = `${index + 1}. ${hebrewText}`;
        if (typeof comment.en === 'string' && comment.en.trim() && comment.en !== heText) {
          entry += `\n   Translation: ${stripHtml(comment.en)}`;
        }
        return entry;
      });

      const textToCopy = `Комментарии Раши (${activeSegmentRef}):\n${formattedComments.join('\n\n')}`;

      const success = await copyToClipboard(textToCopy);
      if (success) {
        setCopiedRashi(true);
        setTimeout(() => setCopiedRashi(false), 1500);
      } else {
        setCopyError("Ошибка буфера обмена");
      }
    } catch (err: any) {
      setCopyError(err?.message || "Ошибка при копировании");
    }
  };

  const renderTranslationView = () => {
    if (!activeSegmentRef) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 p-6 text-center">
          <Languages className="w-8 h-8 mb-4" />
          <p>Выберите фрагмент текста, чтобы увидеть его перевод.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-muted/10 p-4 font-sans" dir="ltr">
        <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
           <span className="text-xs font-bold text-primary uppercase tracking-widest">{activeSegmentRef}</span>
        </div>
        
        <div 
          className="text-foreground text-base md:text-lg leading-relaxed selection:bg-primary/30"
          onDoubleClick={() => {
            const word = window.getSelection()?.toString() || '';
            const context = translationLang === 'EN' ? (activeEnglishText || '') : (translatedText || '');
            onLexiconDoubleClick?.(word, context);
          }}
        >
          {translationLang === 'EN' 
            ? (activeEnglishText ? <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(activeEnglishText) }} /> : 
                <span className="opacity-50 italic">English translation is currently unavailable.</span>) 
            : (isTranslating ? 
                <div className="flex flex-col items-center gap-4 py-6 opacity-60 italic">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm">Переводим...</span>
                </div> 
                : (translatedText ? <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(translatedText) }} /> : <span className="opacity-50 italic">Russian translation not available.</span>))
          }
        </div>
      </div>
    );
  };

  const isAmudA = useMemo(() => {
    return (currentDafRef || dafRef || '').toLowerCase().endsWith('a');
  }, [currentDafRef, dafRef]);

  const defaultSet = DEFAULT_COMMENTARY_SETS[currentCategory] || DEFAULT_COMMENTARY_SETS.default;
  const currentCategoryOverride = commentaryOverrides[currentCategory];

  const leftTitle = currentCategoryOverride?.left || (currentCategory === 'talmud' ? (isAmudA ? 'Tosafot' : 'Rashi') : defaultSet.left);
  const rightTitle = currentCategoryOverride?.right || (currentCategory === 'talmud' ? (isAmudA ? 'Rashi' : 'Tosafot') : defaultSet.right);

  const isLeftOverridden = Boolean(currentCategoryOverride?.left);
  const isRightOverridden = Boolean(currentCategoryOverride?.right);

  const handleOpenBookshelfDrawer = useCallback((side: 'left' | 'right') => {
    setActiveDrawerSide(side);
    setIsBookshelfDrawerOpen(true);
  }, []);

  const matchCommentator = useCallback((comment: TraditionalComment, targetTitle: string) => {
    if (!comment || !targetTitle) return false;
    const target = targetTitle.toLowerCase().trim();

    if (target === 'commentary' || target === 'комментарий' || target === 'все' || target === 'all') return true;

    const cName = (comment.commentator || '').toLowerCase().trim();
    const refName = (comment.ref || '').toLowerCase().trim();

    if (target.includes('rashi') || target.includes('רש"י')) return cName.includes('rashi') || refName.includes('rashi');
    if (target.includes('tosafot') || target.includes('תוספ')) return cName.includes('tosafot') || refName.includes('tosafot');
    if (target.includes('ibn ezra') || target.includes('אבן עזרא')) return cName.includes('ezra') || refName.includes('ezra');
    if (target.includes('ramban') || target.includes('רמב"ן')) return cName.includes('ramban') || refName.includes('ramban') || cName.includes('nachmanides');
    if (target.includes('ralbag') || target.includes('רלב"ג')) return cName.includes('ralbag') || refName.includes('ralbag') || cName.includes('gersonides');
    if (target.includes('sforno') || target.includes('ספורנו')) return cName.includes('sforno') || refName.includes('sforno');
    if (target.includes('rashbam') || target.includes('רשב"ם')) return cName.includes('rashbam') || refName.includes('rashbam');
    if (target.includes('radak') || target.includes('רד"ק')) return cName.includes('radak') || refName.includes('radak') || cName.includes('kimhi');
    if (target.includes('metzudat') || target.includes('מצודת')) return cName.includes('metzudat') || refName.includes('metzudat');
    if (target.includes('taz') || target.includes('טורי זהב')) return cName.includes('taz') || cName.includes('turei') || refName.includes('taz');
    if (target.includes('shach') || target.includes('שפתי כהן')) return cName.includes('shach') || cName.includes('siftei') || refName.includes('shach');

    const cleanTarget = target.replace(/[^a-z0-9]/gi, '');
    const cleanCName = cName.replace(/[^a-z0-9]/gi, '');
    const cleanRefName = refName.replace(/[^a-z0-9]/gi, '');

    return (cleanCName.length > 0 && (cleanCName.includes(cleanTarget) || cleanTarget.includes(cleanCName))) ||
           (cleanRefName.length > 0 && cleanRefName.includes(cleanTarget));
  }, []);

  const leftColumn = useMemo(() => {
    const raw = comments.filter(c => matchCommentator(c, leftTitle));
    if (raw.length > 0) return raw;
    return comments;
  }, [comments, leftTitle, matchCommentator]);

  const rightColumn = useMemo(() => {
    const raw = comments.filter(c => matchCommentator(c, rightTitle));
    if (raw.length > 0) return raw;
    return comments;
  }, [comments, rightTitle, matchCommentator]);

  const handleGemaraClick = (e: React.MouseEvent, ref: string) => {
    setActiveSegmentRef(ref);
    onSegmentClick?.(ref);

    const dhSpan = (e.target as HTMLElement).closest('.highlight-dh');
    if (dhSpan) {
      const commentRefAttr = dhSpan.getAttribute('data-comment-ref');
      if (commentRefAttr) {
        const refs = commentRefAttr.split('|');
        setActiveCommentRef(refs[0]);
        for (const r of refs) {
          const elRashi = rashiRefs.current[r];
          if (elRashi) {
            elRashi.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
          const elTosafot = tosafotRefs.current[r];
          if (elTosafot) {
            elTosafot.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
      }
    }
  };

  return (
    <div 
      className="flex flex-col h-full bg-background text-foreground overflow-hidden relative"
      onClickCapture={handleHighlightClick}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Global Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 bg-card border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary mr-1" />
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Предыдущий амуд"
            title="Предыдущий амуд (Alt + ←)"
            onClick={() => handleDafChange(getPrevDafRef(currentDafRef))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <h2 className="text-lg font-bold font-vilna px-1">{currentDafRef}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            aria-label="Следующий амуд"
            title="Следующий амуд (Alt + →)"
            onClick={() => handleDafChange(getNextDafRef(currentDafRef))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className={cn("h-7 px-2 text-xs font-medium gap-1", isAdminMode ? "bg-amber-500/20 text-amber-600 dark:text-amber-400" : "opacity-60")}
              onClick={() => {
                setIsAdminMode(!isAdminMode);
                setSelectionMenu(null);
              }}
              title="Админ-режим: связывание мудрецов и фраз"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Админ-маппинг</span>
            </Button>
          )}

          <div className="flex items-center bg-muted/60 dark:bg-muted/40 border border-border/40 rounded-lg p-0.5 gap-0.5">
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2 text-xs transition-colors", !showVowels ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground")} 
              onClick={() => setShowVowels(!showVowels)}
              aria-label="Огласовки"
              title="Vowels (Огласовки)"
            >
              <Type className={cn("w-3.5 h-3.5", showVowels ? "opacity-50" : "text-primary")} />
            </Button>
            
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2 text-xs transition-colors", !showPunctuation ? "bg-primary/20 text-primary font-semibold" : "text-muted-foreground hover:text-foreground")} 
              onClick={() => setShowPunctuation(!showPunctuation)}
              aria-label="Пунктуация"
              title="Punctuation (Пунктуация)"
            >
              <Quote className={cn("w-3.5 h-3.5", showPunctuation ? "opacity-50" : "text-primary")} />
            </Button>
          </div>

          <div className="flex items-center bg-muted/60 dark:bg-muted/40 border border-border/40 rounded-lg p-0.5 gap-0.5" title="Размер шрифта комментариев">
            <Button 
              variant="ghost" size="sm" 
              className="h-7 w-7 px-0 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30" 
              disabled={commentFontSize === 'sm'}
              onClick={handleDecreaseCommentFontSize}
              aria-label="Уменьшить шрифт"
              title="Уменьшить шрифт комментариев"
            >
              A-
            </Button>
            <span className="text-[10px] uppercase font-bold px-1 text-muted-foreground/70 select-none">
              {commentFontSize}
            </span>
            <Button 
              variant="ghost" size="sm" 
              className="h-7 w-7 px-0 text-xs font-bold text-muted-foreground hover:text-foreground disabled:opacity-30" 
              disabled={commentFontSize === 'xl'}
              onClick={handleIncreaseCommentFontSize}
              aria-label="Увеличить шрифт"
              title="Увеличить шрифт комментариев"
            >
              A+
            </Button>
          </div>

          <div className="flex items-center bg-muted/60 dark:bg-muted/40 border border-border/40 rounded-lg p-0.5 gap-0.5">
             <button 
                className={cn("h-7 px-2.5 text-xs rounded-md font-bold transition-all", 
                  translationLang === 'EN' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTranslationLang('EN')}
              >EN</button>
               <button 
                className={cn("h-7 px-2.5 text-xs rounded-md font-bold transition-all", 
                  translationLang === 'RU' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTranslationLang('RU')}
              >RU</button>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground transition-all"
            onClick={onToggleFullscreen}
            aria-label="Полноэкранный режим"
            title={isFullscreen ? "Выйти из полноэкранного режима" : "Во весь экран"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4 text-primary animate-in fade-in duration-200" />
            ) : (
              <Maximize2 className="w-4 h-4 opacity-70" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation Tabs (< 768px) */}
      <div className="md:hidden flex border-b border-border/40 bg-muted/20 text-xs flex-shrink-0">
        <button
          className={cn("flex-1 py-2 font-bold text-center transition-colors border-b-2", 
            mobileTab === 'left' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground")}
          onClick={() => setMobileTab('left')}
        >
          {leftTitle}
        </button>
        <button
          className={cn("flex-1 py-2 font-bold text-center transition-colors border-b-2", 
            mobileTab === 'center' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground")}
          onClick={() => setMobileTab('center')}
        >
          Текст
        </button>
        <button
          className={cn("flex-1 py-2 font-bold text-center transition-colors border-b-2", 
            mobileTab === 'right' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground")}
          onClick={() => setMobileTab('right')}
        >
          {rightTitle}
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden p-0 gap-0 flex-col md:flex-row">
        {/* Left Column */}
        <div className={cn("w-full md:w-[28%] lg:w-[320px] xl:w-[350px] flex-shrink-0 flex flex-col h-full min-w-0", mobileTab !== 'left' && "hidden md:flex")}>
          <CommentaryColumn
            side="left"
            title={leftTitle}
            comments={leftColumn}
            refsMap={leftTitle === 'Rashi' ? rashiRefs : tosafotRefs}
            tosafotViewMode={tosafotViewMode}
            setTosafotViewMode={setTosafotViewMode}
            renderTranslationView={renderTranslationView}
            loading={loading}
            activeSegmentRef={activeSegmentRef}
            activeCommentRef={activeCommentRef}
            hoveredCommentRef={hoveredCommentRef}
            commentFontSize={commentFontSize}
            readComments={readComments}
            copyError={copyError}
            copiedRashi={copiedRashi}
            handleCopyRashi={handleCopyRashi}
            setActiveCommentRef={setActiveCommentRef}
            setActiveSegmentRef={setActiveSegmentRef}
            onSegmentClick={onSegmentClick}
            setHoveredCommentRef={setHoveredCommentRef}
            toggleReadComment={toggleReadComment}
            onLexiconDoubleClick={onLexiconDoubleClick}
            onOpenBookshelfDrawer={handleOpenBookshelfDrawer}
            isOverridden={isLeftOverridden}
            onResetDefault={handleResetCommentatorOverride}
            useTraditionalScript={readerConfig.useTraditionalScript}
          />
        </div>

        {/* Center Column */}
        <div 
          ref={gemaraContainerRef}
          className={cn("w-full md:flex-1 flex flex-col bg-card/20 overflow-hidden relative h-full", mobileTab !== 'center' && "hidden md:flex")}
          onMouseOver={handleHighlightMouseOver}
          onMouseOut={handleHighlightMouseOut}
          onMouseUp={handleGemaraMouseUp}
        >
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/10 min-h-[37px]">
            <div className="w-6" />
            <span className="font-bold opacity-30 uppercase text-[10px] tracking-widest">
              {isTalmud ? 'Gemara' : 'Text'}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all",
                copyGemaraError && "text-red-500 hover:text-red-600"
              )}
              disabled={!activeSegmentRef}
              onClick={handleCopySegment}
              aria-label="Скопировать текст"
              title={copyGemaraError || (activeSegmentRef ? "Скопировать текст (оригинал и перевод)" : "Выберите фрагмент текста")}
            >
              {copiedGemara ? (
                <Check className="w-3.5 h-3.5 text-green-500 animate-in fade-in duration-200" />
              ) : copyGemaraError ? (
                <span className="text-[10px] text-red-500 font-bold font-sans">!</span>
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
          <div className="flex-1 px-4 py-6 overflow-y-auto hide-scrollbar">
            {isTalmud ? (
              <div className="w-full max-w-[32ch] mx-auto text-right font-vilna text-2xl md:text-3xl leading-[2.2] md:leading-[1.6] lg:leading-[1.6] text-justify tracking-wide" style={{ textAlignLast: 'right' }} dir="rtl">
                {displaySegments.map((segment, idx) => {
                  const isActive = isSameRef(activeSegmentRef || '', segment.ref);
                  const htmlToRender = renderedSegmentHtmls[idx] || '';

                  return (
                    <span 
                      key={segment.ref}
                      ref={el => gemaraRefs.current[segment.ref] = el}
                      className={cn(
                        "cursor-pointer transition-all duration-300 select-text",
                        activeSegmentRef 
                          ? (isActive ? "opacity-100 bg-primary/[0.05] rounded-sm" : "text-stone-400 dark:text-stone-500 opacity-80")
                          : "opacity-100 hover:bg-primary/5 rounded-sm"
                      )}
                      onClick={(e) => handleGemaraClick(e, segment.ref)}
                      onDoubleClick={() => {
                        const word = window.getSelection()?.toString() || '';
                        const hebrewText = segment.he_text || segment.heText || '';
                        const context = processText(hebrewText);
                        onLexiconDoubleClick?.(word, context);
                      }}
                      dangerouslySetInnerHTML={{ __html: htmlToRender }}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-4 font-sans">
                {displaySegments.map((segment, idx) => {
                  const isActive = isSameRef(activeSegmentRef || '', segment.ref);
                  const segmentNum = segment.ref.split(/[:.]/).pop() || `${idx + 1}`;
                  const hebrewText = segment.he_text || segment.heText || segment.he || '';

                  return (
                    <div
                      key={segment.ref || idx}
                      ref={el => gemaraRefs.current[segment.ref] = el as any}
                      className={cn(
                        "p-5 rounded-2xl border transition-all duration-200 cursor-pointer relative group space-y-3",
                        isActive
                          ? "bg-primary/10 border-primary shadow-md ring-1 ring-primary/30"
                          : "bg-card/60 border-border/50 hover:bg-muted/40 hover:border-border"
                      )}
                      onClick={(e) => handleGemaraClick(e, segment.ref)}
                      onDoubleClick={() => {
                        const word = window.getSelection()?.toString() || '';
                        onLexiconDoubleClick?.(word, hebrewText);
                      }}
                    >
                      <div className="flex items-center justify-between border-b border-border/30 pb-2">
                        <span className="text-[11px] font-bold font-mono px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          Отрывок {segmentNum}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">{segment.ref}</span>
                      </div>

                      <p 
                        dir="rtl" 
                        className="text-right font-tanakh font-semibold text-2xl sm:text-3xl leading-relaxed text-foreground select-text tracking-normal"
                        dangerouslySetInnerHTML={{ __html: renderedSegmentHtmls[idx] || hebrewText }}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Selection Context Popover Menu for Admin */}
          {selectionMenu && (
            <div
              className="absolute z-40 bg-popover text-popover-foreground shadow-lg border border-border rounded-lg p-1.5 flex items-center gap-1 font-sans text-xs animate-in fade-in zoom-in-95 duration-150"
              style={{
                left: Math.max(10, Math.min(selectionMenu.x, 300)),
                top: Math.max(10, selectionMenu.y - 45),
                transform: 'translateX(-50%)',
              }}
            >
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs font-medium gap-1 hover:bg-amber-500/10 hover:text-amber-600"
                onClick={() => setShowSageModal(true)}
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-500" />
                <span>Связать с мудрецом</span>
              </Button>
              <div className="w-px h-4 bg-border/60" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs font-medium gap-1 hover:bg-blue-500/10 hover:text-blue-600"
                onClick={() => setShowConceptModal(true)}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                <span>Фраза [WILD]</span>
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 opacity-50 hover:opacity-100"
                onClick={() => setSelectionMenu(null)}
              >
                <X className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        {/* Right Column */}
        <div className={cn("w-full md:w-[28%] lg:w-[320px] xl:w-[350px] flex-shrink-0 flex flex-col h-full min-w-0", mobileTab !== 'right' && "hidden md:flex")}>
          <CommentaryColumn
            side="right"
            title={rightTitle}
            comments={rightColumn}
            refsMap={rightTitle === 'Rashi' ? rashiRefs : tosafotRefs}
            tosafotViewMode={tosafotViewMode}
            setTosafotViewMode={setTosafotViewMode}
            renderTranslationView={renderTranslationView}
            loading={loading}
            activeSegmentRef={activeSegmentRef}
            activeCommentRef={activeCommentRef}
            hoveredCommentRef={hoveredCommentRef}
            commentFontSize={commentFontSize}
            readComments={readComments}
            copyError={copyError}
            copiedRashi={copiedRashi}
            handleCopyRashi={handleCopyRashi}
            setActiveCommentRef={setActiveCommentRef}
            setActiveSegmentRef={setActiveSegmentRef}
            onSegmentClick={onSegmentClick}
            setHoveredCommentRef={setHoveredCommentRef}
            toggleReadComment={toggleReadComment}
            onLexiconDoubleClick={onLexiconDoubleClick}
            onOpenBookshelfDrawer={handleOpenBookshelfDrawer}
            isOverridden={isRightOverridden}
            onResetDefault={handleResetCommentatorOverride}
            useTraditionalScript={readerConfig.useTraditionalScript}
          />
        </div>
      </div>

      <SageSearchModal
        isOpen={showSageModal}
        onClose={() => setShowSageModal(false)}
        selectedText={selectionMenu?.selectedText}
        sages={localSageHighlights}
        onLinkSage={handleLinkSage}
        onCreateNewSageClick={() => {
          setShowSageModal(false);
          setCreateSageInitialName(selectionMenu?.selectedText || '');
          setShowCreateSageModal(true);
        }}
      />

      <CreateSageModal
        isOpen={showCreateSageModal}
        onClose={() => setShowCreateSageModal(false)}
        initialName={createSageInitialName}
        onCreateAndLink={handleCreateAndLinkSage}
      />

      <ConceptModal
        isOpen={showConceptModal}
        onClose={() => setShowConceptModal(false)}
        selectedText={selectionMenu?.selectedText}
        concepts={localConceptHighlights}
        onLinkConcept={handleLinkConcept}
        onSaveConcept={handleSaveConcept}
      />

      <HoverCard hoverCard={hoverCard} />

      <BookshelfDrawer
        isOpen={isBookshelfDrawerOpen}
        onClose={() => setIsBookshelfDrawerOpen(false)}
        activeSide={activeDrawerSide}
        currentDafRef={currentDafRef}
        onSelectCommentator={(side, name) => handleSetCommentatorOverride(side, name)}
      />

      <ProfileInspectorModal
        slug={profileModalSlug}
        open={Boolean(profileModalSlug)}
        onClose={() => setProfileModalSlug(null)}
        hideWorkSection
      />
    </div>
  );
};

export default TraditionalTalmudDaf;
