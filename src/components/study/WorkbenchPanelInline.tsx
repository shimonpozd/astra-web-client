import { useState, memo, useMemo, useEffect, useRef, useCallback } from "react";
import { BookOpen, Languages, Play, Pause, X } from "lucide-react";
import { containsHebrew } from "../../utils/hebrewUtils";
import { useTranslation } from "../../hooks/useTranslation";
import { useTTS } from "../../hooks/useTTS";
import { safeScrollIntoView } from "../../utils/scrollUtils";
import { useFontSettings } from "../../contexts/FontSettingsContext";
import { debugLog, debugWarn } from '../../utils/debugLogger';
// Note: Tooltip import would be added if using shadcn/ui

// Типы
interface WorkbenchItem {
  ref: string;
  title?: string;
  heTitle?: string;
  commentator?: string;
  heCommentator?: string;
  category?: string;
  heCategory?: string;
  preview?: string;
  hePreview?: string;
  text_full?: string;
  heTextFull?: string;
  language?: 'hebrew' | 'english' | 'aramaic' | 'mixed';
  // Новые поля из Bookshelf v2
  heRef?: string;
  indexTitle?: string;
  score?: number;
}

// Allow string refs as a fallback item shape
type WorkbenchItemLike = WorkbenchItem | string | null;

interface WorkbenchPanelProps {
  title: string;
  item: WorkbenchItemLike;
  active: boolean;
  selected?: boolean;
  onDropRef: (ref: string, dragData?: {
    type: 'single' | 'group' | 'part';
    data?: any;
  }) => void;
  onPanelClick?: () => void; // Выделение панели при любом клике
  onBorderClick?: () => void; // Фокус чата только при клике по границе
  className?: string;
  size?: 'compact' | 'normal' | 'expanded';
  hebrewScale?: number;           // default 1.35
  hebrewLineHeight?: 'compact' | 'normal' | 'relaxed'; // default 'relaxed'
  headerVariant?: 'hidden' | 'mini' | 'default'; // default 'mini'
  maxWidth?: 'narrow' | 'normal' | 'wide'; // default 'normal'
  onClear?: () => void; // Очистить панель
}

// Утилиты
const isDragDataValid = (dataTransfer: DataTransfer): boolean => {
  return dataTransfer.types.includes('text/astra-commentator-ref') ||
         dataTransfer.types.includes('text/plain') ||
         dataTransfer.types.includes('text/astra-group') ||
         dataTransfer.types.includes('text/astra-part');
};

const extractRefFromTransfer = (dataTransfer: DataTransfer): string | null => {
  return dataTransfer.getData('text/astra-commentator-ref') ||
         dataTransfer.getData('text/plain') ||
         null;
};

// Новая функция для извлечения данных о группе или части
const extractDragData = (dataTransfer: DataTransfer): {
  ref: string;
  type: 'single' | 'group' | 'part';
  data?: any;
} | null => {
  const ref = extractRefFromTransfer(dataTransfer);
  if (!ref) return null;

  // Проверяем, есть ли данные о группе
  const groupData = dataTransfer.getData('text/astra-group');
  if (groupData) {
    try {
      return {
        ref,
        type: 'group',
        data: JSON.parse(groupData)
      };
    } catch (e) {
      debugWarn('Failed to parse group data:', e);
    }
  }

  // Проверяем, есть ли данные о части
  const partData = dataTransfer.getData('text/astra-part');
  if (partData) {
    try {
      return {
        ref,
        type: 'part',
        data: JSON.parse(partData)
      };
    } catch (e) {
      debugWarn('Failed to parse part data:', e);
    }
  }

  // Обычный single ref
  return {
    ref,
    type: 'single'
  };
};

const getTextDirection = (text?: string): 'ltr' | 'rtl' => {
  if (!text) return 'ltr';
  return containsHebrew(text.slice(0, 50)) ? 'rtl' : 'ltr';
};

