import { LifespanRange, Region, TimelinePerson } from '@/types/timeline';

const YEAR_PATTERN = /(\d{3,4})/g;
const CENTURY_PATTERN = /(\d{1,2})(st|nd|rd|th)\s+century/i;

export function parseLifespan(lifespan: string): LifespanRange | null {
  const years = lifespan.match(YEAR_PATTERN)?.map(Number);

  if (years && years.length >= 2) {
    return {
      start: years[0],
      end: years[1],
      estimated: lifespan.includes('c.') || lifespan.includes('ca.'),
    };
  }

  const century = lifespan.match(CENTURY_PATTERN);
  if (century) {
    const cent = parseInt(century[1], 10);
    return {
      start: (cent - 1) * 100,
      end: cent * 100,
      estimated: true,
    };
  }

  return null;
}

export function inferRegionFromText(summary?: string, categories?: string[]): Region | undefined {
  const haystack = `${categories?.join(' ') ?? ''} ${summary ?? ''}`.toLowerCase();

  if (haystack.includes('germany') || haystack.includes('ashkenaz') || haystack.includes('герм')) {
    return Region.GERMANY;
  }
  if (haystack.includes('france') || haystack.includes('франц')) {
    return Region.FRANCE;
  }
  if (haystack.includes('england') || haystack.includes('англ')) {
    return Region.ENGLAND;
  }
  if (haystack.includes('provence') || haystack.includes('прованс')) {
    return Region.PROVENCE;
  }
  if (haystack.includes('sepharad') || haystack.includes('spain') || haystack.includes('испан')) {
    return Region.SEPHARAD;
  }
  if (haystack.includes('italy') || haystack.includes('итал')) {
    return Region.ITALY;
  }
  if (haystack.includes('north africa') || haystack.includes('maghreb') || haystack.includes('северн') || haystack.includes('магриб')) {
    return Region.NORTH_AFRICA;
  }
  if (haystack.includes('yemen') || haystack.includes('йемен')) {
    return Region.YEMEN;
  }
  if (haystack.includes('egypt') || haystack.includes('егип')) {
    return Region.EGYPT;
  }
  if (haystack.includes('babylonia') || haystack.includes('bavel') || haystack.includes('вавил')) {
    return Region.BABYLONIA;
  }
  if (haystack.includes('israel') || haystack.includes('palestine') || haystack.includes('эрец')) {
    return Region.ERETZ_ISRAEL;
  }

  return undefined;
}

export function extractGeneration(period?: string): number | undefined {
  if (!period) return undefined;
  const match = period.match(/(\d+)(st|nd|rd|th)?\s*generation/i);
  return match ? parseInt(match[1], 10) : undefined;
}

export function deriveLifespanRange(person: TimelinePerson): LifespanRange | undefined {
  if (person.lifespan_range) {
    return person.lifespan_range;
  }
  if (person.birthYear !== undefined && person.deathYear !== undefined) {
    return { start: person.birthYear, end: person.deathYear, estimated: false };
  }
  if (person.lifespan) {
    return parseLifespan(person.lifespan) ?? undefined;
  }
  return undefined;
}
