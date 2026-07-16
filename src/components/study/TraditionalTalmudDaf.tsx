import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  BookOpen, 
  Languages, 
  Type,
  Quote,
  Loader2,
  X,
  Copy,
  Maximize2,
  Check,
  Minimize2
} from 'lucide-react';
import { api } from '../../services/api';
import { stripHebrewVowels, stripPunctuation } from '../../utils/hebrewUtils';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SageHighlight, ConceptHighlight } from '../../types/highlight';
import ProfileInspectorModal from './ProfileInspectorModal';

export const parseCommentDh = (hebrewHtml: string) => {
  let dh = '';
  let restHtml = hebrewHtml || '';
  
  const boldMatch = restHtml.match(/^(?:<br\s*\/?>|\s)*<(b|strong)>(.*?)<\/\1>/i);
  if (boldMatch) {
    dh = boldMatch[2].trim();
    restHtml = restHtml.substring(boldMatch[0].length).trim();
  } else {
    const strippedHtml = restHtml.replace(/<\/?b>/gi, '').replace(/<\/?strong>/gi, '');
    const match = strippedHtml.match(/^(.*?)([-–—\.])(.*)$/s);
    if (match && match[1].length < 150) {
      dh = match[1].trim() + match[2];
      restHtml = match[3].trim();
    } else {
      restHtml = strippedHtml;
    }
  }
  return { dh, restHtml };
};

interface TraditionalComment {
  ref: string;
  anchorRef: string;
  commentator: string;
  he: string;
  en: string;
  dh?: string;
}

type CompiledSageHighlight = SageHighlight & { regex: RegExp };
type CompiledConceptHighlight = ConceptHighlight & { regexes: RegExp[] };

// Helper to compare refs flexibly (ignoring dots, colons, spaces, dashes)
const isSameRef = (ref1: string, ref2: string) => {
  if (!ref1 || !ref2) return false;
  const normalize = (r: string) => r.replace(/[:\s,.-]/g, '').toLowerCase();
  return normalize(ref1) === normalize(ref2);
};

// Robust helper to copy text to clipboard with modern API and textarea fallback
const copyToClipboard = async (text: string): Promise<boolean> => {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('[TraditionalTalmudDaf] Clipboard API failed, trying fallback:', e);
    }
  }

  // Fallback method 1: Textarea copy
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  textArea.setAttribute("readonly", "");
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    if (successful) return true;
  } catch (err) {
    console.error('[TraditionalTalmudDaf] Fallback copy failed:', err);
    document.body.removeChild(textArea);
  }

  // Fallback method 2: Prompt dialog
  try {
    window.prompt("Копирование заблокировано браузером. Скопируйте текст вручную (Ctrl+C):", text);
    return true;
  } catch (e) {
    console.error('[TraditionalTalmudDaf] Prompt fallback failed:', e);
    return false;
  }
};

// Helper to escape attributes in span HTML
const escapeAttr = (value: string) => (value || '').replace(/"/g, '&quot;');

// Replace patterns in text but not inside HTML tags
const replaceOutsideTags = (html: string, regex: RegExp, replacer: (match: string) => string) => {
  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i].startsWith('<')) continue;
    regex.lastIndex = 0; // Reset state for global regexes
    parts[i] = parts[i].replace(regex, replacer);
  }
  return parts.join('');
};

const renderHighlightedText = (
  text: string,
  sages: CompiledSageHighlight[] = [],
  concepts: CompiledConceptHighlight[] = [],
) => {
  let html = text || '';

  for (const sage of sages) {
    const periodRaw = (sage.period || 'sage').toLowerCase();
    const periodBase = periodRaw.split('_')[0] || 'sage';
    const colorClass = `highlight-sage-${periodBase}`;
    html = replaceOutsideTags(html, sage.regex, (match) => {
      return `<span class="highlight-sage ${colorClass} hover-target" data-entity-type="sage" data-slug="${escapeAttr(sage.slug)}">${match}</span>`;
    });
  }

  for (const concept of concepts) {
    for (const rx of concept.regexes || []) {
      html = replaceOutsideTags(html, rx, (match) => {
        return `<span class="highlight-concept hover-target" data-entity-type="concept" data-slug="${escapeAttr(concept.slug)}">${match}</span>`;
      });
    }
  }

  return html;
};

