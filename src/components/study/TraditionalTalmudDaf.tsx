import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import DOMPurify from 'dompurify';
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
  Minimize2,
  ChevronLeft,
  ChevronRight,
  Shield,
  Plus,
  Search,
  Sparkles,
  UserPlus
} from 'lucide-react';
import { api } from '../../services/api';
import { addSageMapping, createSageProfile, addCustomConcept, addConceptMapping, fetchSageHighlights } from '../../services/highlight';
import { stripHebrewVowels, stripPunctuation } from '../../utils/hebrewUtils';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';
import { SageHighlight, ConceptHighlight } from '../../types/highlight';
import ProfileInspectorModal from './ProfileInspectorModal';

export const escapeRegExp = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export const getNextDafRef = (dafRef: string): string => {
  if (!dafRef) return dafRef;
  const match = dafRef.match(/^(.+?)\s+(\d+)([ab])$/i);
  if (!match) return dafRef;
  const tractate = match[1];
  const page = parseInt(match[2], 10);
  const amud = match[3].toLowerCase();
  if (amud === 'a') {
    return `${tractate} ${page}b`;
  } else {
    return `${tractate} ${page + 1}a`;
  }
};

export const getPrevDafRef = (dafRef: string): string => {
  if (!dafRef) return dafRef;
  const match = dafRef.match(/^(.+?)\s+(\d+)([ab])$/i);
  if (!match) return dafRef;
  const tractate = match[1];
  const page = parseInt(match[2], 10);
  const amud = match[3].toLowerCase();
  if (amud === 'b') {
    return `${tractate} ${page}a`;
  } else {
    if (page <= 2) return `${tractate} 2a`;
    return `${tractate} ${page - 1}b`;
  }
};

