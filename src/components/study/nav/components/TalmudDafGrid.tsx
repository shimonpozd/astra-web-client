import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';

import clsx from 'clsx';

import { loadShape } from '../../../../lib/sefariaCatalog';
import type { CatalogWork, WorkShape } from '../../../../lib/sefariaCatalog';
import { getWorkDisplayTitle } from '../utils/catalogWork';

export type DafSide = 'a' | 'b';

interface DafEntry {
  number: number;
  hasA: boolean;
  hasB: boolean;
}

export interface DafSelection {
  number: number;
  side: DafSide;
}

interface TalmudDafGridProps {
  tractate: CatalogWork;
  onSelect: (dafLabel: string) => void;
  theme: 'dark' | 'light' | 'system';
  preferredSide?: DafSide;
  value?: DafSelection | null;
  onChangePreferredSide?: (side: DafSide) => void;
  showSearch?: boolean;
}

const DEFAULT_SIDE: DafSide = 'a';

const SIDE_HOTKEYS = new Map<string, DafSide>([
  ['a', 'a'],
  ['а', 'a'],
  ['א', 'a'],
  ['aleph', 'a'],
  ['b', 'b'],
  ['б', 'b'],
  ['ב', 'b'],
  ['bet', 'b'],
  ['beth', 'b'],
]);

