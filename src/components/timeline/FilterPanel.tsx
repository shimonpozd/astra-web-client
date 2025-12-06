import { Period, FilterState, Region } from '@/types/timeline';
import { Input } from '@/components/ui/input';
import { REGION_LABELS } from '@/data/regions';
import { generateColorSystem } from '@/utils/timelineColors';

interface FilterPanelProps {
  periods: Period[];
  regions: Region[];
  generations: number[];
  filters: FilterState;
  onTogglePeriod: (periodId: string) => void;
  onToggleRegion: (region: Region) => void;
  onToggleGeneration: (generation: number) => void;
  onSearch: (query: string) => void;
  onDateRangeChange: (range?: [number, number]) => void;
  onReset: () => void;
}

export function FilterPanel({
  periods,
  regions,
  generations,
  filters,
  onTogglePeriod,
  onToggleRegion,
  onToggleGeneration,
  onSearch,
  onDateRangeChange,
  onReset,
}: FilterPanelProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 shadow-xl p-4 w-full lg:w-80 space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Фильтры</h3>
          <button
            type="button"
            onClick={onReset}
            className="text-xs text-primary hover:underline"
          >
            Сбросить
          </button>
        </div>
        <Input
          value={filters.searchQuery}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Поиск по имени..."
          className="h-10"
        />
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Периоды</div>
        <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-1">
          {periods.map((period) => {
            const colors = generateColorSystem(period.id);
            const active = filters.periods.has(period.id);
            return (
              <label
                key={period.id}
                className={`flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition ${
                  active ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'
                }`}
              >
                <input
                  type="checkbox"
                  checked={active}
                  onChange={() => onTogglePeriod(period.id)}
                  className="accent-primary"
                />
                <span
                  className="w-8 h-2 rounded-full shadow-sm"
                  style={{ background: colors.periodBase }}
                  aria-hidden
                />
                <span className="text-sm truncate">{period.name_ru}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Регионы</div>
        <div className="flex flex-wrap gap-2">
          {regions.map((region) => {
            const active = filters.regions.has(region);
            const label = REGION_LABELS[region]?.name_ru ?? region;
            return (
              <button
                key={region}
                type="button"
                onClick={() => onToggleRegion(region)}
                className={`text-xs px-3 py-1.5 rounded-full border transition ${
                  active
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Поколения</div>
        <div className="flex flex-wrap gap-2">
          {generations.map((generation) => {
            const active = filters.generations.has(generation);
            return (
              <button
                key={generation}
                type="button"
                onClick={() => onToggleGeneration(generation)}
                className={`text-xs px-2.5 py-1.5 rounded-md border transition ${
                  active
                    ? 'border-primary bg-primary/10 text-primary font-semibold'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                {generation} поколение
              </button>
            );
          })}
          {!generations.length && <div className="text-xs text-muted-foreground">Нет данных</div>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground">Диапазон лет</div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="От"
            value={filters.dateRange?.[0] ?? ''}
            onChange={(e) => {
              const start = parseInt(e.target.value, 10);
              if (Number.isFinite(start) && filters.dateRange) {
                onDateRangeChange([start, filters.dateRange[1]]);
              } else if (Number.isFinite(start)) {
                onDateRangeChange([start, start + 100]);
              } else {
                onDateRangeChange(undefined);
              }
            }}
          />
          <Input
            type="number"
            placeholder="До"
            value={filters.dateRange?.[1] ?? ''}
            onChange={(e) => {
              const end = parseInt(e.target.value, 10);
              if (Number.isFinite(end) && filters.dateRange) {
                onDateRangeChange([filters.dateRange[0], end]);
              } else if (Number.isFinite(end)) {
                onDateRangeChange([end - 100, end]);
              } else {
                onDateRangeChange(undefined);
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}
