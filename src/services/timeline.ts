import { PERIODS } from '@/data/periods';
import { SAMPLE_TIMELINE_PEOPLE } from '@/data/timelineSample';
import { authorizedFetch } from '@/lib/authorizedFetch';
import { FilterState, Period, Region, TimelineApiResponse, TimelinePerson } from '@/types/timeline';
import { debugLog } from '@/utils/debugLogger';
import { parseLifespan, inferRegionFromText } from '@/utils/dataParser';

function buildQuery(filters?: Partial<FilterState>): string {
  if (!filters) return '';

  const params = new URLSearchParams();
  if (filters.periods && filters.periods.size) {
    params.set('periods', Array.from(filters.periods).join(','));
  }
  if (filters.regions && filters.regions.size) {
    params.set('regions', Array.from(filters.regions).join(','));
  }
  if (filters.generations && filters.generations.size) {
    params.set('generations', Array.from(filters.generations).join(','));
  }
  if (filters.searchQuery) {
    params.set('q', filters.searchQuery);
  }
  if (filters.dateRange) {
    params.set('start', String(filters.dateRange[0]));
    params.set('end', String(filters.dateRange[1]));
  }

  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

function computeStats(people: TimelinePerson[]): TimelineApiResponse['stats'] {
  const byPeriod: Record<string, number> = {};
  const byRegion: Record<Region, number> = {} as any;

  people.forEach((person) => {
    byPeriod[person.period] = (byPeriod[person.period] || 0) + 1;
    if (person.region) {
      byRegion[person.region] = (byRegion[person.region] || 0) + 1;
    }
  });

  return {
    totalPeople: people.length,
    byPeriod,
    byRegion,
  };
}

async function fallbackFromProfiles(): Promise<TimelineApiResponse> {
  try {
    const res = await authorizedFetch('/api/profile/list');
    if (!res.ok) throw new Error(`Profile list failed ${res.status}`);
    const list: Array<any> = await res.json();
    const periodMap = new Map<string, Period>();
    PERIODS.forEach((p) => periodMap.set(p.id, p));

    const withBounds = (person: TimelinePerson): TimelinePerson => {
      if (person.birthYear || person.deathYear || person.lifespan_range) return person;
      const period = periodMap.get(person.period);
      if (!period) return person;
      const span = period.endYear - period.startYear;
      let fraction = 0.5;
      if (person.generation && period.subPeriods?.length) {
        const gens = period.subPeriods.map((s) => s.generation).filter((g): g is number => typeof g === 'number');
        const maxGen = gens.length ? Math.max(...gens) : 1;
        fraction = Math.min(0.95, Math.max(0.05, person.generation / Math.max(1, maxGen)));
      }
      const center = period.startYear + span * fraction;
      return { ...person, birthYear: Math.floor(center - 3), deathYear: Math.floor(center + 3) };
    };

    const people: TimelinePerson[] = list
      .map((p) => {
        const lifespanRange = p.lifespan ? parseLifespan(p.lifespan) : undefined;
        const facts = (p as any).facts || {};
        const authorFacts = facts.author || {};
        const display = authorFacts.display || {};
        return {
          slug: p.slug,
          name_en: p.title_en || display.name_en || p.slug,
          name_ru: display.name_ru || (p as any).title_ru,
          name_he: p.title_he || p.slug,
          lifespan: p.lifespan,
          lifespan_range: lifespanRange || undefined,
          period: p.period || 'achronim',
          generation: p.generation,
          subPeriod: p.subPeriod,
          summary_html: p.summary_html,
          region: p.region || inferRegionFromText(p.summary_html, p.categories),
        } as TimelinePerson;
      })
      .map(withBounds)
      .filter((p) => Boolean(p.slug));

    return {
      people,
      periods: PERIODS,
      stats: computeStats(people),
    };
  } catch (err) {
    debugLog('fallbackFromProfiles failed', err);
    const stats = computeStats(SAMPLE_TIMELINE_PEOPLE);
    return { people: SAMPLE_TIMELINE_PEOPLE, periods: PERIODS, stats };
  }
}

export async function fetchTimelineData(
  filters?: Partial<FilterState>,
  signal?: AbortSignal,
): Promise<TimelineApiResponse> {
  const query = buildQuery(filters);
  try {
    const response = await authorizedFetch(`/api/timeline/people${query}`, { signal });
    if (!response.ok) {
      throw new Error(`Timeline request failed: ${response.status} ${response.statusText}`);
    }
    const payload = (await response.json()) as TimelineApiResponse;
    const periods = payload.periods?.length ? payload.periods : PERIODS;
    const people = (payload.people || []).map((p) => {
      const facts = (p as any).facts || {};
      const authorFacts = facts.author || {};
      const display = authorFacts.display || {};
      return {
        ...p,
        name_ru: p.name_ru || (p as any).title_ru || display.name_ru,
        name_en: p.name_en || display.name_en || (p as any).title_en || p.slug,
        period: p.period || 'achronim',
      };
    });
    if (!people.length) {
      throw new Error('Empty timeline payload');
    }
    return { people, periods, stats: computeStats(people) };
  } catch (error) {
    debugLog('Timeline API unavailable, falling back to profiles/mocks', error);
    return fallbackFromProfiles();
  }
}