export const buildHebrewFuzzyRegex = (phrase: string): RegExp | null => {
  const clean = stripPunctuation(stripHebrewVowels(phrase))
    .replace(/\s+/g, ' ')
    .trim();
  if (!clean || clean.length < 2) return null;

  const words = clean.split(' ');
  const escapedWords = words.map(word => {
    return Array.from(word)
      .map(char => {
        if (char >= '\u05D0' && char <= '\u05EA') {
          return `${char}[\u05B0-\u05C7]*`;
        }
        return char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      })
      .join('');
  });

  const separator = `[\\s\\u200E\\u200F"'\\"().,!?;:\\-\\[\\]{}]*`;
  const pattern = escapedWords.join(separator);
  try {
    return new RegExp(pattern, 'g');
  } catch (e) {
    return null;
  }
};

export const highlightDhInGemara = (
  text: string,
  commentsForSegment: TraditionalComment[]
) => {
  let result = text;
  
  const sortedComments = [...commentsForSegment]
    .map(c => {
      const { dh } = parseCommentDh(c.he);
      return { comment: c, dh };
    })
    .filter(item => item.dh && item.dh.trim().length > 1)
    .sort((a, b) => b.dh.length - a.dh.length);

  for (const item of sortedComments) {
    const rx = buildHebrewFuzzyRegex(item.dh);
    if (!rx) continue;

    result = replaceOutsideTags(result, rx, (match) => {
      const isRashi = item.comment.commentator.toLowerCase().includes('rashi');
      const commentatorClass = isRashi ? 'dh-rashi' : 'dh-tosafot';
      return `<span class="highlight-dh ${commentatorClass}" data-comment-ref="${escapeAttr(item.comment.ref)}">${match}</span>`;
    });
  }
  
  return result;
};

