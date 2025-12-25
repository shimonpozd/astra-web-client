import React, { useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { YiddishMahjongTile } from '@/types/yiddish';

interface MahjongTileProps {
  tile: YiddishMahjongTile;
  isLocked: boolean;
  isSelected: boolean;
  isMatched: boolean;
  isMismatched: boolean;
  onClick: (tile: YiddishMahjongTile) => void;
}

const posClasses: Record<string, string> = {
  NOUN: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-700',
  VERB: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/40 dark:text-sky-100 dark:border-sky-700',
  ADJ: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-700',
  DEFAULT: 'bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800/60 dark:text-slate-100 dark:border-slate-600',
};

const tileVariants = {
  hidden: { y: 50, opacity: 0 },
  enter: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 120, damping: 14 } },
  idle: { y: 0, x: 0, scale: 1 },
  hover: { y: -4, transition: { type: 'spring', stiffness: 240, damping: 14 } },
  tap: { y: 4, transition: { type: 'spring', stiffness: 400, damping: 12 } },
  selected: { scale: 1.06, transition: { type: 'spring', stiffness: 260, damping: 16 } },
  mismatched: { x: [-6, 6, -6, 6, 0], transition: { duration: 0.3 } },
  matched: {
    scale: [1, 1.15, 0],
    opacity: [1, 1, 0],
    rotate: [0, 0, 10],
    filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1)'],
    transition: { duration: 0.45, ease: 'backIn' },
  },
};

const ParticleBurst: React.FC = () => {
  const particles = useMemo(
    () =>
      Array.from({ length: 8 }, () => ({
        x: (Math.random() - 0.5) * 80,
        y: (Math.random() - 0.5) * 80,
        delay: Math.random() * 0.05,
      })),
    [],
  );

  return (
    <div className="absolute inset-0 pointer-events-none">
      {particles.map((p, idx) => (
        <motion.span
          key={idx}
          className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-emerald-300"
          initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
          animate={{ x: p.x, y: p.y, opacity: 0, scale: 0.2 }}
          transition={{ duration: 0.45, delay: p.delay }}
        />
      ))}
    </div>
  );
};

export const MahjongTile: React.FC<MahjongTileProps> = ({
  tile,
  isLocked,
  isSelected,
  isMatched,
  isMismatched,
  onClick,
}) => {
  const posKey = (tile.pos || '').toUpperCase();
  const colorClass = posClasses[posKey] || posClasses.DEFAULT;
  const isYi = tile.type === 'yi';

  return (
    <motion.button
      type="button"
      className={[
        'relative flex h-full w-full select-none flex-col items-center justify-center rounded-xl border',
        'border-b-[6px] shadow-[0_10px_0_0_rgba(0,0,0,0.12)]',
        'will-change-transform transition-transform',
        colorClass,
        isLocked ? 'brightness-75 blur-[1px] cursor-not-allowed pointer-events-none' : 'cursor-pointer',
        isSelected ? 'ring-4 ring-offset-2 ring-indigo-400 z-50' : '',
        isMismatched ? 'ring-2 ring-red-400' : '',
      ].join(' ')}
      variants={tileVariants}
      initial="hidden"
      animate={
        isMatched
          ? 'matched'
          : isMismatched
          ? 'mismatched'
          : isSelected
          ? 'selected'
          : 'idle'
      }
      whileHover={!isLocked && !isMatched ? 'hover' : undefined}
      whileTap={!isLocked && !isMatched ? 'tap' : undefined}
      onClick={() => {
        if (isLocked || isMatched) return;
        onClick(tile);
      }}
      aria-pressed={isSelected}
      aria-disabled={isLocked}
    >
      <div
        className={[
          'px-1 text-center leading-snug',
          isYi ? 'font-serif text-2xl' : 'font-sans text-base font-medium',
        ].join(' ')}
        dir={isYi ? 'rtl' : 'ltr'}
      >
        {tile.content}
      </div>
      <AnimatePresence>
        {isMatched ? (
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <ParticleBurst />
            <motion.div
              className="absolute -top-3 left-1/2 -translate-x-1/2 text-sm font-bold text-emerald-600 drop-shadow"
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: -18 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              Gut!
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.button>
  );
};
