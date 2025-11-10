import type { CatalogWork } from '../../../../../lib/sefariaCatalog';

function selectFirstNonEmpty(values: Array<string | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }
  return null;
}

export function getWorkRuTitle(work: CatalogWork | null | undefined): string | null {
  if (!work) {
    return null;
  }
  return selectFirstNonEmpty([
    work.seedShorts?.short_ru,
    work.primaryTitles?.ru,
  ]);
}

export function getWorkDisplayTitle(work: CatalogWork | null | undefined): string {
  if (!work) {
    return '';
  }
  return (
    getWorkRuTitle(work) ??
    selectFirstNonEmpty([
      work.seedShorts?.short_en,
      work.primaryTitles?.en,
    ]) ??
    work.title
  );
}
