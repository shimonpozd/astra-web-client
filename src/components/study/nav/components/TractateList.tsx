import clsx from 'clsx';
import { motion } from 'framer-motion';

import type { CatalogWork } from '../../../../lib/sefariaCatalog';
import { ITEM_VARIANTS } from '../variants';
import { getWorkDisplayTitle } from '../utils/catalogWork';

interface TractateListProps {
  tractates: CatalogWork[];
  activeTitle?: string;
  onSelect: (tractate: CatalogWork) => void;
  theme: 'dark' | 'light' | 'system';
}

function TractateList({ tractates, activeTitle, onSelect, theme }: TractateListProps) {
  if (!tractates.length) {
    return (
      <div
        className={clsx(
          'rounded-xl border px-4 py-5 text-sm',
          theme === 'dark'
            ? 'border-white/10 bg-white/5 text-white/70'
            : 'border-gray-300 bg-white text-gray-600',
        )}
      >
        Нет трактатов в выбранном разделе.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tractates.map((tractate, index) => {
        const hebrewTitle = tractate.primaryTitles?.he;
        const displayTitle = getWorkDisplayTitle(tractate);
        const englishTitle = tractate.title?.trim() ?? '';
        const showEnglishTitle = Boolean(englishTitle) && englishTitle !== displayTitle;

        return (
          <motion.button
            key={tractate.path ?? tractate.title}
            type="button"
            custom={index}
            variants={ITEM_VARIANTS}
            initial="initial"
            animate="animate"
            exit="exit"
            onClick={() => onSelect(tractate)}
            className={clsx(
              'flex items-center justify-between gap-4 rounded-xl border px-4 py-3 text-left text-sm font-medium transition',
              theme === 'dark'
                ? 'border-white/10 bg-white/10 text-white hover:bg-white/15'
                : 'border-gray-300 bg-white text-gray-800 hover:bg-gray-100',
              activeTitle === tractate.title
                ? theme === 'dark'
                  ? 'ring-2 ring-amber-300/70'
                  : 'ring-2 ring-amber-500/50'
                : null,
            )}
          >
            <div className="min-w-0 flex-1">
              <span className="block truncate">{displayTitle}</span>
              {showEnglishTitle && (
                <span
                  className={clsx(
                    'mt-1 block truncate text-xs font-normal',
                    theme === 'dark' ? 'text-white/60' : 'text-gray-500',
                  )}
                >
                  {englishTitle}
                </span>
              )}
            </div>
            {hebrewTitle && (
              <span
                className={clsx(
                  'shrink-0 text-sm',
                  theme === 'dark' ? 'text-amber-200/90' : 'text-amber-700',
                )}
                dir="rtl"
              >
                {hebrewTitle}
              </span>
            )}
          </motion.button>
        );
      })}
    </div>
  );
}

export default TractateList;
