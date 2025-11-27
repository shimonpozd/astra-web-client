import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Trophy, X } from 'lucide-react';
import { useGamification } from '../../contexts/GamificationContext';

export const LevelUpCelebration: React.FC = () => {
  const { levelUps } = useGamification();
  const [active, setActive] = useState<{ level: number; at: number } | null>(null);

  useEffect(() => {
    if (levelUps.length) {
      setActive(levelUps[0]);
    }
  }, [levelUps]);

  useEffect(() => {
    if (!active) return;
    const timeout = setTimeout(() => setActive(null), 5500);
    return () => clearTimeout(timeout);
  }, [active]);

  useEffect(() => {
    if (!active) return;
    try {
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(640, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(960, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.9);
    } catch {
      /* ignore audio errors */
    }
  }, [active]);

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 24 }).map((_, idx) => ({
        id: idx,
        delay: Math.random() * 0.4,
        left: Math.random() * 100,
        duration: 2 + Math.random() * 1.2,
        size: 6 + Math.random() * 10,
        color: ['#f97316', '#facc15', '#22d3ee', '#a855f7'][idx % 4],
      })),
    [],
  );

  return (
    <AnimatePresence>
      {active ? (
        <motion.div
          key={active.at}
          className="fixed inset-0 z-[65] pointer-events-none flex items-start justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="relative mt-16 w-full max-w-lg px-4">
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
              {confettiPieces.map((piece) => (
                <motion.span
                  key={piece.id}
                  className="absolute rounded-sm"
                  style={{
                    width: piece.size,
                    height: piece.size * 2,
                    left: `${piece.left}%`,
                    background: piece.color,
                  }}
                  initial={{ y: -40, rotate: 0, opacity: 0 }}
                  animate={{
                    y: '120vh',
                    rotate: 360,
                    opacity: [0, 1, 1, 0],
                  }}
                  transition={{
                    duration: piece.duration,
                    delay: piece.delay,
                    ease: 'easeOut',
                  }}
                />
              ))}
            </div>
            <motion.div
              className="pointer-events-auto rounded-3xl border border-primary/50 bg-gradient-to-br from-background via-background/80 to-amber-50/80 shadow-2xl backdrop-blur-xl px-6 py-5 relative overflow-hidden"
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="absolute inset-x-0 -top-10 h-20 bg-gradient-to-b from-primary/20 via-transparent to-transparent pointer-events-none" />
              <button
                aria-label="Закрыть"
                className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full bg-white/70 text-muted-foreground shadow-sm pointer-events-auto"
                onClick={() => setActive(null)}
              >
                <X className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-primary text-primary-foreground grid place-items-center shadow-lg shadow-primary/40">
                  <Trophy className="w-7 h-7" />
                </div>
                <div className="flex-1 space-y-1">
                  <div className="text-xs uppercase tracking-[0.16em] text-primary font-semibold flex items-center gap-2">
                    <Sparkles className="w-4 h-4" />
                    Level up
                  </div>
                  <div className="text-2xl font-bold text-foreground">
                    Уровень {active.level}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Отлично! Продолжай — до следующего уровня осталось ещё чуть-чуть.
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};
