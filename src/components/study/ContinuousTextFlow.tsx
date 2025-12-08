import React, { memo, forwardRef, useMemo } from 'react';
import { Languages, Play, Pause } from 'lucide-react';
import { TextSegment } from '../../types/text';
import { SageHighlight, ConceptHighlight } from '../../types/highlight';
import { shouldShowSeparator, getSeparatorText } from '../../utils/referenceUtils';
import { normalizeRefForAPI, refEquals, parseRefSmart } from '../../utils/refUtils';
import { containsHebrew } from '../../utils/hebrewUtils';
import { getTextDirection } from '../../utils/textUtils';

type CompiledSageHighlight = SageHighlight & { regex: RegExp };
type CompiledConceptHighlight = ConceptHighlight & { regexes: RegExp[] };

type ContinuousTextFlowProps = {
  segments: TextSegment[];
  focusIndex: number;
  onNavigateToRef?: (ref: string, segment?: TextSegment) => void;
  onLexiconDoubleClick?: (segment: TextSegment) => void | Promise<void>;
  focusRef: React.RefObject<HTMLDivElement>;
  showTranslation?: boolean;
  translatedText?: string;
  isTranslating?: boolean;
  scrollContainerRef: React.RefObject<HTMLDivElement>;
  fontSizeValues: Record<string, string>;
  readerFontSize: string;
  hebrewScale: number;
  translationScale: number;
  translationRef: string;
  setShowTranslation: (show: boolean) => void;
  translate: () => void;
  currentTranslatedText: string;
  lineHeight?: 'compact' | 'normal' | 'relaxed';
  isPlaying?: boolean;
  setIsPlaying?: (playing: boolean | ((prev: boolean) => boolean)) => void;
  isActive: boolean;
  ttsIsPlaying: boolean;
  handlePlayClick: () => Promise<void>;
  onTouchStart?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove?: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: (e: React.TouchEvent<HTMLDivElement>) => void;
  sageHighlights?: CompiledSageHighlight[];
  conceptHighlights?: CompiledConceptHighlight[];
  onHighlightMouseOver?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightMouseOut?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onHighlightClickCapture?: (e: React.MouseEvent<HTMLDivElement>) => void;
};

