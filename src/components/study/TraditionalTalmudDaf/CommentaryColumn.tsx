import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { Plus, Loader2, Copy, Check, Languages, MessageSquare } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import { TraditionalComment } from './types';
import { parseCommentDh } from './utils/commentParsing';
import { isSameRef } from './utils/refUtils';
import { authorizedFetch } from '../../../lib/authorizedFetch';

interface CommentaryColumnProps {
  side: 'left' | 'right';
  title: string;
  comments: TraditionalComment[];
  refsMap: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  tosafotViewMode: 'tosafot' | 'translation';
  setTosafotViewMode: (mode: 'tosafot' | 'translation') => void;
  renderTranslationView: () => React.ReactNode;
  loading: boolean;
  activeSegmentRef: string | null;
  activeCommentRef: string | null;
  hoveredCommentRef: string | null;
  commentFontSize: 'sm' | 'base' | 'lg' | 'xl';
  readComments: Record<string, boolean>;
  copyError: string | null;
  copiedRashi: boolean;
  handleCopyRashi: () => void;
  setActiveCommentRef: (ref: string | null) => void;
  setActiveSegmentRef: (ref: string | null) => void;
  onSegmentClick?: (ref: string) => void;
  setHoveredCommentRef: (ref: string | null) => void;
  toggleReadComment: (ref: string) => void;
  onLexiconDoubleClick?: (word: string, context: string) => void;
  onOpenBookshelfDrawer?: (side: 'left' | 'right') => void;
  isOverridden?: boolean;
  onResetDefault?: (side: 'left' | 'right') => void;
  useTraditionalScript?: boolean;
}