// Компоненты
const WorkbenchContainer = memo(({
  children,
  isOver,
  active,
  selected,
  onDragHandlers,
  onPanelClick,
  onBorderClick,
  className,
  item
}: {
  children: React.ReactNode;
  isOver: boolean;
  active: boolean;
  selected?: boolean;
  onDragHandlers: any;
  onPanelClick?: () => void; // Выделение панели при любом клике  
  onBorderClick?: () => void; // Фокус чата только при клике по границе
  className: string;
  item?: WorkbenchItem | null;
}) => {
  const stateClasses = useMemo(() => {
    if (isOver) return 'bg-primary/5';
    if (active) return 'bg-primary/10';
    return 'bg-card/60 hover:bg-card/80';
  }, [isOver, active]);

  return (
    <div
      className={`
        h-full flex flex-col rounded-xl border border-border/60
        bg-card/60 backdrop-blur-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40
        ${stateClasses} ${className} ${selected ? 'panel-selected' : ''}
        transition-colors duration-200
      `}
      {...onDragHandlers}
      onClick={(e: React.MouseEvent) => {
        // Выделение панели - при любом клике
        if (onPanelClick) {
          onPanelClick();
        }
        // Фокус чата - только при клике по границе (не по контенту)
        if (e.target === e.currentTarget && onBorderClick) {
          onBorderClick();
        }
      }}
      role="region"
      aria-labelledby={item ? `wbp-${item.ref}-title` : undefined}
    >
      {children}
    </div>
  );
});