export const parseCommentDh = (hebrewHtml: string) => {
  let dh = '';
  let restHtml = hebrewHtml || '';

  const boldMatch = restHtml.match(/^(?:<br\s*\/?>|\s)*<(b|strong)>(.*?)<\/\1>/i);
  if (boldMatch) {
    dh = boldMatch[2].trim();
    restHtml = restHtml.substring(boldMatch[0].length).trim();
  } else {
    const strippedHtml = restHtml.replace(/<\/?b>/gi, '').replace(/<\/?strong>/gi, '');
    const dashMatch = strippedHtml.match(/^(.*?)([\-–—])(.*)$/s);
    if (dashMatch && dashMatch[1].trim().length < 150) {
      dh = dashMatch[1].trim();
      restHtml = dashMatch[3].trim();
    } else {
      const match = strippedHtml.match(/^(.*?)([\.])(.*)$/s);
      if (match && match[1].trim().length < 100) {
        dh = match[1].trim();
        restHtml = match[3].trim();
      } else {
        dh = strippedHtml.slice(0, 40);
        restHtml = strippedHtml;
      }
    }
  }

  const cleanWords = dh
    .replace(/[֑-ׇ]/g, '')
    .replace(/["'""().,!?;:\-\[\]{}–—]/g, ' ')
    .split(/\s+/)
    .filter(w => w && !/^(וכו|גו|וגו|פי|פירוש|ע)$/i.test(w));

  const matchDh = cleanWords.slice(0, 5).join(' ') || dh;

  return { dh, matchDh, restHtml };
};

export const highlightFullPhraseInHtml = (
  html: string,
  regex: RegExp,
  wrapFn: (matchedText: string) => string
): string => {
  const plainToHtmlIndex: number[] = [];
  let plainText = '';
  let inTag = false;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    if (char === '<') {
      inTag = true;
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag) {
      plainToHtmlIndex.push(i);
      plainText += char;
    }
  }

  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  const matches: { startHtml: number; endHtml: number }[] = [];

  while ((match = regex.exec(plainText)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    if (matchStart < plainToHtmlIndex.length && matchEnd <= plainToHtmlIndex.length) {
      const startHtml = plainToHtmlIndex[matchStart];
      const lastPlainIdx = matchEnd - 1;
      const endHtml = plainToHtmlIndex[lastPlainIdx] + 1;

      matches.push({ startHtml, endHtml });
    }

    if (!regex.global) break;
  }

  if (matches.length === 0) return html;

  let result = html;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { startHtml, endHtml } = matches[i];
    const matchedHtmlChunk = result.substring(startHtml, endHtml);
    if (matchedHtmlChunk.includes('class="highlight-dh')) continue;

    const wrapped = wrapFn(matchedHtmlChunk);
    result = result.substring(0, startHtml) + wrapped + result.substring(endHtml);
  }

  return result;
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

// Helper to compare refs flexibly (ignoring dots, colons, spaces, commas, retaining range hyphens)
const isSameRef = (ref1: string, ref2: string) => {
  if (!ref1 || !ref2) return false;
  const normalize = (r: string) => r.replace(/[:\s,.]/g, '').toLowerCase();
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

const wildPlaceholder = '(?:[\\u05D0-\\u05EA\\u05B0-\\u05C7\\s"\'\u200E\u200F]{1,25})';

export const buildHebrewFuzzyRegex = (phrase: string): RegExp | null => {
  if (!phrase || phrase.trim().length < 2) return null;

  const parts = phrase.split(/(\[[^\]]*WILD[^\]]*\])/gi);
  const regexParts: string[] = [];

  for (const part of parts) {
    if (/^\[.*WILD.*\]$/i.test(part.trim())) {
      regexParts.push(wildPlaceholder);
      continue;
    }

    const clean = stripPunctuation(stripHebrewVowels(part))
      .replace(/[\u0591-\u05AF\u05C7\u200E\u200F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) continue;

    const words = clean.split(' ');
    const escapedWords = words.map((word) => {
      return Array.from(word)
        .map((char) => {
          let baseChar = char;
          if (char === 'ם' || char === 'מ') baseChar = '[מם]';
          else if (char === 'ן' || char === 'נ') baseChar = '[נן]';
          else if (char === 'ץ' || char === 'צ') baseChar = '[צץ]';
          else if (char === 'ף' || char === 'פ') baseChar = '[פף]';
          else if (char === 'ך' || char === 'כ') baseChar = '[כך]';
          else if (char === 'י' || char === 'ו' || char === 'א' || char === 'ה') {
            return `${char}?[\\u0591-\\u05C7]*`;
          } else if (char >= '\u05D0' && char <= '\u05EA') {
            baseChar = char;
          } else {
            baseChar = char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          }
          return `${baseChar}[\\u0591-\\u05C7]*`;
        })
        .join('');
    });

    const separator = `[\\s\\u200E\\u200F"'\\"().,!?;:\\-\\[\\]{}ׇ]*`;
    regexParts.push(escapedWords.join(separator));
  }

  if (regexParts.length === 0) return null;

  const separator = `[\\s\\u200E\\u200F"'\\"().,!?;:\\-\\[\\]{}ׇ]*`;
  const pattern = regexParts.join(separator);
  try {
    return new RegExp(pattern, 'gu');
  } catch (e) {
    return null;
  }
};


interface TextToken {
  clean: string;
  stem: string;
  startHtml: number;
  endHtml: number;
}

function extractGemaraWordTokens(html: string): TextToken[] {
  const tokens: TextToken[] = [];
  let inTag = false;
  let currentWord = '';
  let wordStartHtml = -1;
  let wordEndHtml = -1;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    if (char === '<') {
      inTag = true;
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (inTag) continue;

    if (char >= '\u05D0' && char <= '\u05EA') {
      if (wordStartHtml === -1) wordStartHtml = i;
      wordEndHtml = i + 1;
      currentWord += char;
    } else if (/[\u0591-\u05C7\u200E\u200F]/.test(char)) {
      if (wordStartHtml !== -1) {
        wordEndHtml = i + 1;
      }
    } else {
      if (currentWord.length > 0 && wordStartHtml !== -1) {
        const clean = currentWord.replace(/[\u0591-\u05C7\u200E\u200F]/g, '');
        const stem = clean.replace(/[יואה]/g, '');
        if (clean.length >= 2) {
          tokens.push({
            clean,
            stem,
            startHtml: wordStartHtml,
            endHtml: wordEndHtml,
          });
        }
        currentWord = '';
        wordStartHtml = -1;
      }
    }
  }

  if (currentWord.length > 0 && wordStartHtml !== -1) {
    const clean = currentWord.replace(/[\u0591-\u05C7\u200E\u200F]/g, '');
    const stem = clean.replace(/[יואה]/g, '');
    if (clean.length >= 2) {
      tokens.push({
        clean,
        stem,
        startHtml: wordStartHtml,
        endHtml: wordEndHtml,
      });
    }
  }

  return tokens;
}

function matchWordsEqual(w1: string, s1: string, w2: string, s2: string): boolean {
  if (w1 === w2) return true;
  if (s1.length >= 2 && s2.length >= 2 && s1 === s2) return true;
  return false;
}

export const highlightDhInGemara = (
  text: string,
  commentsForSegment: TraditionalComment[],
  activeRef: string | null = null,
  hoveredRef: string | null = null
) => {
  if (!text) return text;

  const tokens = extractGemaraWordTokens(text);
  if (tokens.length === 0) return text;

  const sortedComments = [...commentsForSegment]
    .map(c => {
      const { dh } = parseCommentDh(c.he);
      const cleanWords = (dh || '')
        .replace(/[\u0591-\u05C7\u200E\u200F]/g, '')
        .replace(/["'""().,!?;:\-\[\]{}–—ׇ]/g, ' ')
        .split(/\s+/)
        .filter(w => w && w.length >= 2 && !/^(ופרכינן|פירש|כלומר|והכי|כגון|וזהו|וכו|גו|וגו|ע)$/i.test(w))
        .map(w => ({
          clean: w,
          stem: w.replace(/[יואה]/g, ''),
        }));
      return { comment: c, dh, cleanWords };
    })
    .filter(item => item.cleanWords.length > 0)
    .sort((a, b) => b.cleanWords.length - a.cleanWords.length);

  const matches: { startHtml: number; endHtml: number; commentRef: string; isRashi: boolean; isActive: boolean }[] = [];

  for (const item of sortedComments) {
    const dhWords = item.cleanWords;
    let bestMatch: { startTokenIdx: number; endTokenIdx: number; count: number } | null = null;

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      for (let dhStart = 0; dhStart < Math.min(dhWords.length, 2); dhStart++) {
        let count = 0;
        while (
          tIdx + count < tokens.length &&
          dhStart + count < dhWords.length &&
          matchWordsEqual(
            tokens[tIdx + count].clean,
            tokens[tIdx + count].stem,
            dhWords[dhStart + count].clean,
            dhWords[dhStart + count].stem
          )
        ) {
          count++;
        }

        if (count >= 2 || (count === 1 && dhWords.length === 1)) {
          if (!bestMatch || count > bestMatch.count) {
            bestMatch = { startTokenIdx: tIdx, endTokenIdx: tIdx + count - 1, count };
          }
        }
      }
    }

    if (bestMatch) {
      const startHtml = tokens[bestMatch.startTokenIdx].startHtml;
      const endHtml = tokens[bestMatch.endTokenIdx].endHtml;
      const isCommentActive = activeRef === item.comment.ref || hoveredRef === item.comment.ref;
      const isRashi = item.comment.commentator.toLowerCase().includes('rashi');

      const overlaps = matches.some(m => Math.max(m.startHtml, startHtml) < Math.min(m.endHtml, endHtml));
      if (!overlaps) {
        matches.push({
          startHtml,
          endHtml,
          commentRef: item.comment.ref,
          isRashi,
          isActive: isCommentActive,
        });
      }
    }
  }

  if (matches.length === 0) return text;

  matches.sort((a, b) => b.startHtml - a.startHtml);

  let result = text;
  for (const m of matches) {
    const chunk = result.substring(m.startHtml, m.endHtml);
    const commentatorClass = m.isRashi ? 'dh-rashi' : 'dh-tosafot';
    const activeClass = m.isActive ? 'active' : '';
    const wrapped = `<span class="highlight-dh ${commentatorClass} ${activeClass}" data-comment-ref="${escapeAttr(m.commentRef)}">${chunk}</span>`;
    result = result.substring(0, m.startHtml) + wrapped + result.substring(m.endHtml);
  }

  return result;
};

interface CommentaryColumnProps {
  side: 'left' | 'right';
  title: 'Rashi' | 'Tosafot';
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
}

const CommentaryColumn: React.FC<CommentaryColumnProps> = ({
  side,
  title,
  comments,
  refsMap,
  tosafotViewMode,
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
}) => {
  const borderClass = side === 'left' ? 'border-r border-border/10' : 'border-l border-border/10';

  return (
    <div className={cn("w-[25%] flex flex-col", borderClass)}>
      {title === 'Tosafot' ? (
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
            aria-label="Скопировать комментарии Раши"
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
        {title === 'Tosafot' && tosafotViewMode === 'translation' ? (
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
                className={cn(
                  "mb-4 p-2.5 rounded-lg transition-all duration-200 text-justify font-rashi cursor-pointer border-r-4 flex flex-col gap-1.5",
                  fontSizeClass,
                  isCommentActive
                    ? isRashi
                      ? "bg-amber-500/25 border-amber-500 ring-2 ring-amber-500/60 shadow-md scale-[1.01]"
                      : "bg-blue-500/25 border-blue-500 ring-2 ring-blue-500/60 shadow-md scale-[1.01]"
                    : isAnchorActive
                    ? "bg-amber-500/10 border-amber-500/60 dark:bg-amber-500/15"
                    : isRead
                    ? "border-emerald-500/40 bg-emerald-500/5 opacity-70"
                    : "border-transparent hover:bg-muted/40"
                )}
                onMouseEnter={() => setHoveredCommentRef(comment.ref)}
                onMouseLeave={() => setHoveredCommentRef(null)}
                onClick={() => {
                  setActiveCommentRef(comment.ref);
                  setActiveSegmentRef(comment.anchorRef);
                  onSegmentClick?.(comment.anchorRef);

                  if (comment.ref) {
                    const dhElement = document.querySelector(`[data-comment-ref="${CSS.escape(comment.ref)}"]`);
                    if (dhElement) {
                      dhElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                  }
                }}
                onDoubleClick={() => {
                  const word = window.getSelection()?.toString() || '';
                  onLexiconDoubleClick?.(word, comment.he);
                }}
              >
                <div className="flex items-center justify-between gap-2 border-b border-border/10 pb-1">
                  {isRashi && (
                    <button
                      type="button"
                      aria-label={isRead ? "Отметить как непрочитанное" : "Отметить как прочитанное"}
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center border transition-all",
                        isRead ? "bg-emerald-500 text-white border-emerald-500" : "border-border/60 opacity-40 hover:opacity-100"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleReadComment(comment.ref);
                      }}
                      title={isRead ? "Отметить как непрочитанное" : "Отметить как прочитанное"}
                    >
                      <Check className="w-3 h-3 text-current" />
                    </button>
                  )}
                  {dh && <strong className="text-primary font-extrabold text-base md:text-lg leading-snug">{dh}</strong>}
                </div>
                <span
                  className="text-justify tracking-wide"
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

interface TraditionalTalmudDafProps {
  dafRef: string;
  segments: any[];
  onSegmentClick?: (ref: string) => void;
  onLexiconDoubleClick?: (word: string, context?: string) => void;
  sageHighlights?: SageHighlight[];
  conceptHighlights?: ConceptHighlight[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onDafChange?: (nextDafRef: string) => void;
  isAdmin?: boolean;
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
  const navigate = useNavigate();
  const [comments, setComments] = useState<TraditionalComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSegmentRef, setActiveSegmentRef] = useState<string | null>(null);
  const [activeCommentRef, setActiveCommentRef] = useState<string | null>(null);
  const [hoveredCommentRef, setHoveredCommentRef] = useState<string | null>(null);

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

  const [currentDafRef, setCurrentDafRef] = useState(dafRef);

  useEffect(() => {
    if (dafRef) {
      setCurrentDafRef(dafRef);
    }
  }, [dafRef]);

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

  useEffect(() => {
    let active = true;
    const fallbackRef = currentDafRef || dafRef;

    const processCommentaryData = (commentaryItems: any[], amudRef: string) => {
      const parsedComments: TraditionalComment[] = [];

      for (const item of commentaryItems) {
        if (!item || !item.he) continue;

        const rawCategory = (item.category || item.collectiveTitle?.en || item.index_title || '').toString();
        const searchStr = `${rawCategory} ${item.ref || ''} ${item.sourceHeRef || ''}`.toLowerCase();

        const isRashi = searchStr.includes('rashi') || searchStr.includes('רש"י') || searchStr.includes('רשי');
        const isTosafot = searchStr.includes('tosafot') || searchStr.includes('תוספ');

        if (isRashi || isTosafot) {
          const anchor = item.anchorRef || item.sourceRef || fallbackRef;
          const hebrew = Array.isArray(item.he) ? item.he.join('<br/>') : (typeof item.he === 'string' ? item.he : '');
          const english = Array.isArray(item.text) ? item.text.join('<br/>') : (typeof item.text === 'string' ? item.text : '');

          if (hebrew && hebrew.trim()) {
            parsedComments.push({
              ref: item.ref || `${isRashi ? 'Rashi' : 'Tosafot'} on ${anchor}`,
              anchorRef: anchor,
              commentator: isRashi ? 'Rashi' : 'Tosafot',
              he: hebrew,
              en: english,
            });
          }
        }
      }
      setComments(parsedComments);
    };

    const fetchComments = async () => {
      setLoading(true);
      try {
        const amudRef = (currentDafRef || dafRef).replace(/:.*$/, '').trim();
        const sefariaRef = amudRef.replace(/\s+(?=\d+[ab]$)/i, '.').replace(/\s+/g, '_');
        
        const url = `https://www.sefaria.org/api/texts/${sefariaRef}?commentary=1&context=0&pad=0`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          processCommentaryData(data.commentary || [], amudRef);
          return;
        }

        // Fallback fetch
        const fallbackUrl = `https://www.sefaria.org/api/texts/${encodeURIComponent(amudRef)}?commentary=1&context=0`;
        const res2 = await fetch(fallbackUrl);
        if (res2.ok) {
          const data2 = await res2.json();
          if (!active) return;
          processCommentaryData(data2.commentary || [], amudRef);
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
  }, [currentDafRef, dafRef]);

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

  // Local state for dynamic highlights updates
  const [localSageHighlights, setLocalSageHighlights] = useState<SageHighlight[]>(initialSageHighlights);
  const [localConceptHighlights, setLocalConceptHighlights] = useState<ConceptHighlight[]>(initialConceptHighlights);

  useEffect(() => {
    setLocalSageHighlights(initialSageHighlights);
  }, [initialSageHighlights]);

  useEffect(() => {
    setLocalConceptHighlights(initialConceptHighlights);
  }, [initialConceptHighlights]);

  const compileSageHighlights = useCallback((items: SageHighlight[]): CompiledSageHighlight[] => {
    const allowed = new Set(['zugot', 'tannaim', 'amoraim', 'achronim']);
    const sorted = [...(items || [])].sort((a, b) => {
      const lenA = (a.name_he || a.slug || '').length;
      const lenB = (b.name_he || b.slug || '').length;
      return lenB - lenA;
    });
    const compiled: CompiledSageHighlight[] = [];
    for (const item of sorted) {
      if (!item?.slug || !item?.regex_pattern) continue;
      try {
        const periodRaw = (item.period || '').toLowerCase();
        const periodBase = (periodRaw.split('_')[0] || periodRaw || 'sage').trim();
        if (periodBase && !allowed.has(periodBase)) {
          continue;
        }
        const regex = item.regex_pattern.includes('[WILD]')
          ? (buildHebrewFuzzyRegex(item.regex_pattern) || new RegExp(item.regex_pattern, 'gu'))
          : new RegExp(item.regex_pattern, 'gu');
        compiled.push({ ...item, period: periodRaw || periodBase, regex });
      } catch (err) {
        console.warn('[TraditionalTalmudDaf] Invalid sage regex', err);
      }
    }
    return compiled;
  }, []);

  const compileConceptHighlights = useCallback((items: ConceptHighlight[]): CompiledConceptHighlight[] => {
    const sorted = [...(items || [])].sort((a, b) => {
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
          const rx = pat.includes('[WILD]')
            ? (buildHebrewFuzzyRegex(pat) || new RegExp(pat, 'gu'))
            : new RegExp(pat, 'gu');
          regexes.push(rx);
        } catch (err) {
          console.warn('[TraditionalTalmudDaf] Invalid concept regex', err);
        }
      }
      if (regexes.length) {
        compiled.push({ ...item, regexes });
      }
    }
    return compiled;
  }, []);

  const compiledSageHighlights = useMemo(
    () => compileSageHighlights(localSageHighlights),
    [compileSageHighlights, localSageHighlights]
  );

  const compiledConceptHighlights = useMemo(
    () => compileConceptHighlights(localConceptHighlights),
    [compileConceptHighlights, localConceptHighlights]
  );

  const sagesBySlug = useMemo(() => {
    const map = new Map<string, CompiledSageHighlight>();
    compiledSageHighlights.forEach((s) => map.set(s.slug, s));
    return map;
  }, [compiledSageHighlights]);

  const conceptsBySlug = useMemo(() => {
    const map = new Map<string, CompiledConceptHighlight>();
    compiledConceptHighlights.forEach((c) => map.set(c.slug, c));
    return map;
  }, [compiledConceptHighlights]);

  const renderedSegmentHtmls = useMemo(() => {
    return segments.map((segment, idx) => {
      const hebrewText = segment.he_text || segment.heText || '';
      const processed = processText(hebrewText);
      const segmentComments = comments.filter(c => c.anchorRef === segment.ref || isSameRef(c.anchorRef, segment.ref));
      const withDh = highlightDhInGemara(processed, segmentComments);
      const highlighted = renderHighlightedText(withDh, compiledSageHighlights, compiledConceptHighlights);
      return `${highlighted}${idx < segments.length - 1 ? ' ' : ''}`;
    });
  }, [segments, comments, processText, compiledSageHighlights, compiledConceptHighlights]);

  useEffect(() => {
    const container = gemaraContainerRef.current;
    if (!container) return;
    const dhSpans = container.querySelectorAll('.highlight-dh');
    dhSpans.forEach(span => {
      const el = span as HTMLElement;
      const ref = el.dataset.commentRef;
      if (ref && (ref === activeCommentRef || ref === hoveredCommentRef)) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }, [activeCommentRef, hoveredCommentRef]);

  const [hoverCard, setHoverCard] = useState<{
    slug: string;
    type: 'sage' | 'concept';
    x: number;
    y: number;
    summary: string | null;
    label: string;
  } | null>(null);

  const [profileModalSlug, setProfileModalSlug] = useState<string | null>(null);

  const handleHighlightMouseOver = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rawTarget = event.target as HTMLElement | null;
    const dhSpan = rawTarget?.closest('.highlight-dh') as HTMLElement | null;
    if (dhSpan) {
      const commentRef = dhSpan.dataset.commentRef;
      if (commentRef) setHoveredCommentRef(commentRef);
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
  }, [conceptsBySlug, sagesBySlug]);

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
    const path = `/concept/${slug}`;
    navigate(path);
  }, [navigate]);

  const touchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // Session tracker state for learned Rashi comments
  const [readComments, setReadComments] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try {
      const saved = sessionStorage.getItem(`astra_read_comments_${currentDafRef}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = sessionStorage.getItem(`astra_read_comments_${currentDafRef}`);
      setReadComments(saved ? JSON.parse(saved) : {});
    } catch {
      setReadComments({});
    }
  }, [currentDafRef]);

  const toggleReadComment = useCallback((ref: string) => {
    setReadComments(prev => {
      const updated = { ...prev, [ref]: !prev[ref] };
      if (typeof window !== 'undefined') {
        try {
          sessionStorage.setItem(`astra_read_comments_${currentDafRef}`, JSON.stringify(updated));
        } catch {}
      }
      return updated;
    });
  }, [currentDafRef]);

  // Admin edit mode & selection popover state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<{
    x: number;
    y: number;
    selectedText: string;
  } | null>(null);
  
  const [showSageModal, setShowSageModal] = useState(false);
  const [sageSearchQuery, setSageSearchQuery] = useState('');
  const [showCreateSageModal, setShowCreateSageModal] = useState(false);
  const [newSageName, setNewSageName] = useState('');
  const [newSagePeriod, setNewSagePeriod] = useState('amoraim');
  const [newSagePeriodRu, setNewSagePeriodRu] = useState('Амораим');

  const [showConceptModal, setShowConceptModal] = useState(false);
  const [conceptMode, setConceptMode] = useState<'create' | 'link'>('create');
  const [conceptSearchQuery, setConceptSearchQuery] = useState('');
  const [conceptTermHe, setConceptTermHe] = useState('');
  const [conceptPattern, setConceptPattern] = useState('');
  const [conceptSummary, setConceptSummary] = useState('');

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

  const handleCreateAndLinkSage = async () => {
    if (!newSageName.trim() || !selectionMenu?.selectedText) return;
    const rawText = selectionMenu.selectedText;
    const created = await createSageProfile({
      name: newSageName.trim(),
      period: newSagePeriod,
      period_ru: newSagePeriodRu,
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
            name_he: newSageName.trim(),
            period: newSagePeriod,
            period_label_ru: newSagePeriodRu,
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

  const handleSaveConcept = async () => {
    if (!conceptTermHe.trim() || !conceptPattern.trim()) return;
    const cleanTermHe = DOMPurify.sanitize(conceptTermHe.trim());
    const cleanSummaryText = DOMPurify.sanitize(conceptSummary.trim());
    const summaryHtml = cleanSummaryText ? `<p>${cleanSummaryText}</p>` : `<p>${cleanTermHe}</p>`;
    const ok = await addCustomConcept(conceptTermHe.trim(), conceptPattern.trim(), summaryHtml);
    if (ok) {
      const cleanTerm = cleanTermHe.replace(/\s+/g, '-');
      const slug = `custom-${cleanTerm}`;
      setLocalConceptHighlights(prev => [
        ...prev,
        {
          slug,
          term_he: cleanTermHe,
          search_patterns: [conceptPattern.trim()],
          short_summary_html: summaryHtml,
        }
      ]);
    }
    setShowConceptModal(false);
    setSelectionMenu(null);
  };

  const filteredConcepts = useMemo(() => {
    if (!conceptSearchQuery.trim()) return localConceptHighlights;
    const q = conceptSearchQuery.toLowerCase();
    return localConceptHighlights.filter(c =>
      (c.term_he && c.term_he.toLowerCase().includes(q)) ||
      (c.slug && c.slug.toLowerCase().includes(q))
    );
  }, [localConceptHighlights, conceptSearchQuery]);


  const filteredSages = useMemo(() => {
    if (!sageSearchQuery.trim()) return localSageHighlights;
    const q = sageSearchQuery.toLowerCase();
    return localSageHighlights.filter(s => 
      (s.name_he && s.name_he.toLowerCase().includes(q)) ||
      (s.name_ru && s.name_ru.toLowerCase().includes(q)) ||
      (s.slug && s.slug.toLowerCase().includes(q))
    );
  }, [localSageHighlights, sageSearchQuery]);

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
    return dafRef.toLowerCase().endsWith('a');
  }, [dafRef]);

  const leftTitle = isAmudA ? 'Tosafot' : 'Rashi';
  const rightTitle = isAmudA ? 'Rashi' : 'Tosafot';

  const rashiComments = useMemo(() => {
    return comments.filter(c => c && c.commentator?.toLowerCase().includes('rashi'));
  }, [comments]);

  const tosafotComments = useMemo(() => {
    return comments.filter(c => c && c.commentator?.toLowerCase().includes('tosafot'));
  }, [comments]);

  const leftColumn = isAmudA ? tosafotComments : rashiComments;
  const rightColumn = isAmudA ? rashiComments : tosafotComments;

  const handleGemaraClick = (e: React.MouseEvent, ref: string) => {
    setActiveSegmentRef(ref);
    onSegmentClick?.(ref);

    const dhSpan = (e.target as HTMLElement).closest('.highlight-dh');
    if (dhSpan) {
      const commentRef = dhSpan.getAttribute('data-comment-ref');
      if (commentRef) {
        setActiveCommentRef(commentRef);
        const el = rashiRefs.current[commentRef] || tosafotRefs.current[commentRef];
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    }
  };

  const handleGemaraMouseUp = () => {
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

          <div className="flex items-center bg-muted rounded-md p-1 gap-1">
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2", !showVowels && "bg-primary/10")} 
              onClick={() => setShowVowels(!showVowels)}
              aria-label="Огласовки"
              title="Vowels (Огласовки)"
            >
              <Type className={cn("w-4 h-4", showVowels ? "opacity-40" : "text-primary")} />
            </Button>
            
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2", !showPunctuation && "bg-primary/10")} 
              onClick={() => setShowPunctuation(!showPunctuation)}
              aria-label="Пунктуация"
              title="Punctuation (Пунктуация)"
            >
              <Quote className={cn("w-4 h-4", showPunctuation ? "opacity-40" : "text-primary")} />
            </Button>
          </div>

          <div className="flex items-center bg-muted rounded-md p-1 gap-1" title="Размер шрифта комментариев Раши и Тосфот">
            <Button 
              variant="ghost" size="sm" 
              className="h-7 px-1.5 text-xs font-bold" 
              disabled={commentFontSize === 'sm'}
              onClick={handleDecreaseCommentFontSize}
              aria-label="Уменьшить шрифт"
              title="Уменьшить шрифт Раши и Тосфот"
            >
              A-
            </Button>
            <span className="text-[10px] uppercase font-bold px-1 opacity-50 select-none">
              {commentFontSize}
            </span>
            <Button 
              variant="ghost" size="sm" 
              className="h-7 px-1.5 text-xs font-bold" 
              disabled={commentFontSize === 'xl'}
              onClick={handleIncreaseCommentFontSize}
              aria-label="Увеличить шрифт"
              title="Увеличить шрифт Раши и Тосфот"
            >
              A+
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

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden p-0 gap-0">
        {/* Left Column (Tosafot or Rashi depending on Amud) */}
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
        />

        {/* Center Column (Gemara) */}
        <div 
          ref={gemaraContainerRef}
          className="flex-1 flex flex-col bg-card/20 overflow-hidden relative"
          onMouseOver={handleHighlightMouseOver}
          onMouseOut={handleHighlightMouseOut}
          onMouseUp={handleGemaraMouseUp}
        >
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
              aria-label="Скопировать Гемару"
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
                onClick={() => {
                  setSageSearchQuery('');
                  setShowSageModal(true);
                }}
              >
                <UserPlus className="w-3.5 h-3.5 text-amber-500" />
                <span>Связать с мудрецом</span>
              </Button>
              <div className="w-px h-4 bg-border/60" />
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs font-medium gap-1 hover:bg-blue-500/10 hover:text-blue-600"
                onClick={() => {
                  setConceptTermHe(selectionMenu.selectedText);
                  setConceptPattern(selectionMenu.selectedText);
                  setShowConceptModal(true);
                }}
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

        {/* Right Column (Rashi or Tosafot depending on Amud) */}
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
        />
      </div>

      {/* Sage Search & Link Modal */}
      {showSageModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-popover text-popover-foreground rounded-xl border border-border shadow-xl max-w-md w-full p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-sm">Связать текст «{selectionMenu?.selectedText}» с мудрецом</h3>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowSageModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 absolute left-2.5 top-2.5 opacity-50" />
              <input
                type="text"
                value={sageSearchQuery}
                onChange={(e) => setSageSearchQuery(e.target.value)}
                placeholder="Поиск мудреца (имя, slug)..."
                className="w-full bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            <div className="max-h-60 overflow-y-auto flex flex-col gap-1 pr-1">
              {filteredSages.length > 0 ? (
                filteredSages.map(s => (
                  <button
                    key={s.slug}
                    onClick={() => handleLinkSage(s.slug)}
                    className="flex items-center justify-between p-2 rounded-md hover:bg-primary/10 text-right transition-colors text-xs"
                  >
                    <span className="font-bold">{s.name_he || s.slug}</span>
                    <span className="text-[10px] opacity-60 font-sans">{s.name_ru || s.period}</span>
                  </button>
                ))
              ) : (
                <div className="text-center py-4 text-xs opacity-60">Мудрецы не найдены</div>
              )}
            </div>

            <div className="border-t border-border pt-2 flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                className="text-xs gap-1"
                onClick={() => {
                  setShowSageModal(false);
                  setNewSageName(selectionMenu?.selectedText || '');
                  setShowCreateSageModal(true);
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Создать нового мудреца</span>
              </Button>
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowSageModal(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create New Sage Modal */}
      {showCreateSageModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-popover text-popover-foreground rounded-xl border border-border shadow-xl max-w-sm w-full p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-sm">Создание карточки мудреца</h3>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowCreateSageModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex flex-col gap-2 text-xs">
              <label className="font-medium">Имя на иврите / slug:</label>
              <input
                type="text"
                value={newSageName}
                onChange={(e) => setNewSageName(e.target.value)}
                className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
                dir="rtl"
              />

              <label className="font-medium">Эпоха (Period):</label>
              <select
                value={newSagePeriod}
                onChange={(e) => {
                  setNewSagePeriod(e.target.value);
                  setNewSagePeriodRu(e.target.options[e.target.selectedIndex].text);
                }}
                className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
              >
                <option value="amoraim">Амораим</option>
                <option value="tannaim">Таннаим</option>
                <option value="zugot">Зугот</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowCreateSageModal(false)}>
                Отмена
              </Button>
              <Button size="sm" className="text-xs font-bold" onClick={handleCreateAndLinkSage}>
                Создать и связать
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Concept Modal with [WILD] & Description */}
      {showConceptModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-popover text-popover-foreground rounded-xl border border-border shadow-xl max-w-md w-full p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="font-bold text-sm">Фраза / Понятие: «{selectionMenu?.selectedText}»</h3>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowConceptModal(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex bg-muted/40 p-1 rounded-lg gap-1 text-xs font-medium">
              <button
                className={cn("flex-1 py-1 rounded transition-all", conceptMode === 'create' ? "bg-background text-foreground shadow-sm font-bold" : "opacity-60 hover:opacity-100")}
                onClick={() => setConceptMode('create')}
              >
                + Новое понятие с описанием
              </button>
              <button
                className={cn("flex-1 py-1 rounded transition-all", conceptMode === 'link' ? "bg-background text-foreground shadow-sm font-bold" : "opacity-60 hover:opacity-100")}
                onClick={() => setConceptMode('link')}
              >
                Связать с существенным
              </button>
            </div>

            {conceptMode === 'link' ? (
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2.5 top-2.5 opacity-50" />
                  <input
                    type="text"
                    value={conceptSearchQuery}
                    onChange={(e) => setConceptSearchQuery(e.target.value)}
                    placeholder="Поиск существующего понятия..."
                    className="w-full bg-muted/30 border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto flex flex-col gap-1 pr-1">
                  {filteredConcepts.length > 0 ? (
                    filteredConcepts.map(c => (
                      <button
                        key={c.slug}
                        onClick={() => handleLinkConcept(c.slug)}
                        className="flex flex-col p-2 rounded-md hover:bg-primary/10 text-right transition-colors text-xs"
                      >
                        <span className="font-bold">{c.term_he || c.slug}</span>
                        {c.short_summary_html && (
                          <span
                            className="text-[10px] opacity-60 font-sans line-clamp-1"
                            dangerouslySetInnerHTML={{ __html: c.short_summary_html }}
                          />
                        )}
                      </button>
                    ))
                  ) : (
                    <div className="text-center py-4 text-xs opacity-60">Понятия не найдены</div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 text-xs">
                <label className="font-medium">Название понятия / выражения:</label>
                <input
                  type="text"
                  value={conceptTermHe}
                  onChange={(e) => setConceptTermHe(e.target.value)}
                  className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
                  dir="rtl"
                />

                <label className="font-medium flex items-center justify-between">
                  <span>Шаблон совпадения (с [WILD]):</span>
                  <button
                    type="button"
                    className="text-primary hover:underline text-[10px]"
                    onClick={() => setConceptPattern(prev => `${prev} [WILD]`)}
                  >
                    + Вставить [WILD]
                  </button>
                </label>
                <input
                  type="text"
                  value={conceptPattern}
                  onChange={(e) => setConceptPattern(e.target.value)}
                  placeholder="Пример: ואזל [WILD] לטעמיה"
                  className="bg-muted/30 border border-border rounded px-2 py-1 text-xs"
                  dir="rtl"
                />

                <label className="font-medium">Описание / определение фразы (выводится в всплывающей карточке):</label>
                <textarea
                  value={conceptSummary}
                  onChange={(e) => setConceptSummary(e.target.value)}
                  placeholder="Введите описание, разбор или комментарий к этой фразе..."
                  rows={3}
                  className="bg-muted/30 border border-border rounded px-2 py-1.5 text-xs resize-none"
                />

                <span className="text-[10px] opacity-60">Токен [WILD] совпадает с 1-3 переменными еврейскими словами с огласовками.</span>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-border">
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setShowConceptModal(false)}>
                Отмена
              </Button>
              {conceptMode === 'create' && (
                <Button size="sm" className="text-xs font-bold" onClick={handleSaveConcept}>
                  Сохранить фразу и описание
                </Button>
              )}
            </div>
          </div>
        </div>
      )}


      {hoverCard && (
        <div
          className="fixed z-[100] w-72 max-w-[90vw] -translate-x-1/2 -translate-y-full pb-2 transition-opacity duration-150 pointer-events-none"
          style={{ left: `${hoverCard.x}px`, top: `${hoverCard.y - 6}px` }}
        >
          <div className="rounded-xl border border-border/80 bg-popover p-3 text-popover-foreground shadow-2xl backdrop-blur-md space-y-1.5 text-xs">
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {hoverCard.type}
              </span>
            </div>

            {hoverCard.label && (
              <div className="text-base font-semibold leading-tight text-foreground">
                {hoverCard.label}
              </div>
            )}

            {hoverCard.summary ? (
              <div
                className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:leading-snug prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 dark:prose-invert"
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(hoverCard.summary) }}
              />
            ) : null}
          </div>
        </div>
      )}

      <ProfileInspectorModal
        slug={profileModalSlug}
        open={Boolean(profileModalSlug)}
        onClose={() => setProfileModalSlug(null)}
        hideWorkSection
      />
    </div>
  );
};
