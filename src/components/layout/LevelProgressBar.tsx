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
  const fill = Math.max(percent, percent > 0 ? 4 : 0); // минимальная видимая ширина

  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex h-16 w-full max-w-4xl items-center justify-between px-6 transition-all duration-300 hover:bg-[#342C28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9B8556]/40"
      aria-label={`Уровень ${levelProgress.level}, прогресс ${percent}%`}
    >
      {/* Подсветка границ блока */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#9B8556]/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-[#9B8556]/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Левая часть: круг с уровнем */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-[#9B8556]/25 blur-md scale-110 group-hover:blur-lg transition-all duration-400" />

          <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#9B8556]/60 bg-gradient-to-br from-[#3A3127] to-[#2A241F] backdrop-blur-sm">
            <span className="text-lg font-bold tracking-wider text-[#F0E4C0] drop-shadow">
              {levelProgress.level}
            </span>
          </div>
        </div>

        <div className="flex flex-col items-start">
          <span className="text-xs uppercase tracking-widest text-[#9B8556]/85">
            Уровень
          </span>
          <span className="text-xs text-[#D9CDAA]/80">
            {formatXp(levelProgress.xpIntoLevel)} / {formatXp(levelProgress.xpForLevel)} XP
          </span>
        </div>
      </div>

      {/* Центральный прогресс-бар */}
      <div className="relative mx-8 flex-1">
        {/* Дорожка */}
        <div className="relative h-2 w-full overflow-hidden rounded-full border border-[#9B8556]/30 bg-[#3A2F26]">
          {/* Заполненная часть */}
          <motion.div
            className="h-full rounded-full bg-[#9B8556] shadow-[0_0_10px_rgba(155,133,86,0.9)]"
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
            className="text-xs font-medium text-[#F0E4C0] drop-shadow"
          >
            {percent}%
          </motion.span>
        </div>
      </div>

      {/* Правая часть: "Подробно" */}
      <div className="flex items-center gap-2 text-[#9B8556]/80">
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