export const ContinuousTextFlow = memo(({
  segments = [],
  focusIndex,
  onNavigateToRef,
  onLexiconDoubleClick,
  focusRef,
  showTranslation = false,
  translatedText = '',
  isTranslating = false,
  scrollContainerRef,
  fontSizeValues,
  readerFontSize,
  hebrewScale,
  translationScale,
  translationRef,
  setShowTranslation,
  translate,
  currentTranslatedText,
  isActive,
  ttsIsPlaying,
  handlePlayClick,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  sageHighlights = [],
  conceptHighlights = [],
  onHighlightMouseOver,
  onHighlightMouseOut,
  onHighlightClickCapture,
}: ContinuousTextFlowProps) => {

  const safeFocusIndex = Math.min(
    Math.max(focusIndex ?? 0, 0),
    Math.max(segments.length - 1, 0),
  );

  return (
    <div
      ref={scrollContainerRef}
      className="h-full overflow-y-auto px-8 py-6 panel-inner relative"
      style={{
        // @ts-ignore
        ['--rail' as any]: '44px',
        overscrollBehavior: 'contain', // Предотвращаем scroll chaining
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseOver={onHighlightMouseOver}
      onMouseOut={onHighlightMouseOut}
      onClickCapture={onHighlightClickCapture}
    >
      <article className="mx-auto space-y-3 max-w-[600px] w-full">
        {segments.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            <p>Нет сегментов для отображения</p>
            <p className="text-xs mt-2 text-muted-foreground/70">Segments count: 0</p>
          </div>
        ) : (
          segments.map((segment, index) => {
            const isFocus = index === safeFocusIndex;
            const nextSegment = segments[index + 1];
            const showSeparator = nextSegment ? shouldShowSeparator(segment, nextSegment) : false;
            const separatorText = showSeparator ? getSeparatorText(segment, nextSegment) : '';
            const normalizedRef = normalizeRefForAPI(segment.ref);
            const translationVisible =
              showTranslation &&
              refEquals(translationRef, segment.ref) &&
              !!currentTranslatedText &&
              currentTranslatedText.trim().length > 0;

            const segmentNumber = segment.ref.split(/[:.]/).pop() || segment.ref;

            return (
              <React.Fragment key={segment.ref}>
                <div
                  className="relative group"
                  onClick={() => {
                    onNavigateToRef?.(normalizedRef, segment);
                  }}
                >
                  {/* Left rail: buttons outside, vertically centered */}
                  <div
                    className={`pointer-events-none absolute top-1/2 -translate-y-1/2 z-10 ${isFocus ? 'opacity-100' : 'opacity-0'} transition-opacity`}
                    style={{ left: 'calc(-1 * var(--rail))' }}
                    aria-hidden={!isFocus}
                  >
                    <div className={`pointer-events-auto select-none flex items-center gap-1 px-1.5 py-1 rounded-full border bg-background/85 backdrop-blur shadow-sm ${isFocus ? 'border-primary/40' : 'border-[var(--seg-chrome-border)]'}`}>
                      <button
                        type="button"
                        className={`fr-btn ${translationVisible ? 'is-active' : ''}`}
                        disabled={isTranslating}
                        title={translationVisible ? 'Скрыть перевод' : 'Показать перевод'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!translationVisible) { await translate(); setShowTranslation(true); }
                          else { setShowTranslation(false); }
                        }}
                      >
                        {isTranslating ? (
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-b-transparent" />
                        ) : (
                          <Languages className="h-4 w-4" />
                        )}
                      </button>

                      <button
                        type="button"
                        className={`fr-btn ${isActive ? 'is-active' : ''}`}
                        title={isActive ? (ttsIsPlaying ? 'Пауза' : 'Продолжить') : 'Прослушать отрывок'}
                        aria-pressed={isActive}
                        onClick={async (e) => { e.stopPropagation(); await handlePlayClick(); }}
                      >
                        {ttsIsPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Right rail: number outside, vertically centered */}
                  <div
                    className="pointer-events-none absolute top-1/2 -translate-y-1/2 z-10 opacity-60 transition-opacity"
                    style={{ right: 'calc(-1 * var(--rail) + 40px)' }}
                  >
                    <button
                      type="button"
                      className="pointer-events-auto select-none fr-badge font-medium shadow-sm"
                      title={`Скопировать ссылку: ${normalizedRef}`}
                      aria-label="Copy segment reference"
                      onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(normalizedRef); }}
                    >
                      {segmentNumber}
                    </button>
                  </div>

                  {/* Inner text container with background/border */}
                  <div
                    className={`rounded-[var(--seg-radius)] border transition-colors ${
                      isFocus ? 'bg-primary/10 border-primary/40 shadow-inner' : 'bg-muted/10 border-[var(--seg-border)]'
                    }`}
                    style={{ marginLeft: 'calc(var(--rail) + 12px)', marginRight: 'calc(var(--rail) + 12px)' }}
                  >
                    <div className="p-3 min-h-[44px]">
                      <TextSegmentComponent
                        ref={isFocus ? focusRef : undefined}
                        segment={segment}
                        isFocus={isFocus}
                        showTranslation={translationVisible}
                        translatedText={translationVisible ? currentTranslatedText || translatedText : ''}
                        isTranslating={isTranslating}
                        onDoubleClick={onLexiconDoubleClick ? () => onLexiconDoubleClick(segment) : undefined}
                        fontSizeValues={fontSizeValues}
                        readerFontSize={readerFontSize}
                        hebrewScale={hebrewScale}
                        translationScale={translationScale}
                        className="w-full"
                        sageHighlights={sageHighlights}
                        conceptHighlights={conceptHighlights}
                      />
                    </div>
                  </div>
                </div>

                {showSeparator && (
                  <div className="relative my-0.5" style={{ marginLeft: 'calc(var(--rail) + 12px)', marginRight: 'calc(var(--rail) + 12px)' }}>
                    <div className="border-t border-[var(--seg-separator)]" />
                    {separatorText && (
                      <span className="absolute left-1/2 -top-2 -translate-x-1/2 bg-background px-1 text-[10px] text-muted-foreground/50">
                        {separatorText}
                      </span>
                    )}
                  </div>
                )}
              </React.Fragment>
            );
          })
        )}
      </article>
    </div>
  );
});