function TalmudDafGrid({
  tractate,
  onSelect,
  theme,
  preferredSide: preferredSideProp,
  value,
  onChangePreferredSide,
  showSearch = true,
}: TalmudDafGridProps) {
  const [shape, setShape] = useState<WorkShape | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const isDarkTheme = theme === 'dark';

  const displayTitle = getWorkDisplayTitle(tractate);
  const englishTitle = tractate.title?.trim() ?? '';
  const showEnglishTitle = Boolean(englishTitle) && englishTitle !== displayTitle;

  const storageKey = useMemo(() => {
    if (tractate?.path) {
      return `dafPreferredSide:${tractate.path}`;
    }
    if (tractate?.title) {
      return `dafPreferredSide:${tractate.title}`;
    }
    return null;
  }, [tractate]);

  const [internalPreferredSide, setInternalPreferredSide] = useState<DafSide>(DEFAULT_SIDE);

  useEffect(() => {
    if (preferredSideProp) {
      return;
    }
    if (!storageKey || typeof window === 'undefined') {
      setInternalPreferredSide(DEFAULT_SIDE);
      return;
    }
    const stored = window.localStorage.getItem(storageKey);
    if (stored === 'a' || stored === 'b') {
      setInternalPreferredSide(stored);
    } else {
      setInternalPreferredSide(DEFAULT_SIDE);
    }
  }, [preferredSideProp, storageKey]);

  const currentPreferredSide = preferredSideProp ?? internalPreferredSide;

  const updatePreferredSide = useCallback(
    (side: DafSide) => {
      if (preferredSideProp === undefined) {
        setInternalPreferredSide(side);
        if (storageKey && typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, side);
        }
      }
      onChangePreferredSide?.(side);
    },
    [preferredSideProp, storageKey, onChangePreferredSide],
  );

  useEffect(() => {
    let cancelled = false;

    if (!tractate.path) {
      setError('Не удалось определить путь к трактату.');
      setShape(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setShape(null);

    loadShape('/sefaria-cache/', tractate.path)
      .then((result) => {
        if (cancelled) return;
        setShape(result);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Не удалось загрузить структуру трактата.');
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [tractate]);

  const dafEntries = useMemo(() => {
    if (!shape) return [];
    return buildDafEntriesFromShape(shape);
  }, [shape]);

  const searchTarget = useMemo(() => parseDafInput(searchInput), [searchInput]);
  const matchedEntry = useMemo(() => {
    if (!searchTarget) {
      return null;
    }
    return dafEntries.find((entry) => entry.number === searchTarget.number) ?? null;
  }, [searchTarget, dafEntries]);

  const handleSideSelect = useCallback(
    (entry: DafEntry, side: DafSide, options?: { updatePreference?: boolean }) => {
      const isAvailable = side === 'a' ? entry.hasA : entry.hasB;
      if (!isAvailable) return;
      if (options?.updatePreference) {
        updatePreferredSide(side);
      }
      onSelect(`${entry.number}${side}`);
    },
    [onSelect, updatePreferredSide],
  );

  const handleCenterSelect = useCallback(
    (entry: DafEntry) => {
      let sideToOpen: DafSide = currentPreferredSide;
      if (sideToOpen === 'a' && !entry.hasA && entry.hasB) {
        sideToOpen = 'b';
      } else if (sideToOpen === 'b' && !entry.hasB && entry.hasA) {
        sideToOpen = 'a';
      } else if (!entry.hasA && !entry.hasB) {
        return;
      }
      handleSideSelect(entry, sideToOpen);
    },
    [currentPreferredSide, handleSideSelect],
  );

  const handleSearchSubmit = useCallback(() => {
    if (!searchTarget) return;
    const entry = matchedEntry;
    if (!entry) return;
    let side: DafSide | null = searchTarget.side;
    if (!side) {
      side = entry.hasA ? currentPreferredSide : entry.hasB ? 'b' : null;
    }
    if (!side) return;
    handleSideSelect(entry, side);
  }, [searchTarget, matchedEntry, currentPreferredSide, handleSideSelect]);

  const handleSearchKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        handleSearchSubmit();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        setSearchInput('');
      }
    },
    [handleSearchSubmit],
  );

  return (
    <div
      className={clsx(
        'rounded-2xl border p-4 shadow-sm',
        isDarkTheme ? 'border-white/10 bg-white/10 text-white' : 'border-gray-300 bg-white text-gray-800',
      )}
    >
      <div className="mb-3 flex flex-col gap-1">
        <h4 className="text-sm font-semibold uppercase tracking-wide">{displayTitle}</h4>
        {showEnglishTitle && (
          <span className={clsx('text-xs font-normal', isDarkTheme ? 'text-white/60' : 'text-gray-500')}>
            {englishTitle}
          </span>
        )}
        {tractate.primaryTitles?.he && (
          <span
            className={clsx('text-base font-medium', isDarkTheme ? 'text-amber-200/90' : 'text-amber-700')}
            dir="rtl"
          >
            {tractate.primaryTitles.he}
          </span>
        )}
      </div>

      {showSearch && (
        <div className="mb-4 space-y-2 sm:flex sm:items-center sm:justify-between sm:space-y-0 sm:gap-3">
          <label
            htmlFor="talmud-daf-search"
            className={clsx('text-xs font-medium uppercase tracking-wide', isDarkTheme ? 'text-white/60' : 'text-gray-600')}
          >
            Найти лист
          </label>
          <input
            id="talmud-daf-search"
            type="text"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="Например, 2a или דף 2 עמוד א"
            className={clsx(
              'w-full rounded-md border px-3 py-2 text-sm outline-none transition sm:max-w-xs',
              isDarkTheme
                ? 'border-white/20 bg-white/10 text-white placeholder:text-white/40 focus:border-emerald-300 focus:ring-1 focus:ring-emerald-300'
                : 'border-gray-300 bg-white text-gray-800 placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500',
            )}
            aria-describedby="talmud-daf-legend"
          />
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="flex items-center gap-3 text-sm">
            <div
              className={clsx(
                'h-5 w-5 animate-spin rounded-full border-2 border-transparent',
                isDarkTheme ? 'border-t-amber-400' : 'border-t-emerald-600',
              )}
            />
            <span className={isDarkTheme ? 'text-white/80' : 'text-gray-600'}>Загружаем структуру дафов…</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div
          className={clsx(
            'rounded-xl border px-4 py-3 text-sm',
            isDarkTheme ? 'border-red-400/50 bg-red-500/10 text-red-200' : 'border-red-300 bg-red-50 text-red-700',
          )}
        >
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {dafEntries.length === 0 ? (
            <div
              className={clsx(
                'rounded-xl border px-4 py-6 text-center text-sm',
                isDarkTheme ? 'border-white/10 bg-white/5 text-white/70' : 'border-gray-200 bg-gray-50 text-gray-600',
              )}
            >
              В трактате нет доступных листов.
            </div>
          ) : (
            <>
              <div
                className={clsx(
                  'grid gap-3',
                  '[grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]',
                )}
              >
                {dafEntries.map((entry) => {
                  const isValueActive = value?.number === entry.number;
                  const isSearchActive = matchedEntry?.number === entry.number;
                  const highlightedSide: DafSide | null = isValueActive
                    ? value?.side ?? null
                    : searchTarget?.number === entry.number
                      ? searchTarget?.side ?? null
                      : null;

                  return (
                    <DafTile
                      key={entry.number}
                      number={entry.number}
                      hasA={entry.hasA}
                      hasB={entry.hasB}
                      isActive={isValueActive || isSearchActive}
                      activeSide={highlightedSide ?? undefined}
                      isDarkTheme={isDarkTheme}
                      preferredSide={currentPreferredSide}
                      onCenterSelect={() => handleCenterSelect(entry)}
                      onSelectSide={(side) => handleSideSelect(entry, side, { updatePreference: true })}
                    />
                  );
                })}
              </div>

              <p
                id="talmud-daf-legend"
                className={clsx(
                  'mt-4 text-xs leading-relaxed',
                  isDarkTheme ? 'text-white/70' : 'text-gray-600',
                )}
              >
                Лист (daf) состоит из двух сторон — a и b. Выберите нужную сторону или нажмите на номер, чтобы открыть
                последнюю использованную сторону. Используйте клавиши ← → для переключения между сторонами, Enter — для
                открытия, Esc — чтобы очистить поиск.
              </p>
            </>
          )}
        </>
      )}
    </div>
  );
}

interface DafTileProps {
  number: number;
  hasA: boolean;
  hasB: boolean;
  isActive: boolean;
  activeSide?: DafSide;
  preferredSide: DafSide;
  isDarkTheme: boolean;
  onSelectSide: (side: DafSide) => void;
  onCenterSelect: () => void;
}

function DafTile({
  number,
  hasA,
  hasB,
  isActive,
  activeSide,
  preferredSide,
  isDarkTheme,
  onSelectSide,
  onCenterSelect,
}: DafTileProps) {
  const aRef = useRef<HTMLButtonElement | null>(null);
  const centerRef = useRef<HTMLButtonElement | null>(null);
  const bRef = useRef<HTMLButtonElement | null>(null);

  const handleKey = useCallback(
    (origin: 'a' | 'center' | 'b') =>
      (event: KeyboardEvent<HTMLButtonElement>) => {
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          if (origin === 'b') {
            centerRef.current?.focus();
          } else if (origin === 'center' && hasA) {
            aRef.current?.focus();
          } else {
            aRef.current?.focus();
          }
        } else if (event.key === 'ArrowRight') {
          event.preventDefault();
          if (origin === 'a') {
            centerRef.current?.focus();
          } else if (origin === 'center' && hasB) {
            bRef.current?.focus();
          } else {
            bRef.current?.focus();
          }
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          if (origin === 'a' && hasA) {
            onSelectSide('a');
          } else if (origin === 'b' && hasB) {
            onSelectSide('b');
          } else {
            onCenterSelect();
          }
        }
      },
    [hasA, hasB, onCenterSelect, onSelectSide],
  );

  return (
    <div
      className={clsx(
        'group relative flex h-16 w-full select-none items-stretch overflow-hidden rounded-full border transition',
        isDarkTheme ? 'border-white/10 bg-white/5 text-white' : 'border-gray-200 bg-white text-gray-900',
        isActive && (isDarkTheme ? 'ring-2 ring-emerald-300/80' : 'ring-2 ring-emerald-600'),
        (!hasA && !hasB) && 'opacity-50',
      )}
      title={`Лист ${number}: сторона a слева, b справа, центр — последняя выбранная сторона (${preferredSide.toUpperCase()}).`}
    >
      <button
        type="button"
        ref={aRef}
        onClick={() => {
          if (hasA) onSelectSide('a');
        }}
        disabled={!hasA}
        aria-label={`Daf ${number}, Amud Alef`}
        className={clsx(
          'flex h-full w-16 items-center justify-center px-3 text-sm font-semibold uppercase transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          hasA
            ? activeSide === 'a'
              ? isDarkTheme
                ? 'bg-emerald-500 text-white'
                : 'bg-emerald-600 text-white'
              : isDarkTheme
                ? 'text-emerald-200 hover:bg-emerald-400/20'
                : 'text-emerald-700 hover:bg-emerald-50'
            : isDarkTheme
              ? 'cursor-not-allowed text-white/30'
              : 'cursor-not-allowed text-gray-300',
          'border-r border-white/10 dark:border-white/10',
        )}
        onKeyDown={handleKey('a')}
      >
        A
      </button>

      <button
        type="button"
        ref={centerRef}
        onClick={onCenterSelect}
        aria-label={`Daf ${number} (preferred side ${preferredSide === 'a' ? 'alef' : 'bet'})`}
        className={clsx(
          'relative flex h-full flex-1 flex-col items-center justify-center px-6 text-2xl font-semibold transition',
          isDarkTheme ? 'hover:bg-white/10' : 'hover:bg-gray-100',
          isActive && (isDarkTheme ? 'bg-white/15 text-white' : 'bg-emerald-50 text-emerald-800'),
        )}
        onKeyDown={handleKey('center')}
      >
        {number}
      </button>

      <button
        type="button"
        ref={bRef}
        onClick={() => {
          if (hasB) onSelectSide('b');
        }}
        disabled={!hasB}
        aria-label={`Daf ${number}, Amud Bet`}
        className={clsx(
          'flex h-full w-16 items-center justify-center px-3 text-sm font-semibold uppercase transition',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent',
          hasB
            ? activeSide === 'b'
              ? isDarkTheme
                ? 'bg-emerald-500 text-white'
                : 'bg-emerald-600 text-white'
              : isDarkTheme
                ? 'text-emerald-200 hover:bg-emerald-400/20'
                : 'text-emerald-700 hover:bg-emerald-50'
            : isDarkTheme
              ? 'cursor-not-allowed text-white/30'
              : 'cursor-not-allowed text-gray-300',
          'border-l border-white/10 dark:border-white/10',
        )}
        onKeyDown={handleKey('b')}
      >
        B
      </button>
    </div>
  );
}

