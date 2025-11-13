import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Compass, Settings } from 'lucide-react';

import { FocusReaderProps, TextSegment } from '../../types/text';
import { normalizeRefForAPI, parseRefSmart } from '../../utils/refUtils';
import ContinuousTextFlow from './ContinuousTextFlow';
import FocusNavOverlay from './nav/FocusNavOverlay';
import { useTranslation } from '../../hooks/useTranslation';
import { useSpeechify } from '../../hooks/useSpeechify';
import { useTTS } from '../../hooks/useTTS';
import { debugWarn } from '../../utils/debugLogger';
// import { useKeyboardNavigation } from '../../hooks/useKeyboardNavigation';

const FONT_SIZE_VALUES: Record<string, string> = {
  small: '0.95rem',
  medium: '1.05rem',
  large: '1.15rem',
};

const FOCUS_READER_SETTINGS_KEY = 'focus-reader-font-settings';

function formatDisplayRef(ref?: string | null): string {
  if (!ref) return '—';
  const dotMatch = ref.match(/^(?<book>.+?)\s+(?<chapter>\d+)\.(?<verse>\d+)$/);
  if (dotMatch?.groups) {
    return `${dotMatch.groups.book} ${dotMatch.groups.chapter}:${dotMatch.groups.verse}`;
  }
  const parsed = parseRefSmart(ref);
  if (parsed?.type === 'tanakh') {
    if (parsed.chapter != null && parsed.verse != null) {
      return `${parsed.book} ${parsed.chapter}:${parsed.verse}`;
    }
    if (parsed.chapter != null) {
      return `${parsed.book} ${parsed.chapter}`;
    }
    return parsed.book;
  }
  if (parsed?.type === 'talmud' && parsed.daf != null) {
    const amud = parsed.amud ?? 'a';
    if (parsed.segment != null) {
      return `${parsed.book} ${parsed.daf}${amud}:${parsed.segment}`;
    }
    return `${parsed.book} ${parsed.daf}${amud}`;
  }
  return normalizeRefForAPI(ref);
}

// Функция для чтения начальных настроек шрифта из localStorage
function readInitialFontSettings() {
  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(FOCUS_READER_SETTINGS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          readerFontSize: ['small', 'medium', 'large'].includes(parsed.readerFontSize) ? parsed.readerFontSize : 'medium',
          hebrewScale: typeof parsed.hebrewScale === 'number' && parsed.hebrewScale >= 1.0 && parsed.hebrewScale <= 2.0 ? parsed.hebrewScale : 1.2,
          translationScale: typeof parsed.translationScale === 'number' && parsed.translationScale >= 0.8 && parsed.translationScale <= 2.0 ? parsed.translationScale : 1.2,
        };
      }
    } catch (err) {}
  }
  return { readerFontSize: 'medium', hebrewScale: 1.2, translationScale: 1.2 };
}