const WorkbenchHeader = memo(({
  item,
  headerVariant,
  onToggleTranslate,
  isTranslating,
  translationActive,
  onToggleAudio,
  isAudioActive,
  isAudioPlaying,
  audioDisabled,
  audioLoading,
  onClear,
}: {
  item: WorkbenchItemLike;
  headerVariant: 'hidden' | 'mini' | 'default';
  onToggleTranslate?: () => void;
  isTranslating: boolean;
  translationActive: boolean;
  onToggleAudio?: () => void;
  isAudioActive: boolean;
  isAudioPlaying: boolean;
  audioDisabled: boolean;
  audioLoading: boolean;
  onClear?: () => void;
}) => {
  if (headerVariant === 'hidden') {
    return null;
  }

  const refString = typeof item === 'string' ? item : (item?.ref || '');
  const displayTitle =
    typeof item === 'string'
      ? item
      : item?.commentator ||
        item?.indexTitle ||
        item?.title ||
        refString ||
        '\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A';

  return (
    <header className="flex-shrink-0 flex items-center justify-between gap-2 px-2 py-1.5 sm:px-3 sm:py-2 border-b border-border/20">
      <div className="flex items-center gap-2 min-w-0">
        <div
          id={`wbp-${refString}-title`}
          className="min-w-0"
          title={refString ? `${displayTitle} - ${refString}` : displayTitle}
        >
          {headerVariant === 'mini' ? (
            <div className="text-xs font-mono text-muted-foreground truncate max-w-[160px] md:max-w-[200px] xl:max-w-[220px]">
              {refString}
            </div>
          ) : (
            <>
              <div className="text-sm font-medium truncate max-w-[180px] md:max-w-[220px] xl:max-w-[240px]">
                {displayTitle}
              </div>
              {refString && (
                <div className="text-xs font-mono text-muted-foreground truncate max-w-[160px] md:max-w-[200px] xl:max-w-[220px]">
                  {refString}
                </div>
              )}
            </>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        {onToggleTranslate && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleTranslate();
            }}
            className={`fr-btn ${translationActive ? 'is-active' : ''}`}
            disabled={isTranslating}
            aria-pressed={translationActive}
            aria-busy={isTranslating || undefined}
            title={translationActive ? "Показать оригинал" : "Перевести"}
          >
            {isTranslating ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-b-transparent" />
            ) : (
              <Languages className="h-4 w-4" />
            )}
          </button>
        )}
        {onToggleAudio && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onToggleAudio();
            }}
            className={`fr-btn ${isAudioActive ? 'is-active' : ''}`}
            disabled={audioDisabled || audioLoading}
            aria-pressed={isAudioActive}
            title={isAudioActive ? (isAudioPlaying ? "Пауза" : "Продолжить озвучку") : "Озвучить текст"}
          >
            {isAudioActive && isAudioPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>
        )}
        {onClear ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onClear();
            }}
            className="fr-btn text-muted-foreground hover:text-foreground"
            title="Очистить панель"
            aria-label="Очистить панель"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </header>
  );
});
const WorkbenchContent = memo(({
  item,
  // size, // Не используется - размеры теперь через CSS переменные
  active,
  hebrewScale,
  hebrewLineHeight,
  maxWidth,
  translatedText,
  error,
  fontSize,
  fontSizeValues
}: {
  item: WorkbenchItem;
  // size: 'compact' | 'normal' | 'expanded'; // Не используется
  active: boolean;
  hebrewScale: number;
  hebrewLineHeight: 'compact' | 'normal' | 'relaxed';
  maxWidth: 'narrow' | 'normal' | 'wide';
  translatedText?: string;
  error?: string;
  fontSize: 'small' | 'medium' | 'large' | 'xlarge' | 'xxlarge' | 'xxxlarge';
  fontSizeValues: Record<string, string>;
}) => {
  const articleRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollLockRef = useRef<boolean>(false);
  const scrollLockTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Защита от автоцентрирования при ручном скролле
  const setScrollLock = () => {
    scrollLockRef.current = true;
    if (scrollLockTimeoutRef.current) {
      clearTimeout(scrollLockTimeoutRef.current);
    }
    scrollLockTimeoutRef.current = setTimeout(() => {
      scrollLockRef.current = false;
    }, 1200); // 1.2 секунды защиты
  };

  // Автоцентрирование при активации (с защитой от конфликтов)
  useEffect(() => {
    if (active && articleRef.current && !scrollLockRef.current) {
      // Увеличиваем задержку для предотвращения мигания при drag&drop
      safeScrollIntoView(articleRef.current, {
        behavior: 'smooth',
        block: 'center'
      }, 300);
    }
  }, [active]);

  // Поддержка как старого, так и нового формата данных
  const displayText = item.preview || item.hePreview || '';
  const fullText = item.heTextFull || item.text_full || displayText;

  // Перевод теперь управляется на уровне основного компонента

  const textToDisplay = translatedText || fullText;

  // Определяем язык и направление на основе полного текста
  const textForDetection = textToDisplay;
  const direction = translatedText ? 'ltr' : getTextDirection(textForDetection); // Translations are left-to-right
  const isHebrew = translatedText ? false : containsHebrew(textForDetection); // Translations are not Hebrew

  // Межстрочный интервал для иврита
  const lineHeightClass = isHebrew
    ? (hebrewLineHeight === 'compact' ? 'leading-relaxed' : hebrewLineHeight === 'normal' ? 'leading-loose' : 'leading-[1.9]')
    : 'leading-relaxed';

  // Ширина колонки
  const maxWClass = maxWidth === 'narrow' ? 'max-w-2xl' : maxWidth === 'wide' ? 'max-w-4xl' : 'max-w-3xl';

  // Обработчики wheel/touch для scroll-lock
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // игнорируем совсем мелкие тапы трекпада
      if (Math.abs(e.deltaY) < 2 && Math.abs(e.deltaX) < 2) return;
      setScrollLock();
    };
    const handleTouchMove = () => setScrollLock();
    
    container.addEventListener('wheel', handleWheel, { passive: true });
    container.addEventListener('touchmove', handleTouchMove, { passive: true });

    return () => {
      container.removeEventListener('wheel', handleWheel);
      container.removeEventListener('touchmove', handleTouchMove);
      if (scrollLockTimeoutRef.current) {
        clearTimeout(scrollLockTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 scroll-smooth scrollbar-thin scrollbar-thumb-muted/50 hover:scrollbar-thumb-muted">
      <article
        ref={articleRef}
        className={`${maxWClass} mx-auto ${lineHeightClass} transition-opacity duration-150`}
        dir={direction}
        aria-current={active ? 'true' : undefined}
        style={{
          paddingBottom: '2px'
        }}
      >
        {error && <div className="flex justify-end mb-2"><span className="text-xs text-red-500" aria-live="polite">{error}</span></div>}
        <div 
          className={`
            // Размер теперь от переменной; иврит домножаем ниже
            ${direction === 'rtl' ? 'text-right font-hebrew' : 'text-left'}
            rounded-md select-text cursor-pointer
          `}
          style={{
            unicodeBidi: 'plaintext',
            wordBreak: direction === 'rtl' ? 'keep-all' : 'normal',
            fontFeatureSettings: direction === 'rtl' ? '"kern" 1, "liga" 1' : '"liga" 1, "calt" 1',
            textRendering: 'optimizeLegibility',
            WebkitFontSmoothing: 'antialiased',
            // Единый масштаб + домножение для иврита:
            fontSize: direction === 'rtl'
              ? `calc(${fontSizeValues[fontSize]} * ${Math.max(1, hebrewScale ?? 1.35)})`
              : fontSizeValues[fontSize],
          }}
          onDoubleClick={() => {
            const selected = (window.getSelection()?.toString() || '').trim();
            if (selected) {
              const context = (textToDisplay || '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
              // Trigger the same lexicon system
              window.dispatchEvent(new CustomEvent('lexicon-lookup', { 
                detail: { text: selected, context }
              }));
            }
          }}
        >
          {textToDisplay || 'Комментарий не загружен.'}
        </div>
      </article>
    </div>
  );
});

const EmptyWorkbenchPanel = memo(({
  title,
  onDrop
}: {
  title: string;
  onDrop: (ref: string, dragData?: {
    type: 'single' | 'group' | 'part';
    data?: any;
  }) => void;
}) => {
  const [isOver, setIsOver] = useState(false);
  const rafIdRef = useRef<number | null>(null);

  return (
    <div
      className={`
        h-full flex flex-col items-center justify-center rounded-xl border-2 border-dashed
        transition-colors duration-200 text-muted-foreground/60
        ${isOver
          ? 'border-primary bg-primary/5 text-primary/70'
          : 'border-border/40 bg-card/20 hover:border-primary/30'
        }
      `}
      onDragOver={(e) => {
        if (!isDragDataValid(e.dataTransfer)) return; // не ломаем скролл
        e.preventDefault();
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => setIsOver(true));
      }}
      onDragLeave={() => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        setIsOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        setIsOver(false);
        const dragData = extractDragData(e.dataTransfer);
        if (dragData) {
          if (process.env.NODE_ENV !== 'production') debugLog('Dropped in empty workbench:', dragData);
          if (dragData.type === 'group') {
            if (process.env.NODE_ENV !== 'production') debugLog('Dropped group with refs:', dragData.data?.refs);
            // TODO: Здесь можно добавить специальную обработку для групп
            // Пока используем первый ref из группы
          } else if (dragData.type === 'part') {
            if (process.env.NODE_ENV !== 'production') debugLog('Dropped individual part:', dragData.data?.ref);
          }
          onDrop(dragData.ref.trim(), {
            type: dragData.type,
            data: dragData.data
          });
        }
      }}
    >
      <div className="w-16 h-16 rounded-full border border-current/20 flex items-center justify-center mb-4">
        <BookOpen className="w-8 h-8" />
      </div>

      <h3 className="font-medium mb-2">{title}</h3>

      <p className="text-sm text-center max-w-32 leading-relaxed">
        Перетащите источник или комментарий сюда
      </p>

    </div>
  );
});

