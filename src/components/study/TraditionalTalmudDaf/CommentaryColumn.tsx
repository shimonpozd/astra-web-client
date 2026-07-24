import React, { useState } from 'react';
import DOMPurify from 'dompurify';
import { Plus, Loader2, Copy, Check } from 'lucide-react';
import { Button } from '../../ui/button';
import { cn } from '../../../lib/utils';
import { TraditionalComment } from './types';
import { parseCommentDh } from './utils/commentParsing';
import { isSameRef } from './utils/refUtils';

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

  const fontScriptClass = useTraditionalScript ? 'font-rashi' : '';

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
                  <button
                    type="button"
                    aria-label={isRead ? "Отметить как непрочитанное" : "Отметить как прочитанное"}
                    className={cn(
                      "h-5 w-5 rounded flex items-center justify-center border transition-all shrink-0 mt-0.5",
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
                <div
                  dir="rtl"
                  className="text-justify tracking-wide leading-relaxed text-right"
                  style={{ textAlignLast: 'right' }}
                  dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(restHtml || comment.he) }}
                />
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