function buildDafEntriesFromShape(shape: WorkShape): DafEntry[] {
  const entries: DafEntry[] = [];

  const chapters = (shape as unknown as { chapters?: unknown }).chapters;
  if (Array.isArray(chapters) && chapters.length) {
    const hasLeadingPlaceholders = chapters.length >= 2 && chapters[0] === 0 && chapters[1] === 0;
    const startIndex = hasLeadingPlaceholders ? 2 : 0;

    let dafNumber = 2;
    for (let index = startIndex; index < chapters.length; index += 2) {
      const countA = Number(chapters[index] ?? 0);
      const countB = Number(chapters[index + 1] ?? 0);
      const hasA = countA > 0;
      const hasB = countB > 0;

      entries.push({
        number: dafNumber,
        hasA,
        hasB,
      });
      dafNumber += 1;
    }

    if (entries.length) {
      return entries;
    }
  }

  const rawShape = (shape as unknown as { shape?: unknown[] }).shape;
  const leafCount = Array.isArray(rawShape) ? rawShape.length : 0;

  let daf = 2;
  for (let index = 0; index < leafCount; index += 2) {
    const hasA = index < leafCount;
    const hasB = index + 1 < leafCount;
    entries.push({
      number: daf,
      hasA,
      hasB,
    });
    daf += 1;
  }

  return entries;
}

function parseDafInput(raw: string): { number: number; side: DafSide | null } | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .toLowerCase()
    .replace(/[,.;:]/g, ' ')
    .replace(/[‐‑‒–—―]/g, ' ')
    .replace(/דף|daf/g, ' ')
    .replace(/עמוד|amud/g, ' ')
    .replace(/^\s+|\s+$/g, '')
    .replace(/\s+/g, ' ');

  const numberMatch = normalized.match(/(\d+)/);
  if (!numberMatch) {
    return null;
  }

  const number = Number.parseInt(numberMatch[1] ?? '', 10);
  if (!Number.isFinite(number) || number < 2) {
    return null;
  }

  let side: DafSide | null = null;

  const sideMatch = normalized.match(/([a-z\u0410-\u044f\u05d0\u05d1]+)/u);
  if (sideMatch && sideMatch[1]) {
    const token = sideMatch[1].trim();
    const mapped = SIDE_HOTKEYS.get(token);
    if (mapped) {
      side = mapped;
    } else if (token.endsWith('a')) {
      side = 'a';
    } else if (token.endsWith('b')) {
      side = 'b';
    }
  }

  return { number, side };
}

export default TalmudDafGrid;