const WorkbenchPanelInline = memo(({
  title,
  item,
  active,
  selected = false,
  onDropRef,
  onPanelClick,
  onBorderClick,
  size = 'normal',
  hebrewScale: propHebrewScale,
  hebrewLineHeight: propHebrewLineHeight,
  headerVariant = 'mini',
  maxWidth = 'normal',
  onClear
}: WorkbenchPanelProps) => {
  // Глобальные настройки шрифта
  const { fontSettings, fontSizeValues } = useFontSettings();
  const hebrewScale = propHebrewScale ?? fontSettings.hebrewScale;
  const hebrewLineHeight = propHebrewLineHeight ?? fontSettings.lineHeight;

  // Отладка: логируем текущие настройки шрифта
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      debugLog('🔍 WorkbenchPanelInline font settings:', {
        fontSize: fontSettings.fontSize,
        fontSizeValue: fontSizeValues[fontSettings.fontSize],
        hebrewScale,
        hebrewScaleSource: propHebrewScale ? 'prop' : 'global',
        globalHebrewScale: fontSettings.hebrewScale,
        lineHeight: fontSettings.lineHeight,
        allFontSizeValues: fontSizeValues
      });
    }
  }, [fontSettings.fontSize, fontSizeValues, hebrewScale, fontSettings.lineHeight, propHebrewScale, fontSettings.hebrewScale]);
  const [isOver, setIsOver] = useState(false);
  const rafIdRef = useRef<number | null>(null);

  // Состояние для перевода (если есть item)
  const { translatedText, isTranslating, error, translate, clear } = useTranslation({
    tref: typeof item === 'string' ? item : item?.ref || '',
  });

  const {
    isPlaying,
    isPaused,
    currentText,
    isLoading: ttsLoading,
    play,
    stop,
    pause,
    resume,
  } = useTTS({ language: 'he', speed: 1.0 });

  // Состояние для отслеживания показа перевода
  const [showTranslation, setShowTranslation] = useState(false);
  const handlePanelClear = useCallback(() => {
    clear();
    setShowTranslation(false);
    stop().catch(() => {});
    onClear?.();
  }, [clear, onClear, stop]);

  // Сброс состояния перевода при смене элемента
  useEffect(() => {
    debugLog('[WorkbenchPanelInline] Item changed, resetting translation state');
    setShowTranslation(false);
  }, [typeof item === 'string' ? item : item?.ref]);

  // Отслеживание изменений состояния перевода
  useEffect(() => {
    debugLog('[WorkbenchPanelInline] Translation state changed:', {
      isTranslating,
      hasTranslatedText: !!translatedText,
      translatedTextLength: translatedText?.length || 0,
      error,
      showTranslation
    });
  }, [isTranslating, translatedText, error, showTranslation]);

  const handleTranslateToggle = useCallback(async () => {
    if (showTranslation) {
      setShowTranslation(false);
      return;
    }

    const resolvedTranslation = translatedText || await translate();
    if (resolvedTranslation && resolvedTranslation.trim()) {
      setShowTranslation(true);
    }
  }, [showTranslation, translatedText, translate]);

  const audioSourceRaw = typeof item === 'string'
    ? ''
    : item?.heTextFull || item?.text_full || item?.preview || item?.hePreview || '';
  const audioText = audioSourceRaw ? audioSourceRaw.trim() : '';
  const audioLanguage = containsHebrew(audioText.slice(0, 120)) ? 'he' : 'en';
  const isCurrentAudio = !!audioText && currentText === audioText;
  const isAudioActive = !!audioText && isCurrentAudio && (isPlaying || isPaused);
  const isAudioPlaying = !!audioText && isCurrentAudio && isPlaying;

  useEffect(() => {
    stop().catch(() => {});
  }, [typeof item === 'string' ? item : item?.ref, stop]);

  const handleAudioToggle = useCallback(async () => {
    if (!audioText) return;

    try {
      if (isCurrentAudio) {
        if (isPlaying) {
          await pause();
        } else if (isPaused) {
          await resume();
        } else {
          await stop();
        }
      } else {
        await stop();
        await play(audioText, { language: audioLanguage });
      }
    } catch (err) {
      console.error('[WorkbenchPanelInline] Audio toggle failed:', err);
    }
  }, [audioText, audioLanguage, isCurrentAudio, isPlaying, isPaused, pause, resume, stop, play]);

  // Функция для переключения между переводом и оригиналом
  // Получаем текст для озвучки


  // Вертикальная отзывчивость: убираем жесткие max-height, даем панели занимать всю доступную высоту
  const sizeConfig = {
    compact: { minHeight: 'h-full min-h-0' },
    normal: { minHeight: 'h-full min-h-0' },
    expanded: { minHeight: 'h-full min-h-0' },
  }[size];


  if (!item || typeof item === 'string') {
    return <EmptyWorkbenchPanel title={title} onDrop={onDropRef} />;
  }

  return (
    <div
      onDragOver={(e: React.DragEvent) => {
        if (!isDragDataValid(e.dataTransfer)) return;
        e.preventDefault();
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => setIsOver(true));
      }}
      onDragLeave={() => {
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        setIsOver(false);
      }}
      onDrop={(e: React.DragEvent) => {
        e.preventDefault();
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        setIsOver(false);
        const dragData = extractDragData(e.dataTransfer);
        if (!dragData) return;
          if (dragData.type === 'group') {
            if (process.env.NODE_ENV !== 'production') debugLog('Dropped group with refs:', dragData.data?.refs);
            // TODO: Здесь можно добавить специальную обработку для групп
            // Пока используем первый ref из группы
          } else if (dragData.type === 'part') {
            if (process.env.NODE_ENV !== 'production') debugLog('Dropped individual part:', dragData.data?.ref);
          }
          onDropRef(dragData.ref.trim(), {
            type: dragData.type,
            data: dragData.data
          });
        }
      }
      className={sizeConfig.minHeight}
    >
      <WorkbenchContainer
        isOver={isOver}
        active={active}
        selected={selected}
        onPanelClick={onPanelClick}
        onBorderClick={onBorderClick}
        onDragHandlers={{}}
        className=""
        item={item}
      >
      <WorkbenchHeader
        item={item}
        headerVariant={headerVariant}
        onToggleTranslate={handleTranslateToggle}
        isTranslating={isTranslating}
        translationActive={showTranslation}
        onToggleAudio={audioText ? handleAudioToggle : undefined}
        isAudioActive={isAudioActive}
        isAudioPlaying={isAudioPlaying}
        audioDisabled={!audioText}
        audioLoading={ttsLoading}
        onClear={onClear ? handlePanelClear : undefined}
      />

      <WorkbenchContent
        item={item}
        // size={size} // Не используется
        active={active}
        hebrewScale={hebrewScale}
        hebrewLineHeight={hebrewLineHeight}
        maxWidth={maxWidth}
        translatedText={showTranslation ? translatedText || undefined : undefined}
        error={error || undefined}
        fontSize={fontSettings.fontSize}
        fontSizeValues={fontSizeValues}
      />
      </WorkbenchContainer>
    </div>
  );
});

export default WorkbenchPanelInline;
