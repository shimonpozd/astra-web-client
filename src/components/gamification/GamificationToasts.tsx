import { AnimatePresence, motion } from 'framer-motion';
import React from 'react';
import { Sparkles, Trophy } from 'lucide-react';
import { useGamification } from '../../contexts/GamificationContext';
import { useLexiconStore } from '../../store/lexiconStore';

const sourceLabels: Record<string, string> = {
  chat: 'Чат',
  focus: 'Фокус',
  workbench: 'Workbench',
  lexicon: 'Лексикон',
  daily: 'Daily',
  system: 'Система',
};

export function GamificationToasts() {
  const { recent, levelUps } = useGamification();
  const isLexiconOpen = useLexiconStore((state) => state.isPanelOpen);
  const containerPosition = isLexiconOpen
    ? 'left-4 right-auto bottom-4 md:right-[calc(1rem+22rem)] md:left-auto'
    : 'right-4 bottom-4';

  return (
    <div className={`fixed z-40 flex flex-col gap-2 pointer-events-none ${containerPosition}`}>
      <AnimatePresence>
        {levelUps.map((item) => (
          <motion.div
            key={`lvl-${item.at}`}
            initial={{ opacity: 0, y: 20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="pointer-events-auto rounded-2xl border border-primary/50 bg-gradient-to-r from-primary/15 via-amber-100/60 to-orange-100/70 shadow-2xl px-4 py-3 min-w-[240px] backdrop-blur"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/30">
                <Trophy className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-[0.14em] text-primary font-semibold">
                  Новый уровень
                </span>
                <span className="text-lg font-semibold text-foreground">
                  Level {item.level}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
      <AnimatePresence>
        {recent.slice(0, 3).map((item) => (
          <motion.div
            key={item.at}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="pointer-events-auto rounded-xl border border-border/70 bg-card/80 shadow-xl px-3 py-2 min-w-[220px] backdrop-blur"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-primary/15 text-primary">
                <Sparkles className="w-4 h-4" />
              </span>
              <span>+{item.amount} XP</span>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
              <span>{sourceLabels[item.source] || 'Событие'}</span>
              {item.label ? <span className="text-foreground/70">{item.label}</span> : null}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
