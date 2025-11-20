import clsx from 'clsx';

interface HalakhahVerseGridProps {
  chapter: number;
  verseCount: number;
  onSelect: (verse: number) => void;
  activeVerse?: number | null;
  theme: 'dark' | 'light' | 'system';
}

function HalakhahVerseGrid({
  chapter,
  verseCount,
  onSelect,
  activeVerse = null,
  theme,
}: HalakhahVerseGridProps) {
  if (!verseCount) {
    return null;
  }

  const verses = Array.from({ length: verseCount }, (_, index) => index + 1);

  return (
    <div className="mt-5 space-y-3">
      <p
        className={clsx(
          'text-xs font-semibold uppercase tracking-wide',
          theme === 'dark' ? 'text-white/60' : 'text-gray-600',
        )}
      >
        Сефим главы {chapter}
      </p>
      <div className="grid grid-cols-10 gap-2 text-xs">
        {verses.map((verse) => {
          const isActive = activeVerse === verse;
          return (
            <button
              key={verse}
              type="button"
              onClick={() => onSelect(verse)}
              className={clsx(
                'flex items-center justify-center rounded-xl border px-3 py-2 transition-all duration-200',
                theme === 'dark'
                  ? 'border-white/10 text-white'
                  : 'border-emerald-200 text-emerald-800',
                isActive
                  ? theme === 'dark'
                    ? 'bg-emerald-400/30 text-white shadow-lg shadow-emerald-400/40'
                    : 'bg-emerald-100 text-emerald-900 shadow-[0_8px_18px_rgba(16,185,129,0.18)]'
                  : theme === 'dark'
                    ? 'bg-white/5 hover:bg-emerald-400/20'
                    : 'bg-white hover:bg-emerald-50',
              )}
            >
              {verse}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default HalakhahVerseGrid;

