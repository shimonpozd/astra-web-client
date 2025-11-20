import clsx from 'clsx';
import { motion, type Variants } from 'framer-motion';

import { ITEM_VARIANTS } from '../variants';

interface HalakhahSectionSelectorProps {
  items: Array<{
    id: string;
    label: string;
  }>;
  active: string | null;
  onSelect: (id: string) => void;
  theme: 'dark' | 'light' | 'system';
  variants?: Variants;
}

function HalakhahSectionSelector({
  items,
  active,
  onSelect,
  theme,
  variants = ITEM_VARIANTS,
}: HalakhahSectionSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, index) => (
        <motion.button
          key={item.id}
          type="button"
          custom={index}
          variants={variants}
          initial="initial"
          animate="animate"
          exit="exit"
          onClick={() => onSelect(item.id)}
          className={clsx(
            'rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition',
            active === item.id
              ? theme === 'dark'
                ? 'bg-amber-300 text-emerald-900 shadow-lg shadow-amber-300/30'
                : 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/40'
              : theme === 'dark'
                ? 'bg-white/10 text-white/70 hover:bg-white/20'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300',
          )}
        >
          {item.label}
        </motion.button>
      ))}
    </div>
  );
}

export default HalakhahSectionSelector;