const FocusReader = memo(({
  continuousText,
  error,
  onSegmentClick,
  onNavigateToRef,
  onLexiconDoubleClick,
  currentRef,
  onToggleLeftPanel,
  onToggleRightPanel,
  showLeftPanel,
  showRightPanel,
}: FocusReaderProps) => {
  const focusRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef(false);
  const scrollLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [showTranslation, setShowTranslation] = useState(false);
  const [stableTranslatedText, setStableTranslatedText] = useState('');
  const initialFontSettings = readInitialFontSettings();
  const [readerFontSize, setReaderFontSize] = useState<'small' | 'medium' | 'large'>(() => initialFontSettings.readerFontSize);
  const [hebrewScale, setHebrewScale] = useState(() => initialFontSettings.hebrewScale);
  const [translationScale, setTranslationScale] = useState(() => initialFontSettings.translationScale);
  const [activeTTSRef, setActiveTTSRef] = useState<string | null>(null);

  const activeSegment = useMemo(() => {
    const index = continuousText?.focusIndex ?? 0;
    return continuousText?.segments?.[index];
  }, [continuousText]);

  const activeSegmentRef = activeSegment?.ref ?? null;
  const hebrewText = activeSegment?.heText || '';
  const englishText = activeSegment?.text || '';

  const { translatedText, isTranslating, translate, clear } = useTranslation({
    tref: activeSegment?.ref || '',
  });

  // Стабилизируем переведенный текст
  useEffect(() => {
    if (translatedText && translatedText.trim()) {
      setStableTranslatedText(translatedText);
    }
  }, [translatedText]);

  // Очищаем стабильный текст при смене сегмента
  useEffect(() => {
    setStableTranslatedText('');
  }, [activeSegment?.ref]);

  const { speechify } = useSpeechify();

  const {
    isPlaying: ttsIsPlaying,
    isPaused,
    play,
    stop,
    pause: pauseTTS,
    resume,
  } = useTTS({
    language: 'ru',
    speed: 1.0,
  });

  const hasHebrew = useMemo(() => hebrewText.trim().length > 0, [hebrewText]);
  const hasEnglish = useMemo(() => englishText.trim().length > 0, [englishText]);

  const sanitizeText = useCallback((value: string) => {
    return value
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }, []);

  const sanitizedHebrew = useMemo(() => sanitizeText(hebrewText), [hebrewText, sanitizeText]);
  const sanitizedEnglish = useMemo(() => sanitizeText(englishText), [englishText, sanitizeText]);

  const isActiveTTS = activeTTSRef === activeSegmentRef && (ttsIsPlaying || isPaused);
  const isCurrentSegmentPlaying = isActiveTTS && ttsIsPlaying;
  const leftPanelIsVisible = showLeftPanel !== false;
  const rightPanelIsVisible = showRightPanel !== false;

  const inlineChapterButtonClass =
    'inline-flex items-center justify-center gap-1 px-2.5 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70';
  const inlineChapterGroupClass =
    'inline-flex overflow-hidden rounded-full border border-border/60 bg-background/70 text-foreground/80 shadow-sm';

  const getChapterIdentifier = useCallback((segment?: TextSegment | null) => {
    if (!segment) return null;
    const metadata = segment.metadata;
    if (metadata?.chapter != null) {
      return `chapter:${metadata.chapter}`;
    }
    if (metadata?.page) {
      return `page:${metadata.page}`;
    }
    if (metadata?.title) {
      return `title:${metadata.title}`;
    }
    if (metadata?.indexTitle) {
      return `index:${metadata.indexTitle}`;
    }
    if (segment.ref) {
      const [base] = segment.ref.split(':');
      return `ref:${base}`;
    }
    return null;
  }, []);

  const handleChapterNavigation = useCallback(
    (direction: 'prev' | 'next') => {
      if (!continuousText?.segments?.length || !onNavigateToRef) {
        return;
      }

      const segments = continuousText.segments;
      const focusIndex =
        typeof continuousText.focusIndex === 'number'
          ? Math.min(Math.max(continuousText.focusIndex, 0), segments.length - 1)
          : Math.max(
              segments.findIndex((segment) => segment.ref === activeSegment?.ref),
              0
            );

      const currentSegment = segments[focusIndex] ?? activeSegment ?? null;
      const currentIdentifier = getChapterIdentifier(currentSegment);
      if (!currentIdentifier) {
        return;
      }

      if (direction === 'prev') {
        for (let idx = focusIndex - 1; idx >= 0; idx -= 1) {
          const candidate = segments[idx];
          const candidateIdentifier = getChapterIdentifier(candidate);
          if (candidateIdentifier && candidateIdentifier !== currentIdentifier) {
            onNavigateToRef(candidate.ref, candidate);
            return;
          }
        }
      } else {
        for (let idx = focusIndex + 1; idx < segments.length; idx += 1) {
          const candidate = segments[idx];
          const candidateIdentifier = getChapterIdentifier(candidate);
          if (candidateIdentifier && candidateIdentifier !== currentIdentifier) {
            onNavigateToRef(candidate.ref, candidate);
            return;
          }
        }
      }

      const fallbackRef =
        direction === 'prev'
          ? continuousText.chapterNavigation?.prev
          : continuousText.chapterNavigation?.next;
      if (fallbackRef) {
        onNavigateToRef(fallbackRef);
      }
    },
    [continuousText, onNavigateToRef, activeSegment, getChapterIdentifier]
  );

  const handleNavigatePrevChapter = useCallback(() => {
    handleChapterNavigation('prev');
  }, [handleChapterNavigation]);

  const handleNavigateNextChapter = useCallback(() => {
    handleChapterNavigation('next');
  }, [handleChapterNavigation]);

  const canNavigateToPreviousChapter = useMemo(() => {
    if (!continuousText?.segments?.length) {
      return false;
    }
    const segments = continuousText.segments;
    const focusIndex =
      typeof continuousText.focusIndex === 'number'
        ? Math.min(Math.max(continuousText.focusIndex, 0), segments.length - 1)
        : Math.max(
            segments.findIndex((segment) => segment.ref === activeSegment?.ref),
            0
          );
    const currentSegment = segments[focusIndex] ?? activeSegment ?? null;
    const currentIdentifier = getChapterIdentifier(currentSegment);
    if (!currentIdentifier) {
      return false;
    }
    for (let idx = focusIndex - 1; idx >= 0; idx -= 1) {
      const candidateIdentifier = getChapterIdentifier(segments[idx]);
      if (candidateIdentifier && candidateIdentifier !== currentIdentifier) {
        return true;
      }
    }
    return Boolean(continuousText.chapterNavigation?.prev);
  }, [continuousText, activeSegment, getChapterIdentifier]);

  const canNavigateToNextChapter = useMemo(() => {
    if (!continuousText?.segments?.length) {
      return false;
    }
    const segments = continuousText.segments;
    const focusIndex =
      typeof continuousText.focusIndex === 'number'
        ? Math.min(Math.max(continuousText.focusIndex, 0), segments.length - 1)
        : Math.max(
            segments.findIndex((segment) => segment.ref === activeSegment?.ref),
            0
          );
    const currentSegment = segments[focusIndex] ?? activeSegment ?? null;
    const currentIdentifier = getChapterIdentifier(currentSegment);
    if (!currentIdentifier) {
      return false;
    }
    for (let idx = focusIndex + 1; idx < segments.length; idx += 1) {
      const candidateIdentifier = getChapterIdentifier(segments[idx]);
      if (candidateIdentifier && candidateIdentifier !== currentIdentifier) {
        return true;
      }
    }
    return Boolean(continuousText.chapterNavigation?.next);
  }, [continuousText, activeSegment, getChapterIdentifier]);

  useEffect(() => {
    if (focusRef.current && !scrollLockRef.current) {
    focusRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
    });
    }
  }, [continuousText?.focusIndex]);

  useEffect(() => {
    clear();
    stop().catch(() => {});
    setActiveTTSRef(null);
  }, [activeSegmentRef, clear, stop]);

  // Убираем автоматический перевод - пользователь сам нажимает кнопку
  // useEffect(() => {
  //   if (showTranslation && activeSegment && !translatedText && !isTranslating) {
  //     translate().catch(() => {});
  //   }
  // }, [showTranslation, activeSegment, translatedText, isTranslating, translate]);

  useEffect(() => {
    return () => {
      if (scrollLockTimeoutRef.current) {
        clearTimeout(scrollLockTimeoutRef.current);
      }
      stop().catch(() => {});
      setActiveTTSRef(null);
    };
  }, [stop]);

  const handlePlayClick = useCallback(async () => {
    if (!hasHebrew && !hasEnglish) {
      return;
    }

    try {
      if (isActiveTTS) {
        if (ttsIsPlaying) {
          await pauseTTS();
        } else if (isPaused) {
          await resume();
        } else {
          await stop();
          setActiveTTSRef(null);
        }
        return;
      }

      await stop();
      setActiveTTSRef(null);

      let textToSpeak = '';
      let playbackLanguage: 'ru' | 'en' = 'ru';

      try {
        const response = await speechify({
          hebrewText: sanitizeText(hebrewText),
          englishText: sanitizeText(englishText),
        });
        const trimmed = typeof response === 'string' ? response.trim() : '';
        if (trimmed) {
          textToSpeak = trimmed;
        }
      } catch (err) {
        debugWarn('[FocusReader] Speechify failed, fallback to direct text', err);
      }

      if (!textToSpeak) {
        const fallback = sanitizedEnglish || sanitizedHebrew;
        if (!fallback) {
          return;
        }
        textToSpeak = fallback;
        playbackLanguage = sanitizedEnglish ? 'en' : 'ru';
      }

      await play(textToSpeak, { language: playbackLanguage });
      setActiveTTSRef(activeSegmentRef);
    } catch (err) {
      debugWarn('[FocusReader] TTS error:', err);
      setActiveTTSRef(null);
    }
  }, [
    activeSegmentRef,
    englishText,
    hasEnglish,
    hasHebrew,
    hebrewText,
    isActiveTTS,
    isPaused,
    pauseTTS,
    play,
    resume,
    speechify,
    stop,
    ttsIsPlaying,
    sanitizeText,
    sanitizedEnglish,
    sanitizedHebrew,
  ]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const raw = window.localStorage.getItem(FOCUS_READER_SETTINGS_KEY);
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as {
        readerFontSize?: 'small' | 'medium' | 'large';
        hebrewScale?: number;
        translationScale?: number;
      };
      if (parsed.readerFontSize && ['small', 'medium', 'large'].includes(parsed.readerFontSize)) {
        setReaderFontSize(parsed.readerFontSize);
      }
      if (typeof parsed.hebrewScale === 'number' && parsed.hebrewScale >= 1.0 && parsed.hebrewScale <= 2.0) {
        setHebrewScale(parsed.hebrewScale);
      }
      if (typeof parsed.translationScale === 'number' && parsed.translationScale >= 0.8 && parsed.translationScale <= 2.0) {
        setTranslationScale(parsed.translationScale);
      }
    } catch (err) {
      debugWarn('[FocusReader] Failed to restore font settings', err);
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const payload = {
      readerFontSize,
      hebrewScale,
      translationScale,
    };
    try {
      window.localStorage.setItem(FOCUS_READER_SETTINGS_KEY, JSON.stringify(payload));
    } catch (err) {
      debugWarn('[FocusReader] Failed to persist font settings', err);
    }
  }, [readerFontSize, hebrewScale, translationScale]);

  const handleOverlayNavigate = useCallback(
    (ref: string) => {
      onNavigateToRef?.(normalizeRefForAPI(ref));
    },
    [onNavigateToRef],
  );

  const handleSegmentNavigation = useCallback(
    (ref: string, segment: TextSegment) => {
      onNavigateToRef?.(ref, segment);
      if (segment) {
        onSegmentClick?.(segment);
      }
    },
    [onNavigateToRef, onSegmentClick],
  );

  const fontSizeValues = useMemo(() => FONT_SIZE_VALUES, []);

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div className="text-red-500 mb-2">⚠️</div>
        <h3 className="text-lg font-medium mb-2">Ошибка</h3>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    );
  }

  // Убираем блокирующий спиннер загрузки - показываем контент сразу
  // if (isLoading) {
  //   return (
  //     <div className="h-full flex items-center justify-center">
  //       <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  //     </div>
  //   );
  // }

  if (!continuousText) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-center">
        <div className="text-muted-foreground">
          <div className="text-4xl mb-4">📖</div>
          <h3 className="text-lg font-medium mb-2">Текст не выбран</h3>
          <p className="text-sm">Выберите отрывок, чтобы начать чтение</p>
        </div>
      </div>
    );
  }

  const resolvedRefForDisplay = currentRef || activeSegment?.ref || '';
  const formattedDisplayRef = formatDisplayRef(resolvedRefForDisplay);
  const isTanakhPrimaryRef = useMemo(() => {
    if (!resolvedRefForDisplay) {
      return false;
    }
    const parsed = parseRefSmart(resolvedRefForDisplay);
    return parsed?.type === 'tanakh';
  }, [resolvedRefForDisplay]);

  return (
    <div className="relative h-full flex flex-col bg-background">
      <div className="flex-shrink-0 border-b panel-outer">
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleLeftPanel}
              disabled={!onToggleLeftPanel}
              className="h-8 w-8 grid place-items-center rounded-md border border-border/60 bg-background/90 text-foreground/80 hover:bg-accent/10 hover:text-foreground transition-colors disabled:opacity-50"
              title={leftPanelIsVisible ? "Hide left workbench" : "Show left workbench"}
              aria-label={leftPanelIsVisible ? "Hide left workbench" : "Show left workbench"}
            >
              {leftPanelIsVisible ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            
            <button
              type="button"
              onClick={() => setIsNavOpen(true)}
              className="h-8 w-8 grid place-items-center rounded-md border border-border/60 bg-background/90 text-foreground/80 hover:bg-accent/10 hover:text-foreground transition-colors"
              title="Open navigator"
              aria-label="Open navigator"
            >
              <Compass className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex-1 px-1">
            <div className="fr-badge w-full flex-wrap justify-center gap-2">
              <span className="font-mono truncate" dir="ltr">
                {formattedDisplayRef}
              </span>
              {isTanakhPrimaryRef && (
                <div
                  className={inlineChapterGroupClass}
                  dir="ltr"
                  role="group"
                  aria-label="Quick chapter navigation"
                >
                  <button
                    type="button"
                    onClick={handleNavigatePrevChapter}
                    disabled={!canNavigateToPreviousChapter}
                    className={`${inlineChapterButtonClass} ${
                      canNavigateToPreviousChapter
                        ? 'text-foreground hover:bg-accent/10'
                        : 'cursor-not-allowed text-muted-foreground opacity-50'
                    }`}
                    aria-label="Previous chapter"
                    title="Previous chapter"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                  <div className="h-full w-px bg-border/60" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={handleNavigateNextChapter}
                    disabled={!canNavigateToNextChapter}
                    className={`${inlineChapterButtonClass} ${
                      canNavigateToNextChapter
                        ? 'text-foreground hover:bg-accent/10'
                        : 'cursor-not-allowed text-muted-foreground opacity-50'
                    }`}
                    aria-label="Next chapter"
                    title="Next chapter"
                  >
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettings((prev) => !prev)}
              className={`h-8 w-8 grid place-items-center rounded-md border border-border/60 transition-colors hover:bg-accent/10 hover:text-foreground ${showSettings ? 'bg-accent/10 text-foreground' : 'bg-background/90 text-foreground/80'}`}
              title="Reader settings"
              aria-label="Reader settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            
            <button
              type="button"
              onClick={onToggleRightPanel}
              disabled={!onToggleRightPanel}
              className="h-8 w-8 grid place-items-center rounded-md border border-border/60 bg-background/90 text-foreground/80 hover:bg-accent/10 hover:text-foreground transition-colors disabled:opacity-50"
              title={rightPanelIsVisible ? "Hide right workbench" : "Show right workbench"}
              aria-label={rightPanelIsVisible ? "Hide right workbench" : "Show right workbench"}
            >
              {rightPanelIsVisible ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

        <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <ContinuousTextFlow
            segments={continuousText.segments}
            focusIndex={continuousText.focusIndex}
            onNavigateToRef={(ref, segment) => handleSegmentNavigation(ref, segment || continuousText.segments[continuousText.focusIndex])}
            onLexiconDoubleClick={onLexiconDoubleClick}
            focusRef={focusRef}
            showTranslation={showTranslation}
            translatedText={stableTranslatedText}
            isTranslating={isTranslating}
            scrollContainerRef={scrollContainerRef}
            fontSizeValues={fontSizeValues}
            readerFontSize={readerFontSize}
            hebrewScale={hebrewScale}
            translationScale={translationScale}
            translationRef={activeSegment?.ref || ''}
            setShowTranslation={setShowTranslation}
            translate={translate}
            currentTranslatedText={stableTranslatedText}
            isActive={isActiveTTS}
            ttsIsPlaying={isCurrentSegmentPlaying}
            handlePlayClick={handlePlayClick}
          />
          </div>
        
        {showSettings && (
          <div className="w-64 border-l panel-outer bg-background">
            <div className="p-4 border-b">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Настройки отображения
              </h3>
            </div>
            <div className="p-4 space-y-4">
              {/* Размер шрифта */}
              <div>
                <label className="text-sm font-medium mb-2 block">Размер шрифта</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setReaderFontSize('small')}
                    className={`px-2 py-1 text-xs rounded ${readerFontSize === 'small' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                  >
                    Малый
                  </button>
                  <button 
                    onClick={() => setReaderFontSize('medium')}
                    className={`px-2 py-1 text-xs rounded ${readerFontSize === 'medium' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                  >
                    Средний
                  </button>
                  <button 
                    onClick={() => setReaderFontSize('large')}
                    className={`px-2 py-1 text-xs rounded ${readerFontSize === 'large' ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80'}`}
                  >
                    Большой
                  </button>
                </div>
              </div>
              
              {/* Масштаб иврита */}
              <div>
                <label className="text-sm font-medium mb-2 block">Масштаб иврита: {hebrewScale.toFixed(1)}x</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setHebrewScale(Math.max(1.0, hebrewScale - 0.1))}
                    disabled={hebrewScale <= 1.0}
                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="text-xs text-muted-foreground">{hebrewScale.toFixed(1)}x</span>
                  <button 
                    onClick={() => setHebrewScale(Math.min(2.0, hebrewScale + 0.1))}
                    disabled={hebrewScale >= 2.0}
                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
              
              {/* Масштаб перевода */}
              <div>
                <label className="text-sm font-medium mb-2 block">Масштаб перевода: {translationScale.toFixed(1)}x</label>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setTranslationScale(Math.max(0.8, translationScale - 0.1))}
                    disabled={translationScale <= 0.8}
                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded disabled:opacity-50"
                  >
                    -
                  </button>
                  <span className="text-xs text-muted-foreground">{translationScale.toFixed(1)}x</span>
                  <button 
                    onClick={() => setTranslationScale(Math.min(2.0, translationScale + 0.1))}
                    disabled={translationScale >= 2.0}
                    className="px-2 py-1 text-xs bg-muted hover:bg-muted/80 rounded disabled:opacity-50"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <FocusNavOverlay
        open={isNavOpen}
        onClose={() => setIsNavOpen(false)}
        onSelectRef={handleOverlayNavigate}
        currentRef={currentRef || activeSegment?.ref}
      />
    </div>
  );
});

FocusReader.displayName = 'FocusReader';

export default FocusReader;
