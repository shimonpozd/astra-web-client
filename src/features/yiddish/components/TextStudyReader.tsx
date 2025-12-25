import React, { useState, useEffect, useMemo, useCallback } from 'react';
import clsx from 'clsx';
import { YiddishNote, YiddishParagraph, YiddishToken, YiddishPosTag } from '@/types/yiddish';
import { HighlightMode, PopupMode } from '../state/yiddishStore';
import { Settings } from 'lucide-react';

/**
 * TypeScript типы для настроек типографики
 */
interface TypographySettings {
  fontSize: number;
  lineHeight: number;
  tracking: number;
  justify: boolean;
  hyphenation: boolean;
  ligatures: 'normal' | 'none';
  opticalSizing: boolean;
  darkMode: boolean;
  fontFamily: string;
}

/**
 * Типы пропсов компонента TextStudyReader
 */
interface TextStudyReaderProps {
  /** Текст для отображения: строка или массив абзацев */
  text?: string;
  /** Отображать панель управления (по умолчанию true) */
  showControls?: boolean;
  /** Начальный размер шрифта (по умолчанию 18) */
  initialFontSize?: number;
  /** Начальный межстрочный интервал (по умолчанию 1.55) */
  initialLineHeight?: number;
  /** Начальный трекинг в em (по умолчанию 0) */
  initialTracking?: number;
  /** Начальное выключение (по умолчанию true) */
  initialJustify?: boolean;
  /** Начальные переносы (по умолчанию true) */
  initialHyphenation?: boolean;
  /** Начальные лигатуры (по умолчанию "normal") */
  initialLigatures?: 'normal' | 'none';
  /** Начальный шрифт (по умолчанию "Noto Serif Yiddish") */
  initialFont?: string;
  /** Языковая настройка (по умолчанию "yi") */
  locale?: string;
  /** Темная тема (наследует prefers-color-scheme) */
  darkMode?: boolean;
  /** Сохранять настройки (по умолчанию true) */
  persistSettings?: boolean;
  
  // Существующие пропсы для обратной совместимости
  paragraphs?: YiddishParagraph[];
  ruParagraphs?: YiddishParagraph[];
  tokens?: YiddishToken[];
  notes?: YiddishNote[];
  highlightMode?: HighlightMode;
  popupMode?: PopupMode;
  onTokenSelect?: (token: YiddishToken, rect: DOMRect) => void;
  onTokenHoverEnd?: () => void;
  onTextSelect?: (text: string) => void;
  isLoading?: boolean;
  learnedMap?: Record<string, string[]>;
  knownLemmas?: Set<string>;
  posOverrides?: Record<string, YiddishPosTag>;
  showRu?: boolean;
}

/**
 * Хук для работы с localStorage с синхронизацией между вкладками
 */
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  const setValue = useCallback((value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  }, [key, storedValue]);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue));
        } catch (error) {
          console.warn(`Error parsing localStorage value for key "${key}":`, error);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue] as const;
}

/**
 * Хук для отслеживания медиа-запросов
 */
function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.matchMedia(query).matches;
    }
    return false;
  });

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    const handler = (event: MediaQueryListEvent) => setMatches(event.matches);

    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

/**
 * Утилиты для работы с идишским текстом
 */
const yiddishUtils = {
  /** Применение полукруглых кавычек для идиша */
  applyYiddishQuotes: (text: string): string => {
    return text
      .replace(/"([^"]*)"/g, '„$1"')
      .replace(/'([^']*)'/g, '‚$1\'');
  },
  
  /** Проверка на идишский текст */
  isYiddishText: (text: string): boolean => {
    const yiddishRegex = /[\u0590-\u05FF\u05D0-\u05F0]/;
    return yiddishRegex.test(text);
  },
  
  /** Получение CSS свойств для идишского шрифта */
  getYiddishFontCSS: (fontFamily: string): string => {
    return `"${fontFamily}", "Noto Serif", "Times New Roman", serif`;
  }
};

/**
 * Настройки по умолчанию
 */
const defaultSettings: TypographySettings = {
  fontSize: 18,
  lineHeight: 1.55,
  tracking: 0,
  justify: true,
  hyphenation: true,
  ligatures: 'normal',
  opticalSizing: true,
  darkMode: false,
  fontFamily: 'Noto Serif Yiddish'
};