interface TraditionalTalmudDafProps {
  dafRef: string;
  segments: any[];
  onSegmentClick?: (ref: string) => void;
  onLexiconDoubleClick?: (word: string, context?: string) => void;
  sageHighlights?: SageHighlight[];
  conceptHighlights?: ConceptHighlight[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

export const TraditionalTalmudDaf: React.FC<TraditionalTalmudDafProps> = ({
  dafRef,
  segments,
  onSegmentClick,
  onLexiconDoubleClick,
  sageHighlights = [],
  conceptHighlights = [],
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const [comments, setComments] = useState<TraditionalComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSegmentRef, setActiveSegmentRef] = useState<string | null>(null);

  console.log('[TraditionalTalmudDaf] Props & States:', {
    dafRef,
    segmentsCount: segments?.length,
    sageHighlightsCount: sageHighlights?.length,
    conceptHighlightsCount: conceptHighlights?.length,
    commentsCount: comments?.length,
    activeSegmentRef,
  });
  
  // Control States
  const [showVowels, setShowVowels] = useState(true);
  const [showPunctuation, setShowPunctuation] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLang, setTranslationLang] = useState<'EN' | 'RU'>('EN');
  
  // Tosafot Column State
  const [tosafotViewMode, setTosafotViewMode] = useState<'tosafot' | 'translation'>('tosafot');

  const [copiedGemara, setCopiedGemara] = useState(false);
  const [copiedRashi, setCopiedRashi] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [copyGemaraError, setCopyGemaraError] = useState<string | null>(null);

  const [highlightedCommentRef, setHighlightedCommentRef] = useState<string | null>(null);

  const [hoverCard, setHoverCard] = useState<{
    slug: string;
    type: 'sage' | 'concept';
    x: number;
    y: number;
    summary?: string | null;
    label?: string | null;
  } | null>(null);
  const [profileModalSlug, setProfileModalSlug] = useState<string | null>(null);

  const compiledSageHighlights = useMemo(() => {
    const allowed = new Set(['zugot', 'tannaim', 'amoraim']);
    const sorted = [...(sageHighlights || [])].sort((a, b) => {
      const lenA = (a.name_he || a.slug || '').length;
      const lenB = (b.name_he || b.slug || '').length;
      return lenB - lenA;
    });
    const compiled: CompiledSageHighlight[] = [];
    for (const item of sorted) {
      if (!item?.regex_pattern || !item.slug) continue;
      try {
        const periodRaw = (item.period || '').toLowerCase();
        const periodBase = (periodRaw.split('_')[0] || periodRaw || 'sage').trim();
        if (periodBase && !allowed.has(periodBase)) {
          continue;
        }
        const regex = new RegExp(item.regex_pattern, 'gu');
        compiled.push({ ...item, period: periodRaw || periodBase, regex });
      } catch (err) {
        console.warn('[TraditionalTalmudDaf] Invalid sage regex', err);
      }
    }
    return compiled;
  }, [sageHighlights]);

  const compiledConceptHighlights = useMemo(() => {
    const sorted = [...(conceptHighlights || [])].sort((a, b) => {
      const lenA = (a.term_he || a.slug || '').length;
      const lenB = (b.term_he || b.slug || '').length;
      return lenB - lenA;
    });
    const compiled: CompiledConceptHighlight[] = [];
    for (const item of sorted) {
      if (!item?.slug) continue;
      const regexes: RegExp[] = [];
      for (const pat of item.search_patterns || []) {
        if (!pat) continue;
        try {
          regexes.push(new RegExp(pat, 'gu'));
        } catch (err) {
          console.warn('[TraditionalTalmudDaf] Invalid concept regex', err);
        }
      }
      if (regexes.length) {
        compiled.push({ ...item, regexes });
      }
    }
    return compiled;
  }, [conceptHighlights]);

  const sagesBySlug = useMemo(() => {
    const map = new Map<string, SageHighlight>();
    sageHighlights.forEach((s) => map.set(s.slug, s));
    return map;
  }, [sageHighlights]);

  const conceptsBySlug = useMemo(() => {
    const map = new Map<string, ConceptHighlight>();
    conceptHighlights.forEach((c) => map.set(c.slug, c));
    return map;
  }, [conceptHighlights]);

  const handleHighlightMouseOver = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement | null)?.closest('.hover-target') as HTMLElement | null;
    if (!target) return;
    const slug = target.dataset.slug;
    const entityType = target.dataset.entityType as 'sage' | 'concept' | undefined;
    if (!slug || (entityType !== 'sage' && entityType !== 'concept')) return;
    const rect = target.getBoundingClientRect();
    const parentRect = event.currentTarget.getBoundingClientRect();
    const source = entityType === 'sage' ? sagesBySlug.get(slug) : conceptsBySlug.get(slug);

    let summary: string | undefined;
    let label: string | undefined;

