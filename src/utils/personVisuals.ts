import { Period, Region, TimelinePerson } from '@/types/timeline';
import { getPersonColor } from './timelineColors';

export type PersonTier = 'star' | 'notable' | 'regular';

/**
 * Resolves the visual significance tier according to strict criteria:
 * 1. star: Explicitly marked with is_star === true
 * 2. notable: Has an elaborated article/summary (length > 60 characters)
 * 3. regular: Default for standard timeline entries
 */
export function getPersonTier(person: TimelinePerson): PersonTier {
  if (person.is_star === true) return 'star';
  if (person.summary_html && person.summary_html.trim().length > 60) return 'notable';
  return 'regular';
}

/**
 * Extracts a concise, punchy hook sentence or short fact from summary_html.
 * Strips HTML tags, trims, and cleanly cuts on a word boundary without trailing punctuation.
 */
export function getPersonHook(person: TimelinePerson, maxChars: number = 90): string {
  if (!person.summary_html) return '';

  // Strip HTML tags and normalize whitespace
  const clean = person.summary_html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!clean) return '';

  // Try to find the first sentence
  const sentenceMatch = clean.match(/^([^\.\!\?]+[\.\!\?])/);
  const firstSentence = sentenceMatch ? sentenceMatch[1].trim() : clean;

  if (firstSentence.length <= maxChars) {
    return firstSentence;
  }

  // Truncate at word boundary
  const sub = clean.slice(0, maxChars);
  const lastSpace = sub.lastIndexOf(' ');
  if (lastSpace > 20) {
    return sub.slice(0, lastSpace).replace(/[\,\;\:\-\—\.\!\?]+$/, '') + '…';
  }
  return sub + '…';
}

/**
 * Resolves the branch/region/period color specifically for the person's seal and accent tint.
 */
export function getPersonSealColor(person: TimelinePerson, period?: Period): string {
  const sub = (person.subPeriod || '').toLowerCase();

  // Branch colors for Tanakh
  if (sub.includes('shem')) return '#2E7D6B';
  if (sub.includes('ham')) return '#C9A94E';
  if (sub.includes('japheth')) return '#7A2E3B';
  if (sub.includes('cain')) return '#E05275';
  if (sub.includes('seth')) return '#38B2AC';
  if (sub.includes('root') || sub.includes('adams')) return '#9AA0C4';

  if (period) {
    return getPersonColor(person, period);
  }

  return '#C9A94E';
}

/**
 * Formats a clean, readable lifespan or generation label.
 */
export function getPersonLifespanLabel(person: TimelinePerson): string {
  const start = person.birthYear ?? person.lifespan_range?.start;
  const end = person.deathYear ?? person.lifespan_range?.end;

  if (start !== undefined && start !== null && end !== undefined && end !== null) {
    return `${start}–${end}`;
  }
  if (person.lifespan) {
    return person.lifespan;
  }
  if (person.generation) {
    return `Поколение ${person.generation}`;
  }
  return '';
}
