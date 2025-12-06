import { ArrowRight } from 'lucide-react';
import { Period } from '@/types/timeline';
import { generateColorSystem } from '@/utils/timelineColors';

interface LegendProps {
  periods: Period[];
  activePeriods: Set<string>;
  onToggle: (periodId: string) => void;
  onFocusPeriod?: (periodId: string) => void;
  counts?: Record<string, number>;
}

export function Legend({ periods, activePeriods, onToggle, onFocusPeriod, counts }: LegendProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 shadow-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Периоды</h3>
          <p className="text-xs text-muted-foreground">Цветовое кодирование таймлайна</p>
        </div>
      </div>
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {periods.map((period) => {
          const colors = generateColorSystem(period.id);
          const active = activePeriods.has(period.id);
          return (
            <div
              key={period.id}
              className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 transition-all ${
                active ? 'bg-muted/70 shadow-sm' : 'hover:bg-muted/40'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggle(period.id)}
                className="flex items-center gap-3 flex-1 text-left"
              >
                <span
                  className="w-3 h-12 rounded-full flex-shrink-0"
                  style={{ background: colors.periodBase }}
                  aria-hidden
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{period.name_ru}</div>
                  <div className="text-xs text-muted-foreground">
                    {period.startYear} — {period.endYear}
                  </div>
                </div>
              </button>
              {counts && (
                <span className="text-xs text-muted-foreground font-semibold">
                  {counts[period.id] ?? 0}
                </span>
              )}
              {onFocusPeriod && (
                <button
                  type="button"
                  onClick={() => onFocusPeriod(period.id)}
                  className="p-1 rounded-md border border-transparent hover:border-border"
                  title="Прокрутить к периоду"
                >
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
          );
        })}
      </div>
      <div className="text-xs text-muted-foreground border-t border-border/50 pt-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-1.5 rounded bg-foreground/80" />
          <span>Проверено</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-1.5 rounded border border-foreground/60 border-dashed" />
          <span>Приблизительные даты</span>
        </div>
      </div>
    </div>
  );
}