    if (entityType === 'concept') {
      summary = (source as ConceptHighlight | undefined)?.short_summary_html || undefined;
      label = (source as ConceptHighlight | undefined)?.term_he || slug;
    } else {
      const s = source as SageHighlight | undefined;
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
      x: rect.left + rect.width / 2 - parentRect.left,
      y: rect.top - parentRect.top,
      summary: summary || null,
      label: label || slug,
    });
  }, [conceptsBySlug, sagesBySlug]);

  const handleHighlightMouseOut = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement | null)?.closest('.hover-target');
    const related = event.relatedTarget as HTMLElement | null;
    if (target && related && related.closest('.hover-target')) {
      return;
    }
    setHoverCard(null);
  }, []);

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
    // For concept, navigate
    const path = `/concept/${slug}`;
    window.location.href = path;
  }, []);

  const { translatedText, isTranslating, translate } = useTranslation({
    tref: activeSegmentRef || '',
  });

  const gemaraRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const rashiRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tosafotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Parse amud to determine column order, robust against segment suffix (e.g. "Chullin 74b:6")
  const isAmudB = /\d+b/i.test(dafRef);

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      try {
        const result = await api.getTalmudComments(dafRef);
        if (result.ok) {
          setComments(result.comments);
        }
      } catch (error) {
        console.error('Failed to fetch Talmud comments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [dafRef]);

  // Trigger translation when switching to RU
  useEffect(() => {
    if (showTranslation && translationLang === 'RU' && activeSegmentRef) {
      translate();
    }
  }, [translationLang, activeSegmentRef, translate, showTranslation]);

  // Also trigger translation if we are in translation view and switch to RU
  useEffect(() => {
    if (tosafotViewMode === 'translation' && translationLang === 'RU' && activeSegmentRef) {
      translate();
    }
  }, [translationLang, activeSegmentRef, translate, tosafotViewMode]);

  const handleSegmentClick = (ref: string) => {
    setActiveSegmentRef(ref);
    onSegmentClick?.(ref);

    // Scroll corresponding comments into view
    const rashi = comments.find(c => c.anchorRef === ref && c.commentator.toLowerCase().includes('rashi'));
    const tosafot = comments.find(c => c.anchorRef === ref && c.commentator.toLowerCase().includes('tosafot'));

    if (rashi && rashiRefs.current[rashi.ref]) {
      rashiRefs.current[rashi.ref]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (tosafot && tosafotRefs.current[tosafot.ref]) {
      tosafotRefs.current[tosafot.ref]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleGemaraClick = (event: React.MouseEvent<HTMLSpanElement>, ref: string) => {
    const target = event.target as HTMLElement;
    const dhSpan = target.closest('.highlight-dh') as HTMLElement | null;
    
    // Always activate segment
    handleSegmentClick(ref);

    if (dhSpan) {
      const commentRef = dhSpan.dataset.commentRef;
      if (commentRef) {
        // Scroll to the specific comment
        setTimeout(() => {
          if (rashiRefs.current[commentRef]) {
            rashiRefs.current[commentRef]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else if (tosafotRefs.current[commentRef]) {
            tosafotRefs.current[commentRef]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
          // Trigger brief focus highlight
          setHighlightedCommentRef(commentRef);
          setTimeout(() => setHighlightedCommentRef(null), 1500);
        }, 100);
      }
    }
  };

  const processText = (text: string) => {
    let result = text;
    if (!showVowels) result = stripHebrewVowels(result);
    if (!showPunctuation) result = stripPunctuation(result);
    // Don't strip HTML tags here, let them render
    return result;
  };

  const rashiComments = useMemo(() => 
    comments.filter(c => c.commentator.toLowerCase().includes('rashi')), 
  [comments]);

  const tosafotComments = useMemo(() => 
    comments.filter(c => c.commentator.toLowerCase().includes('tosafot')), 
  [comments]);

  const leftColumn = isAmudB ? tosafotComments : rashiComments;
  const leftTitle = isAmudB ? 'Tosafot' : 'Rashi';
  const rightColumn = isAmudB ? rashiComments : tosafotComments;
  const rightTitle = isAmudB ? 'Rashi' : 'Tosafot';

  const renderComment = (comment: TraditionalComment, refs: React.MutableRefObject<Record<string, HTMLDivElement | null>>) => {
    const isActive = activeSegmentRef === comment.anchorRef;
    const isHighlighted = highlightedCommentRef === comment.ref;
    
    // Parse Dibbur Hamatkhil inline
    const { dh, restHtml } = parseCommentDh(comment.he);
    const highlightedRest = isActive
      ? renderHighlightedText(restHtml, compiledSageHighlights, compiledConceptHighlights)
      : restHtml;

    return (
      <div 
        key={comment.ref}
        ref={el => refs.current[comment.ref] = el}
        className={cn(
          "mb-3 p-1 transition-all font-rashi text-right text-lg leading-relaxed text-justify cursor-text select-text rounded",
          isActive ? "bg-primary/[0.05] opacity-100" : "opacity-70 hover:opacity-100",
          isHighlighted && "bg-amber-500/30 dark:bg-amber-500/20 ring-2 ring-amber-500/50 duration-300"
        )}
        style={{ textAlignLast: 'right' }}
        dir="rtl"
        onDoubleClick={() => {
          const word = window.getSelection()?.toString() || '';
          const context = comment.he;
          onLexiconDoubleClick?.(word, context);
        }}
      >
        {dh && (
          <strong className="font-bold text-amber-950 dark:text-amber-200 mr-1 font-rashi">{dh}</strong>
        )}
        <span className="font-rashi" dangerouslySetInnerHTML={{ __html: highlightedRest }} />
      </div>
    );
  };

  // Find the active segment data for the translation overlay
  const activeSegmentData = useMemo(() => {
    if (!activeSegmentRef) return null;
    return segments.find(s => s.ref === activeSegmentRef);
  }, [activeSegmentRef, segments]);

  const activeEnglishText = useMemo(() => {
    if (!activeSegmentData) return null;
    const hebrewText = activeSegmentData.he_text || activeSegmentData.heText || '';
    const candidateEnglish = activeSegmentData.en_text || activeSegmentData.enText || activeSegmentData.text || '';
    return candidateEnglish !== hebrewText ? candidateEnglish : null;
  }, [activeSegmentData]);

  const handleCopySegment = async () => {
    console.log('[handleCopySegment] Triggered. activeSegmentRef:', activeSegmentRef);
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

      const hebrew = stripHtml(activeSegmentData.he_text || activeSegmentData.heText || '');
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
      console.error('[handleCopySegment] Error during copy process:', err);
      setCopyGemaraError(err?.message || "Ошибка при копировании");
    }
  };

  const handleCopyRashi = async () => {
    console.log('[handleCopyRashi] Triggered. activeSegmentRef:', activeSegmentRef);
    setCopyError(null);
    if (!activeSegmentRef) {
      setCopyError("Нет выделенного фрагмента");
      return;
    }

    try {
      // Filter Rashi comments using isSameRef to be robust against punctuation differences
      const segmentRashi = comments.filter(
        c => c && isSameRef(c.anchorRef, activeSegmentRef) && c.commentator?.toLowerCase().includes('rashi')
      );
      console.log('[handleCopyRashi] segmentRashi comments filtered:', segmentRashi);

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
        
        // Add translation if available and not dummy duplicate
        if (typeof comment.en === 'string' && comment.en.trim() && comment.en !== heText) {
          entry += `\n   Translation: ${stripHtml(comment.en)}`;
        }
        return entry;
      });

      const textToCopy = `Комментарии Раши (${activeSegmentRef}):\n${formattedComments.join('\n\n')}`;
      console.log('[handleCopyRashi] Text to copy:', textToCopy);

      const success = await copyToClipboard(textToCopy);
      if (success) {
        setCopiedRashi(true);
        setTimeout(() => setCopiedRashi(false), 1500);
      } else {
        setCopyError("Ошибка буфера обмена");
      }
    } catch (err: any) {
      console.error('[handleCopyRashi] Error during copy process:', err);
      setCopyError(err?.message || "Ошибка при копировании");
    }
  };

  // Helper to render the translation view inside the column
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
            ? (activeEnglishText ? <span dangerouslySetInnerHTML={{ __html: activeEnglishText }} /> : 
                <span className="opacity-50 italic">English translation is currently unavailable.</span>) 
            : (isTranslating ? 
                <div className="flex flex-col items-center gap-4 py-6 opacity-60 italic">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm">Переводим...</span>
                </div> 
                : (translatedText ? <span dangerouslySetInnerHTML={{ __html: translatedText }} /> : <span className="opacity-50 italic">Russian translation not available.</span>))
          }
        </div>
      </div>
    );
  };

  return (
    <div 
      className="flex flex-col h-full bg-background text-foreground overflow-hidden relative"
      onMouseOver={handleHighlightMouseOver}
      onMouseOut={handleHighlightMouseOut}
      onClickCapture={handleHighlightClick}
    >
      {/* Global Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 bg-card border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-vilna">{dafRef}</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-md p-1 gap-1">
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2", !showVowels && "bg-primary/10")} 
              onClick={() => setShowVowels(!showVowels)}
              title="Vowels (Огласовки)"
            >
              <Type className={cn("w-4 h-4", showVowels ? "opacity-40" : "text-primary")} />
            </Button>
            
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2", !showPunctuation && "bg-primary/10")} 
              onClick={() => setShowPunctuation(!showPunctuation)}
              title="Punctuation (Пунктуация)"
            >
              <Quote className={cn("w-4 h-4", showPunctuation ? "opacity-40" : "text-primary")} />
            </Button>
          </div>

          <div className="flex items-center bg-muted rounded-md p-1 gap-1">
             <button 
                className={cn("px-3 py-1 text-xs rounded font-bold transition-all", 
                  translationLang === 'EN' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTranslationLang('EN')}
              >EN</button>
              <button 
                className={cn("px-3 py-1 text-xs rounded font-bold transition-all", 
                  translationLang === 'RU' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTranslationLang('RU')}
              >RU</button>
          </div>

          <Button 
            variant="ghost" 
            size="sm" 
            className="h-9 text-muted-foreground hover:text-foreground transition-all"
            onClick={onToggleFullscreen}
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

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden p-0 gap-0">
        {/* Left Column (Tosafot or Rashi depending on Amud) */}
        <div className="w-[25%] flex flex-col border-r border-border/10">
           {/* If Tosafot is on the left, render the toggle tabs */}
           {leftTitle === 'Tosafot' ? (
              <div className="flex items-center border-b border-border/10 bg-muted/10">
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'tosafot' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('tosafot')}
                >
                  Tosafot
                </button>
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'translation' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('translation')}
                >
                  Translation
                </button>
              </div>
           ) : (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/10 bg-muted/10 min-h-[37px]">
                <div className="w-6" />
                <span className="font-bold opacity-30 uppercase text-[10px] tracking-widest">
                  Rashi
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all",
                    copyError && "text-red-500 hover:text-red-600"
                  )}
                  disabled={!activeSegmentRef}
                  onClick={handleCopyRashi}
                  title={copyError || (activeSegmentRef ? "Скопировать комментарии Раши" : "Выберите фрагмент текста")}
                >
                  {copiedRashi ? (
                    <Check className="w-3.5 h-3.5 text-green-500 animate-in fade-in duration-200" />
                  ) : copyError ? (
                    <span className="text-[10px] text-red-500 font-bold font-sans">!</span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
           )}
          
          <div className="flex-1 px-4 py-6 overflow-y-auto hide-scrollbar">
            {leftTitle === 'Tosafot' && tosafotViewMode === 'translation' 
              ? renderTranslationView() 
              : leftColumn.map(c => renderComment(c, leftTitle === 'Rashi' ? rashiRefs : tosafotRefs))
            }
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-card/20 overflow-hidden relative">
          <div className="flex items-center justify-between px-3 py-1.5 bg-muted/20 border-b border-border/10 min-h-[37px]">
            <div className="w-6" />
            <span className="font-bold opacity-30 uppercase text-[10px] tracking-widest">
              Gemara
            </span>
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all",
                copyGemaraError && "text-red-500 hover:text-red-600"
              )}
              disabled={!activeSegmentRef}
              onClick={handleCopySegment}
              title={copyGemaraError || (activeSegmentRef ? "Скопировать Гемару (оригинал и перевод)" : "Выберите фрагмент текста")}
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
          <div className="flex-1 px-4 py-8 overflow-y-auto hide-scrollbar">
            <div className="w-full max-w-[32ch] mx-auto text-right font-vilna text-2xl md:text-3xl leading-[2.2] md:leading-[1.6] lg:leading-[1.6] text-justify tracking-wide" style={{ textAlignLast: 'right' }} dir="rtl">
              {segments.map((segment, idx) => {
                const isActive = activeSegmentRef === segment.ref;
                const hebrewText = segment.he_text || segment.heText || '';
                const processed = processText(hebrewText);
                
                // Highlight DH in Gemara segment
                const segmentComments = comments.filter(c => c.anchorRef === segment.ref);
                const withDh = highlightDhInGemara(processed, segmentComments);
                const htmlToRender = isActive
                  ? `${renderHighlightedText(withDh, compiledSageHighlights, compiledConceptHighlights)}${idx < segments.length - 1 ? ' ' : ''}`
                  : `${withDh}${idx < segments.length - 1 ? ' ' : ''}`;

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
                      const context = processed;
                      onLexiconDoubleClick?.(word, context);
                    }}
                    dangerouslySetInnerHTML={{ __html: htmlToRender }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (Rashi or Tosafot depending on Amud) */}
        <div className="w-[25%] flex flex-col border-l border-border/10">
           {/* If Tosafot is on the right, render the toggle tabs */}
           {rightTitle === 'Tosafot' ? (
              <div className="flex items-center border-b border-border/10 bg-muted/10">
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'tosafot' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('tosafot')}
                >
                  Tosafot
                </button>
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'translation' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('translation')}
                >
                  Translation
                </button>
              </div>
           ) : (
              <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/10 bg-muted/10 min-h-[37px]">
                <div className="w-6" />
                <span className="font-bold opacity-30 uppercase text-[10px] tracking-widest">
                  Rashi
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all",
                    copyError && "text-red-500 hover:text-red-600"
                  )}
                  disabled={!activeSegmentRef}
                  onClick={handleCopyRashi}
                  title={copyError || (activeSegmentRef ? "Скопировать комментарии Раши" : "Выберите фрагмент текста")}
                >
                  {copiedRashi ? (
                    <Check className="w-3.5 h-3.5 text-green-500 animate-in fade-in duration-200" />
                  ) : copyError ? (
                    <span className="text-[10px] text-red-500 font-bold font-sans">!</span>
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
           )}
          
          <div className="flex-1 px-4 py-6 overflow-y-auto hide-scrollbar">
            {rightTitle === 'Tosafot' && tosafotViewMode === 'translation' 
              ? renderTranslationView() 
              : rightColumn.map(c => renderComment(c, rightTitle === 'Rashi' ? rashiRefs : tosafotRefs))
            }
          </div>
        </div>
      </div>

      {hoverCard && (
        <div
          className="absolute z-50 p-3 bg-popover text-popover-foreground rounded-lg border border-border shadow-md max-w-xs pointer-events-none text-right font-sans text-xs"
          style={{
            left: hoverCard.x,
            top: hoverCard.y,
            transform: 'translate(-50%, -110%)',
          }}
          dir="rtl"
        >
          <div className="font-bold mb-1">{hoverCard.label}</div>
          {hoverCard.summary && (
            <div
              className="opacity-90 leading-normal"
              dangerouslySetInnerHTML={{ __html: hoverCard.summary }}
            />
          )}
        </div>
      )}

      {profileModalSlug && (
        <ProfileInspectorModal
          slug={profileModalSlug}
          onClose={() => setProfileModalSlug(null)}
        />
      )}
    </div>
  );
};
