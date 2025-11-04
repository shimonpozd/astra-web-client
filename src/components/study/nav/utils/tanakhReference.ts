import type { TanakhBookEntry } from '../types';

export interface ParsedTanakhRef {
  book: string;
  chapter: number;
  verse?: number;
}

export function parseTanakhReference(ref: string): ParsedTanakhRef | null {
  const trimmed = ref.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(.*?)\s+(\d+)(?::(\d+))?/);
  if (!match) {
    return null;
  }

  const [, book, chapterStr, verseStr] = match;
  const chapter = Number(chapterStr);

  let verse: number | undefined;
  if (verseStr) {
    const parsedVerse = Number(verseStr);
    if (!Number.isInteger(parsedVerse) || parsedVerse <= 0) {
      return null;
    }
    verse = parsedVerse;
  }

  if (!Number.isInteger(chapter) || chapter <= 0) {
    return null;
  }

  return {
    book: book.trim(),
    chapter,
    verse,
  };
}

export function findTanakhEntry(
  entries: TanakhBookEntry[],
  bookName: string,
): TanakhBookEntry | null {
  const normalized = bookName.trim().toLowerCase();
  return (
    entries.find((entry) => entry.seed.indexTitle.toLowerCase() === normalized) ??
    entries.find((entry) => entry.seed.slug.toLowerCase() === normalized) ??
    null
  );
}
