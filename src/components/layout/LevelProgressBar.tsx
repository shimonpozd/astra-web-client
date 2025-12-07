import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

interface LevelProgressBarProps {
  levelProgress: {
    level: number;
    xpIntoLevel: number;
    xpForLevel: number;
    xpToNext: number;
    progress: number; // 0–1
  };
  onClick: () => void;
}

function formatXp(value: number) {
  return new Intl.NumberFormat("ru-RU").format(Math.max(0, Math.round(value)));
}

export function LevelProgressBar({ levelProgress, onClick }: LevelProgressBarProps) {
  const percent = Math.round(levelProgress.progress * 100);
  const fill = Math.max(percent, percent > 0 ? 6 : 0); // минимальная видимая ширина

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-16 w-full max-w-4xl items-center justify-between gap-6 rounded-xl border border-border/60 bg-card/85 px-6 shadow-sm transition-all duration-300 hover:border-primary/60 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      aria-label={`Уровень ${levelProgress.level}, прогресс ${percent}%`}
    >
      {/* Подсветка границ блока */}
      <div className="pointer-events-none absolute inset-x-2 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
      <div className="pointer-events-none absolute inset-x-2 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      {/* Левая часть: круг с уровнем */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 scale-110 rounded-full bg-primary/30 blur-md transition-all duration-400 group-hover:blur-lg" />

          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/50 bg-gradient-to-br from-primary/20 via-primary/25 to-primary/10 backdrop-blur-sm">
            <span className="text-lg font-bold tracking-wider text-foreground drop-shadow">
              {levelProgress.level}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start">
          <span className="text-xs uppercase tracking-widest text-primary/80">
            Уровень
          </span>
          <span className="text-xs text-muted-foreground">
            {formatXp(levelProgress.xpIntoLevel)} / {formatXp(levelProgress.xpForLevel)} XP
          </span>
        </div>
      </div>

      {/* Центральный прогресс-бар */}
      <div className="relative mx-8 flex-1">
        {/* Дорожка */}
        <div className="relative h-2 w-full overflow-hidden rounded-full border border-border/70 bg-muted/60">
          {/* Заполненная часть */}
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-primary to-amber-400 shadow-[0_0_16px_rgba(0,0,0,0.25)]"
            initial={{ width: 0 }}
            animate={{ width: `${fill}%` }}
            transition={{ duration: 1.0, ease: "easeOut" }}
          />

          {/* Мягкий блик по дорожке */}
          <motion.div
            className="pointer-events-none absolute inset-y-0 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/22 to-transparent"
            initial={{ x: "-120%" }}
            animate={{ x: "200%" }}
            transition={{ duration: 2.0, ease: "linear", delay: 0.4, repeat: Infinity }}
          />
        </div>

        {/* Процент над полосой */}
        <div className="absolute -top-6 left-1/2 -translate-x-1/2">
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-xs font-medium text-foreground drop-shadow"
          >
            {percent}%
          </motion.span>
        </div>
      </div>

      {/* Правая часть: "Подробно" */}
      <div className="flex items-center gap-2 text-primary/80">
        <span className="text-xs uppercase tracking-wider">Подробно</span>
        <motion.div
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ChevronRight className="h-4 w-4" />
        </motion.div>
      </div>

      <span className="sr-only">
        Уровень {levelProgress.level}, прогресс {percent}%, {formatXp(levelProgress.xpIntoLevel)} из{" "}
        {formatXp(levelProgress.xpForLevel)} опыта
      </span>
    </button>
  );
}
