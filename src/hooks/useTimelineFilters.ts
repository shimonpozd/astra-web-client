import { useMemo, useState } from 'react';
import { FilterState, Region } from '@/types/timeline';

const DEFAULT_STATE: FilterState = {
  periods: new Set<string>(),
  regions: new Set<Region>(),
  generations: new Set<number>(),
  searchQuery: '',
};

export function useTimelineFilters(initialPeriods: string[] = []) {
  const [filters, setFilters] = useState<FilterState>(() => ({
    ...DEFAULT_STATE,
    periods: new Set(initialPeriods),
  }));

  const actions = useMemo(
    () => ({
      togglePeriod: (periodId: string) =>
        setFilters((prev) => {
          const next = new Set(prev.periods);
          if (next.has(periodId)) {
            next.delete(periodId);
          } else {
            next.add(periodId);
          }
          return { ...prev, periods: next };
        }),
      toggleRegion: (region: Region) =>
        setFilters((prev) => {
          const next = new Set(prev.regions);
          if (next.has(region)) {
            next.delete(region);
          } else {
            next.add(region);
          }
          return { ...prev, regions: next };
        }),
      toggleGeneration: (generation: number) =>
        setFilters((prev) => {
          const next = new Set(prev.generations);
          if (next.has(generation)) {
            next.delete(generation);
          } else {
            next.add(generation);
          }
          return { ...prev, generations: next };
        }),
      setSearchQuery: (query: string) =>
        setFilters((prev) => ({
          ...prev,
          searchQuery: query,
        })),
      setDateRange: (range?: [number, number]) =>
        setFilters((prev) => ({
          ...prev,
          dateRange: range,
        })),
      reset: () => setFilters({ ...DEFAULT_STATE, periods: new Set(initialPeriods) }),
      setAllPeriods: (periodIds: string[]) =>
        setFilters((prev) => ({
          ...prev,
          periods: new Set(periodIds),
        })),
    }),
    [initialPeriods],
  );

  return { filters, ...actions };
}