type TextSegmentComponentProps = {
  segment: TextSegment;
  isFocus: boolean;
  showTranslation: boolean;
  translatedText: string;
  isTranslating: boolean;
  onDoubleClick?: (segment: TextSegment) => void | Promise<void>;
  fontSizeValues: Record<string, string>;
  readerFontSize: string;
  hebrewScale: number;
  translationScale: number;
  className?: string;
  sageHighlights?: CompiledSageHighlight[];
  conceptHighlights?: CompiledConceptHighlight[];
};

const escapeAttr = (value: string) => (value || '').replace(/"/g, '&quot;');

const isTalmudOrMishnahRef = (ref?: string | null) => {
  if (!ref) return false;
  const parsed = parseRefSmart(ref);
  if (parsed?.type === 'talmud') {
    return true;
  }
  const lower = ref.toLowerCase();
  // Mishnah-like references: "Mishnah X 2:1" or "משנה"
  const looksLikeMishnah = lower.includes('mishnah') || lower.includes('mishna') || ref.includes('משנה');
  if (looksLikeMishnah && /\d+[:.]\d+/.test(ref)) {
    return true;
  }
  // Fallback: daf/amud pattern even if tractate name unknown to parser
  return /\d+[ab](?::\d+)?$/i.test(ref.trim());
};

// Применяем замену только к текстовым участкам, не трогая HTML-теги
const replaceOutsideTags = (html: string, regex: RegExp, replacer: (match: string) => string) => {
  const parts = html.split(/(<[^>]+>)/g);
  for (let i = 0; i < parts.length; i += 1) {
    if (parts[i].startsWith('<')) continue;
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

const TextSegmentComponent = memo(
  forwardRef<HTMLDivElement, TextSegmentComponentProps>(
    (
      {
        segment,
        isFocus,
        showTranslation,
        translatedText,
        isTranslating,
        onDoubleClick,
        fontSizeValues,
        readerFontSize,
        hebrewScale,
        translationScale,
        className = '',
        sageHighlights = [],
        conceptHighlights = [],
      },
      ref,
    ) => {
      const originalText = segment.heText || segment.text || '';
      
      // Стабилизируем текст - показываем перевод только если он есть и не пустой
      const textToRender = useMemo(() => {
        if (showTranslation && translatedText && translatedText.trim()) {
          return translatedText;
        }
        return originalText;
      }, [showTranslation, translatedText, originalText]);
      const talmudSegment = useMemo(() => isTalmudOrMishnahRef(segment.ref), [segment.ref]);
      const isHebrew = showTranslation ? false : containsHebrew(textToRender);
      const direction = showTranslation ? 'ltr' : getTextDirection(textToRender);
      const htmlToRender = useMemo(() => {
        if (isTranslating && showTranslation) {
          return '.';
        }
        if (!showTranslation && talmudSegment) {
          return renderHighlightedText(textToRender || '', sageHighlights, conceptHighlights);
        }
        return textToRender || '';
      }, [conceptHighlights, isTranslating, sageHighlights, showTranslation, talmudSegment, textToRender]);

      return (
        <div
          ref={ref}
          className={`seg select-text ${className} focus:outline-none focus:ring-0`}
          role="button"
          tabIndex={0}
          aria-current={isFocus ? 'true' : undefined}
          aria-label={`Text segment: ${segment.ref}`}
           onDoubleClick={(event) => {
             event.stopPropagation();
             if (onDoubleClick) {
               void onDoubleClick(segment);
             }
           }}
        >
          <div
            className={`whitespace-pre-wrap font-normal ${isHebrew ? 'text-right font-serif' : 'text-left'}`}
            dir={direction}
            style={{
              unicodeBidi: 'plaintext',
              wordBreak: isHebrew ? 'keep-all' : 'normal',
              fontSize: isHebrew
                ? `calc(${fontSizeValues[readerFontSize]} * ${hebrewScale})`
                : showTranslation
                ? `calc(${fontSizeValues[readerFontSize]} * ${translationScale})`
                : fontSizeValues[readerFontSize],
              lineHeight: isHebrew ? 'var(--lh-he)' : 'var(--lh)',
            }}
             dangerouslySetInnerHTML={{
               __html: htmlToRender,
             }}
          />
        </div>
      );
    },
  ),
);

export default ContinuousTextFlow;