export const CommentaryColumn: React.FC<CommentaryColumnProps> = ({
  side,
  title,
  comments,
  refsMap,
  setTosafotViewMode,
  renderTranslationView,
  loading,
  activeSegmentRef,
  activeCommentRef,
  hoveredCommentRef,
  commentFontSize,
  readComments,
  copyError,
  copiedRashi,
  handleCopyRashi,
  setActiveCommentRef,
  setActiveSegmentRef,
  onSegmentClick,
  setHoveredCommentRef,
  toggleReadComment,
  onLexiconDoubleClick,
  onOpenBookshelfDrawer,
  isOverridden,
  onResetDefault,
  useTraditionalScript = true,
}) => {
  const borderClass = side === 'left' ? 'border-r border-border/10' : 'border-l border-border/10';
  const [columnViewMode, setColumnViewMode] = useState<'text' | 'translation'>('text');
  const [expandedCommentTranslations, setExpandedCommentTranslations] = useState<Record<string, boolean>>({});
  const [commentTranslations, setCommentTranslations] = useState<Record<string, string>>({});
  const [translatingCommentKey, setTranslatingCommentKey] = useState<string | null>(null);

  const fontScriptClass = useTraditionalScript ? 'font-rashi' : 'font-serif';

  // Part B: Autoscroll column when activeSegmentRef changes
  useEffect(() => {
    if (!activeSegmentRef || !comments || comments.length === 0) return;
    const firstMatch = comments.find(c => c && isSameRef(c.anchorRef, activeSegmentRef));
    if (firstMatch) {
      const key = firstMatch.ref || `comment-${firstMatch.anchorRef || ''}-${firstMatch.commentator || ''}`;
      const el = refsMap.current[key] || refsMap.current[firstMatch.ref];
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [activeSegmentRef, comments, refsMap]);

  const handleTranslateComment = async (key: string, comment: TraditionalComment) => {
    setExpandedCommentTranslations(prev => ({ ...prev, [key]: !prev[key] }));
    if (commentTranslations[key]) return;

    // Use comment.en only if it is real English (not raw Hebrew/Aramaic)
    const isHebrewText = (str?: string) => Boolean(str && /[\u0590-\u05FF]/.test(str));
    if (comment.en && comment.en.trim() && !isHebrewText(comment.en)) {
      setCommentTranslations(prev => ({ ...prev, [key]: comment.en! }));
      return;
    }

    setTranslatingCommentKey(key);
    try {
      if (comment.ref) {
        const res = await authorizedFetch('/api/actions/translate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tref: comment.ref }),
        });
        if (res.ok && res.body) {
          const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
          let fullTranslation = '';
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (!value) continue;

            buffer += value;
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              try {
                const event = JSON.parse(trimmed);
                const textChunk = typeof event.data === 'string' ? event.data : (event.data?.text || '');
                if ((event.type === 'llm_chunk' || event.type === 'translation_chunk') && textChunk) {
                  fullTranslation += textChunk;
                  setCommentTranslations(prev => ({ ...prev, [key]: fullTranslation }));
                }
              } catch {
                if (trimmed && !trimmed.startsWith('{')) {
                  fullTranslation += trimmed;
                  setCommentTranslations(prev => ({ ...prev, [key]: fullTranslation }));
                }
              }
            }
          }

          if (buffer.trim()) {
            try {
              const event = JSON.parse(buffer.trim());
              const textChunk = typeof event.data === 'string' ? event.data : (event.data?.text || '');
              if ((event.type === 'llm_chunk' || event.type === 'translation_chunk') && textChunk) {
                fullTranslation += textChunk;
              }
            } catch {
              if (buffer.trim() && !buffer.trim().startsWith('{')) {
                fullTranslation += buffer.trim();
              }
            }
          }

          if (fullTranslation.trim()) {
            setCommentTranslations(prev => ({ ...prev, [key]: fullTranslation }));
            return;
          }
        }
      }
      setCommentTranslations(prev => ({ ...prev, [key]: 'Перевод временно недоступен' }));
    } catch {
      setCommentTranslations(prev => ({ ...prev, [key]: 'Перевод временно недоступен' }));
    } finally {
      setTranslatingCommentKey(null);
    }
  };

  return (
    <div className={cn("w-full h-full flex flex-col flex-1 min-w-0", borderClass)}>
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border/10 bg-muted/20 min-h-[37px]">
        <div className="flex items-center gap-1.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-primary transition-all flex-shrink-0"
            onClick={() => onOpenBookshelfDrawer?.(side)}
            title="Заменить комментатора (+)"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
          <span className="font-bold opacity-80 uppercase text-[10px] tracking-widest truncate max-w-[100px] font-sans">
            {title}
          </span>
          {isOverridden && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1 text-[9px] text-muted-foreground hover:text-foreground font-sans flex-shrink-0"
              onClick={() => onResetDefault?.(side)}
              title="Сбросить к дефолту"
            >
              Сброс
            </Button>
          )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 px-1.5 text-[10px] font-medium tracking-tight font-sans transition-all",
              columnViewMode === 'translation' ? "text-primary bg-primary/15 font-bold" : "text-muted-foreground hover:text-foreground opacity-70 hover:opacity-100"
            )}
            onClick={() => {
              const next = columnViewMode === 'text' ? 'translation' : 'text';
              setColumnViewMode(next);
              if (side === 'left' && setTosafotViewMode) setTosafotViewMode(next === 'translation' ? 'translation' : 'tosafot');
            }}
            title="Переключить комментарий / перевод"
          >
            {columnViewMode === 'translation' ? 'Текст' : 'Перевод'}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className={cn("h-6 w-6 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-all",
              copyError && "text-red-500 hover:text-red-600"
            )}
            disabled={!activeSegmentRef}
            onClick={handleCopyRashi}
            aria-label={`Скопировать комментарии ${title}`}
            title={copyError || (activeSegmentRef ? `Скопировать комментарии ${title}` : "Выберите фрагмент текста")}
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
      </div>

      <div className="flex-1 px-4 py-6 overflow-y-auto hide-scrollbar">
        {columnViewMode === 'translation' ? (
          renderTranslationView()
        ) : loading && comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground opacity-50 p-6 text-center">
            <Loader2 className="w-5 h-5 animate-spin mb-2 text-primary" />
            <span className="text-xs font-sans">Загрузка комментариев...</span>
          </div>
        ) : comments.length > 0 ? (
          comments.map((comment, idx) => {
            const { dh, restHtml } = parseCommentDh(comment.he);
            const isRead = Boolean(readComments[comment.ref]);
            const isAnchorActive = activeSegmentRef && isSameRef(comment.anchorRef, activeSegmentRef);
            const isCommentActive = activeCommentRef === comment.ref || hoveredCommentRef === comment.ref;
            const isRashi = comment.commentator?.toLowerCase().includes('rashi');
            const key = comment.ref || `comment-${comment.anchorRef || ''}-${comment.commentator || ''}-${idx}`;

            const fontSizeClass = {
              sm: 'text-xs md:text-sm leading-normal',
              base: 'text-sm md:text-base leading-relaxed',
              lg: 'text-base md:text-lg leading-relaxed',
              xl: 'text-lg md:text-xl leading-relaxed',
            }[commentFontSize];

            return (
              <div
                key={key}
                ref={el => refsMap.current[comment.ref || key] = el}
                dir="rtl"
                className={cn(
                  "mb-4 p-2.5 rounded-lg transition-all duration-200 text-right cursor-pointer border-r-4 flex flex-col gap-1.5 select-text",
                  fontScriptClass,
                  fontSizeClass,
                  // Part B: Dim non-active comments when an activeSegmentRef exists
                  activeSegmentRef && !isAnchorActive && !isCommentActive ? "opacity-50 hover:opacity-100" : "opacity-100",
                  isCommentActive
                    ? isRashi
                      ? "bg-amber-500/25 border-amber-500 ring-2 ring-amber-500/60 shadow-md scale-[1.01]"
                      : "bg-blue-500/25 border-blue-500 ring-2 ring-blue-500/60 shadow-md scale-[1.01]"
                    : isAnchorActive
                    ? "bg-amber-500/10 border-amber-500/60 dark:bg-amber-500/15"
                    : isRead
                    ? "border-emerald-500/60 bg-emerald-500/10 dark:bg-emerald-500/15 shadow-sm"
                    : "border-transparent hover:bg-muted/40"
                )}
                onMouseEnter={() => setHoveredCommentRef(comment.ref)}
                onMouseLeave={() => setHoveredCommentRef(null)}
                onClick={() => {
                  setActiveCommentRef(comment.ref);
                  setActiveSegmentRef(comment.anchorRef);
                  onSegmentClick?.(comment.anchorRef);

                  if (comment.ref) {
                    const dhElement = document.querySelector(`[data-comment-ref~="${CSS.escape(comment.ref)}"]`);
                    if (dhElement) {
                      dhElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }
                  }
                }}
                onDoubleClick={() => {
                  const word = window.getSelection()?.toString() || '';
                  onLexiconDoubleClick?.(word, comment.he);
                }}
              >
                <div className="flex items-start justify-between gap-2 border-b border-border/10 pb-1 font-sans" dir="rtl">
                  {dh && (
                    <strong
                      className={cn(
                        "text-primary font-extrabold text-base md:text-lg leading-snug text-right",
                        fontScriptClass
                      )}
                      dir="rtl"
                    >
                      {dh}
                    </strong>
                  )}
                  <div className="flex items-center gap-1 shrink-0 mt-0.5" dir="ltr">
                    {/* Part D: Per-comment translate button */}
                    <button
                      type="button"
                      aria-label="Перевести комментарий"
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center border transition-all shrink-0",
                        expandedCommentTranslations[key]
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/60 hover:text-primary opacity-60 hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleTranslateComment(key, comment);
                      }}
                      title="Перевести комментарий"
                    >
                      <Languages className="w-3 h-3" />
                    </button>

                    {/* Part G: Explain comment in chat button */}
                    <button
                      type="button"
                      aria-label="Объяснить комментарий в чате"
                      className="h-5 w-5 rounded flex items-center justify-center border border-border/60 text-muted-foreground hover:border-primary/60 hover:text-primary opacity-60 hover:opacity-100 transition-all shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        const plainText = (comment.he || '').replace(/<[^>]+>/g, '').trim();
                        const prompt = `Пожалуйста, объясни комментарий ${comment.commentator || title} к отрывку ${comment.anchorRef}: "${plainText}"`;
                        window.dispatchEvent(new CustomEvent('send-chat-prompt', { detail: { prompt } }));
                      }}
                      title="Объяснить этот комментарий в чате"
                    >
                      <MessageSquare className="w-3 h-3" />
                    </button>

                    {/* Read status checkmark */}
                    <button
                      type="button"
                      aria-label={isRead ? "Отметить как непрочитанное" : "Отметить как прочитанное"}
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center border transition-all shrink-0",
                        isRead 
                          ? "bg-emerald-500 text-white border-emerald-500 shadow-sm ring-1 ring-emerald-500/50" 
                          : "border-border/60 text-muted-foreground hover:border-emerald-500/60 hover:text-emerald-500 opacity-60 hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReadComment(comment.ref);
                      }}
                      title={isRead ? "Отметить как непрочитанное" : "Отметить как прочитанное"}
                    >
                      <Check className={cn("w-3 h-3 transition-transform", isRead ? "scale-100 font-bold" : "scale-75 opacity-70")} />
                    </button>
                  </div>
                </div>
                <div
                  dir="rtl"
                  className="text-justify tracking-wide leading-relaxed text-right"
                  style={{ textAlignLast: 'right' }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(restHtml || comment.he) }}
                />

                {/* Part D: Expandable Translation Panel */}
                {expandedCommentTranslations[key] && (
                  <div
                    className="mt-2 p-2.5 rounded-md bg-muted/30 text-foreground/90 font-sans text-xs sm:text-sm text-left leading-relaxed border border-border/30 animate-in fade-in duration-200"
                    dir="ltr"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {translatingCommentKey === key ? (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>Переводим...</span>
                      </div>
                    ) : (
                      commentTranslations[key] || comment.en || 'Перевод недоступен'
                    )}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground opacity-40 p-6 text-center font-sans text-xs">
            Нет комментариев ({title})
          </div>
        )}
      </div>
    </div>
  );
};