const STORAGE_KEY = 'yiddish-reader-settings';

/**
 * Улучшенный компонент TextStudyReader с типографическими настройками
 */
export const TextStudyReader: React.FC<TextStudyReaderProps> = ({
  // Новые пропсы
  text,
  showControls = true,
  initialFontSize = 18,
  initialLineHeight = 1.55,
  initialTracking = 0,
  initialJustify = true,
  initialHyphenation = true,
  initialLigatures = 'normal',
  initialFont = 'Noto Serif Yiddish',
  locale = 'yi',
  darkMode: propDarkMode,
  persistSettings = true,
  
  // Существующие пропсы
  paragraphs,
  ruParagraphs,
  tokens,
  notes,
  highlightMode = 'off',
  popupMode = 'hover',
  onTokenSelect,
  onTokenHoverEnd,
  onTextSelect,
  isLoading,
  learnedMap = {},
  knownLemmas,
  posOverrides,
  showRu = false
}) => {
  // Определение темной темы
  const systemPrefersDark = useMedia('(prefers-color-scheme: dark)');
  const [darkMode, setDarkMode] = useLocalStorage('yiddish-reader-dark-mode', 
    propDarkMode !== undefined ? propDarkMode : systemPrefersDark
  );

  // Настройки типографики
  const initialSettings = useMemo(() => ({
    ...defaultSettings,
    fontSize: initialFontSize,
    lineHeight: initialLineHeight,
    tracking: initialTracking,
    justify: initialJustify,
    hyphenation: initialHyphenation,
    ligatures: initialLigatures,
    fontFamily: initialFont
  }), [initialFontSize, initialLineHeight, initialTracking, initialJustify, initialHyphenation, initialLigatures, initialFont]);

  const [settings, setSettings] = useLocalStorage<TypographySettings>(
    STORAGE_KEY, 
    persistSettings ? initialSettings : initialSettings
  );

  // Состояние панели управления
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  // Обработка текста для отображения
  const processedText = useMemo(() => {
    if (typeof text === 'string') {
      return text;
    }
    if (paragraphs && paragraphs.length > 0) {
      return paragraphs.map(p => p.text).join('\n\n');
    }
    return '';
  }, [text, paragraphs]);

  // Обработка горячих клавиш
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          setSettings(prev => ({ ...prev, fontSize: Math.min(28, prev.fontSize + 1) }));
          break;
        case '-':
          e.preventDefault();
          setSettings(prev => ({ ...prev, fontSize: Math.max(12, prev.fontSize - 1) }));
          break;
        case 'j':
        case 'J':
          e.preventDefault();
          setSettings(prev => ({ ...prev, justify: !prev.justify }));
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          setSettings(prev => ({ ...prev, hyphenation: !prev.hyphenation }));
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          setDarkMode(prev => !prev);
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [setSettings, setDarkMode]);

  // CSS стили для типографики (без проблемных свойств)
  const typographyStyles = useMemo(() => ({
    fontSize: `${settings.fontSize}px`,
    lineHeight: settings.lineHeight,
    letterSpacing: `${settings.tracking}em`,
    fontFamily: yiddishUtils.getYiddishFontCSS(settings.fontFamily),
    textAlign: settings.justify ? 'justify' as const : 'left' as const,
    textAlignLast: settings.justify ? 'auto' as const : undefined,
    textJustify: settings.justify ? 'inter-word' as const : undefined,
    language: locale
  }), [settings, locale]);

  // Обработчик изменения настроек
  const updateSetting = useCallback(<K extends keyof TypographySettings>(
    key: K, 
    value: TypographySettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, [setSettings]);

  // Существующая логика для работы с токенами (сохранена для обратной совместимости)
  const posClass: Record<string, string> = {
    NOUN: 'bg-amber-500/10 text-foreground/90 dark:bg-amber-400/10',
    VERB: 'bg-emerald-500/10 text-foreground/90 dark:bg-emerald-400/10',
    ADJ: 'bg-sky-500/10 text-foreground/90 dark:bg-sky-400/10',
    ADV: 'bg-indigo-500/10 text-foreground/90 dark:bg-indigo-400/10',
    PRON: 'bg-rose-500/10 text-foreground/90 dark:bg-rose-400/10',
    PREP: 'bg-lime-500/10 text-foreground/90 dark:bg-lime-400/10',
    CONJ: 'bg-orange-500/10 text-foreground/90 dark:bg-orange-400/10',
    PART: 'bg-cyan-500/10 text-foreground/90 dark:bg-cyan-400/10',
    DET: 'bg-cyan-500/10 text-foreground/90 dark:bg-cyan-400/10',
    HEB_LOAN: 'bg-yellow-500/10 text-foreground/90 dark:bg-yellow-400/10',
  };

  function wrapWithTokens(
    paragraph: YiddishParagraph,
    tokenList: YiddishToken[],
    highlightMode: HighlightMode,
    popupMode: PopupMode,
    learnedMap: Record<string, string[]>,
    onTokenSelect?: (token: YiddishToken, rect: DOMRect) => void,
  ) {
    if (!tokenList.length) {
      return <span>{yiddishUtils.applyYiddishQuotes(paragraph.text)}</span>;
    }

    const sorted = [...tokenList].sort((a, b) => a.start - b.start);
    const parts: React.ReactNode[] = [];
    let cursor = 0;

    sorted.forEach((token, idx) => {
      const safeStart = Math.max(0, token.start);
      const safeEnd = Math.max(safeStart, token.end);
      if (safeStart > cursor) {
        parts.push(<span key={`gap-${idx}`}>{paragraph.text.slice(cursor, safeStart)}</span>);
      }
      const surface = paragraph.text.slice(safeStart, safeEnd);
      const learned = !!learnedMap[token.lemma];
      const isKnown = knownLemmas
        ? (knownLemmas.has(token.lemma) || knownLemmas.has(token.surface))
        : true;
      const learnedActive = learned || token.learned || (Object.keys(learnedMap).length === 0 && isKnown);
      const resolvedPos = posOverrides?.[token.lemma] ?? posOverrides?.[token.surface] ?? token.pos;
      const cls = clsx(
        'rounded-sm px-0.5 transition-colors cursor-pointer',
        highlightMode === 'pos' && isKnown ? (posClass[resolvedPos] ?? 'bg-muted/40 text-foreground') : 'bg-transparent',
        {
          'ring-1 ring-amber-400/40 ring-offset-1 ring-offset-background dark:ring-amber-300/30': highlightMode === 'learned' && learnedActive,
        },
      );

      const eventProps =
        popupMode === 'hover'
          ? {
              onMouseEnter: (e: React.MouseEvent<HTMLSpanElement>) =>
                onTokenSelect?.(token, e.currentTarget.getBoundingClientRect()),
              onMouseLeave: () => onTokenHoverEnd?.(),
            }
          : {
              onClick: (e: React.MouseEvent<HTMLSpanElement>) =>
                onTokenSelect?.(token, e.currentTarget.getBoundingClientRect()),
            };

      parts.push(
        <span key={`tok-${token.pid}-${token.start}-${token.end}`} className={cls} {...eventProps}>
          {yiddishUtils.applyYiddishQuotes(surface || paragraph.text.slice(safeStart, safeEnd))}
        </span>,
      );
      cursor = safeEnd;
    });

    if (cursor < paragraph.text.length) {
      parts.push(<span key="tail">{paragraph.text.slice(cursor)}</span>);
    }

    return parts;
  }

  const tokensByPid = useMemo(() => {
    if (!tokens) return new Map();
    const map = new Map<string, YiddishToken[]>();
    tokens.forEach((t) => {
      const list = map.get(t.pid) || [];
      list.push(t);
      map.set(t.pid, list);
    });
    return map;
  }, [tokens]);

  const ruByPid = useMemo(() => {
    if (!ruParagraphs || ruParagraphs.length === 0) return new Map();
    const map = new Map<string, YiddishParagraph>();
    ruParagraphs.forEach((p) => {
      map.set(p.pid, p);
    });
    return map;
  }, [ruParagraphs]);

  const maxWidthClass = showRu ? 'max-w-[110ch]' : 'max-w-[60ch]';

  return (
    <div className="relative h-screen flex flex-col bg-background overflow-hidden">
      {/* Верхняя панель управления */}
      <div className="flex-shrink-0 border-b border-border bg-background">
        <div className="flex items-center justify-between gap-3 p-3">
          <div className="flex-1" />
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsPanel((prev) => !prev)}
              className={clsx(
                "h-8 w-8 grid place-items-center rounded-md border border-border/60 transition-colors",
                showSettingsPanel 
                  ? 'bg-accent/10 text-foreground' 
                  : 'bg-background/90 text-foreground/80 hover:bg-accent/10 hover:text-foreground'
              )}
              title="Настройки типографики (Alt+S)"
              aria-label="Настройки типографики"
              aria-expanded={showSettingsPanel}
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Основной контент с боковой панелью настроек */}
      <div className="flex-1 flex overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          {/* Читалка */}
          <div
            className="h-full overflow-auto"
            dir="rtl"
            onMouseUp={() => {
              if (onTextSelect) {
                const sel = window.getSelection();
                const text = sel ? sel.toString().trim() : '';
                if (text) {
                  onTextSelect(text);
                }
              }
            }}
            aria-live="polite"
            aria-label="Текст для изучения"
          >
            <div className={clsx(maxWidthClass, "mx-auto p-6")}>
              <div
                className={clsx(
                  "prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:leading-snug prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 dark:prose-invert",
                  {
                    'hyphens-auto': settings.hyphenation,
                    'text-justify': settings.justify,
                  }
                )}
                style={{
                  ...typographyStyles,
                  maxWidth: showRu ? '110ch' : '60ch',
                  margin: '0 auto',
                  fontFeatureSettings: settings.ligatures === 'normal' ? '"liga" 1, "dlig" 1, "calt" 1, "salt" 1' : 'normal',
                  transition: 'all 0.2s ease',
                  hyphens: settings.hyphenation ? 'auto' : 'manual',
                  WebkitHyphens: settings.hyphenation ? 'auto' : 'manual',
                  fontVariantLigatures: settings.ligatures === 'normal' ? 'common-ligatures discretionary-ligatures' as const : 'none' as const,
                  fontKerning: 'normal' as const,
                  fontOpticalSizing: settings.opticalSizing ? ('auto' as const) : ('none' as const),
                  wordBreak: settings.hyphenation ? 'normal' : 'break-word' as any,
                  overflowWrap: 'break-word' as any
                }}
              >
                {isLoading ? (
                  <div className="text-sm text-muted-foreground">Загрузка сихи...</div>
                ) : null}

                {!isLoading && !processedText ? (
                  <div className="text-sm text-muted-foreground">Сиха не выбрана или нет текста.</div>
                ) : null}

                {processedText && paragraphs && paragraphs.length > 0 ? (
                  <>
                    {paragraphs.map((p, index) => {
                      const list = tokensByPid.get(p.pid) || [];
                      const paragraphNumber = index + 1;
                      const ruParagraph = showRu ? ruByPid.get(p.pid) : undefined;
                      const gridClass = showRu
                        ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-10'
                        : '';

                      return (
                        <div key={p.pid} className="mb-6 last:mb-0" dir={showRu ? 'ltr' : 'rtl'}>
                          <div className={gridClass}>
                            {showRu ? (
                              <div className="text-[0.95rem] leading-relaxed text-foreground/80" dir="ltr">
                                {ruParagraph?.text || ''}
                              </div>
                            ) : null}
                            <div dir="rtl">
                              {/* ????? ????????? */}
                              <div className="text-xs text-muted-foreground mb-2 font-medium">
                                {paragraphNumber}
                              </div>

                              {/* ????? ????????? */}
                              <p className="break-words" style={{ marginBottom: `${settings.lineHeight}em` }}>
                                {wrapWithTokens(p, list, highlightMode as HighlightMode, popupMode, learnedMap, onTokenSelect)}
                              </p>

                              {/* ?????? */}
                              {notes
                                ?.filter((n) => n.anchor.pid === p.pid)
                                .map((note) => (
                                  <div key={note.note_id} className="mt-3 text-sm text-muted-foreground" dir="ltr">
                                    <span className="font-semibold mr-2">[{paragraphNumber}]</span>
                                    <span dangerouslySetInnerHTML={{ __html: note.content_html }} />
                                  </div>
                                ))}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </>
                ) : processedText ? (
                  <div className="whitespace-pre-wrap">
                    {yiddishUtils.applyYiddishQuotes(processedText)}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        
        {/* Панель настроек */}
        {showSettingsPanel && (
          <div className="w-72 border-l border-border bg-background">
            <div className="p-4 border-b border-border">
              <h3 className="text-lg font-semibold flex items-center gap-2 text-foreground">
                <Settings className="w-5 h-5" />
                Настройки отображения
              </h3>
            </div>
            <div className="p-4 space-y-6">
              {/* Размер шрифта */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">
                  Размер шрифта: {settings.fontSize}px
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    min="12"
                    max="28"
                    step="1"
                    value={settings.fontSize}
                    onChange={(e) => updateSetting('fontSize', parseInt(e.target.value))}
                    className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                    aria-describedby="font-size-help"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="12"
                      max="28"
                      value={settings.fontSize}
                      onChange={(e) => updateSetting('fontSize', parseInt(e.target.value) || 18)}
                      className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
                    />
                    <span id="font-size-help" className="text-xs text-muted-foreground">
                      Alt+Plus/Minus
                    </span>
                  </div>
                </div>
              </div>

              {/* Межстрочный интервал */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">
                  Межстрочный интервал: {settings.lineHeight}
                </label>
                <input
                  type="range"
                  min="1.2"
                  max="2.0"
                  step="0.05"
                  value={settings.lineHeight}
                  onChange={(e) => updateSetting('lineHeight', parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min="1.2"
                  max="2.0"
                  step="0.05"
                  value={settings.lineHeight}
                  onChange={(e) => updateSetting('lineHeight', parseFloat(e.target.value) || 1.55)}
                  className="mt-2 w-full px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
                />
              </div>

              {/* Трекинг */}
              <div>
                <label className="text-sm font-medium mb-3 block text-foreground">
                  Трекинг: {settings.tracking}em
                </label>
                <input
                  type="range"
                  min="-0.02"
                  max="0.06"
                  step="0.005"
                  value={settings.tracking}
                  onChange={(e) => updateSetting('tracking', parseFloat(e.target.value))}
                  className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer"
                />
                <input
                  type="number"
                  min="-0.02"
                  max="0.06"
                  step="0.005"
                  value={settings.tracking}
                  onChange={(e) => updateSetting('tracking', parseFloat(e.target.value) || 0)}
                  className="mt-2 w-full px-2 py-1 text-xs border border-border rounded bg-background text-foreground"
                />
              </div>

              {/* Переключатели */}
              <div className="space-y-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.justify}
                    onChange={(e) => updateSetting('justify', e.target.checked)}
                    className="rounded border-border bg-background text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Выключка (Alt+J)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.hyphenation}
                    onChange={(e) => updateSetting('hyphenation', e.target.checked)}
                    className="rounded border-border bg-background text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Переносы (Alt+H)</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.ligatures === 'normal'}
                    onChange={(e) => updateSetting('ligatures', e.target.checked ? 'normal' : 'none')}
                    className="rounded border-border bg-background text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Лигатуры</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.opticalSizing}
                    onChange={(e) => updateSetting('opticalSizing', e.target.checked)}
                    className="rounded border-border bg-background text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Оптический размер</span>
                </label>

                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={darkMode}
                    onChange={(e) => setDarkMode(e.target.checked)}
                    className="rounded border-border bg-background text-primary focus:ring-primary"
                  />
                  <span className="text-sm text-foreground">Тёмная тема (Alt+D)</span>
                </label>
              </div>
            </div>
            
            {/* Информация о горячих клавишах */}
            <div className="p-4 border-t border-border bg-muted/20">
              <div className="text-xs text-muted-foreground space-y-1">
                <div><strong>Горячие клавиши:</strong></div>
                <div>Alt + Plus/Minus — размер шрифта</div>
                <div>Alt + J — переключение выключки</div>
                <div>Alt + H — переключение переносов</div>
                <div>Alt + D — тёмная тема</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Стили для слайдеров */}
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 0 0 1px hsl(var(--border));
        }

        input[type="range"]::-moz-range-thumb {
          height: 16px;
          width: 16px;
          border-radius: 50%;
          background: hsl(var(--primary));
          cursor: pointer;
          border: 2px solid hsl(var(--background));
          box-shadow: 0 0 0 1px hsl(var(--border));
        }

        @media (prefers-reduced-motion: reduce) {
          * {
            transition: none !important;
          }
        }

        @media print {
          .border-l {
            display: none !important;
          }
          
          .max-w-\\[60ch\\] {
            max-width: none !important;
          }
          
          .prose p {
            page-break-inside: avoid;
            hyphens: auto;
          }
        }
      `}</style>
    </div>
  );
};
