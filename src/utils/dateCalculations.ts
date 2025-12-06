import { Period, TimelinePerson } from '@/types/timeline';
import { deriveLifespanRange } from './dataParser';

export function getTimelineBounds(
  people: TimelinePerson[],
  periods: Period[],
  paddingYears = 50,
): { minYear: number; maxYear: number } {
  const personYears = people
    .map((p) => deriveLifespanRange(p))
    .filter((r): r is NonNullable<typeof r> => Boolean(r))
    .flatMap((r) => [r.start, r.end]);

  const periodYears = periods.flatMap((p) => [p.startYear, p.endYear]);
  const allYears = [...personYears, ...periodYears];

  if (allYears.length === 0) {
    return { minYear: -1000, maxYear: 2025 };
  }

  const minYear = Math.min(...allYears) - paddingYears;
  const maxYear = Math.max(...allYears) + paddingYears;

  return { minYear, maxYear };
}

export function buildTickMarks(minYear: number, maxYear: number, step = 50): number[] {
  const ticks: number[] = [];
  const start = Math.floor(minYear / step) * step;
  for (let year = start; year <= maxYear; year += step) {
    ticks.push(year);
  }
  return ticks;
}
