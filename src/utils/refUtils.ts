import { debugLog } from './debugLogger';
import { TANAKH_BOOKS } from '../data/tanakh';
import { TALMUD_BAVLI_TRACTATES } from '../data/talmud-bavli';

// ---------- REF utils: вспомогательные функции парсинга ссылок ----------

const normalizeBookName = (book: string): string => book.replace(/[\s]*[,:;]+$/g, '').trim();

const normalizeKey = (value?: string): string =>
  (value || '')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const tanakhBookNames = new Set<string>();
Object.entries(TANAKH_BOOKS).forEach(([key, info]) => {
  tanakhBookNames.add(normalizeKey(key));
  tanakhBookNames.add(normalizeKey(info.he_name));
  tanakhBookNames.add(normalizeKey(info.ru_name));
});

const talmudBookNames = new Set<string>();
Object.entries(TALMUD_BAVLI_TRACTATES).forEach(([key, info]) => {
  talmudBookNames.add(normalizeKey(key));
  talmudBookNames.add(normalizeKey(info.he_name));
  talmudBookNames.add(normalizeKey(info.ru_name));
});

const isKnownTanakhBook = (book: string): boolean => tanakhBookNames.has(normalizeKey(book));
const isKnownTalmudBook = (book: string): boolean => talmudBookNames.has(normalizeKey(book));

export interface ParsedRef {
  type: 'talmud' | 'tanakh' | 'other';
  book: string;
  daf?: number;
  amud?: 'a' | 'b';
  segment?: number;
  endDaf?: number;
  endAmud?: 'a' | 'b';
  endSegment?: number;
  chapter?: number;
  verse?: number;
  endChapter?: number;
  endVerse?: number;
  fullRef: string;
}

// Универсальный парсер ссылки
export function parseRefSmart(ref: string): ParsedRef | null {
  if (!ref) return null;

  const tokens = ref.trim().split(/\s+/).filter(Boolean);
  let numericIndex = tokens.length - 1;
  while (numericIndex >= 0 && !/\d/.test(tokens[numericIndex])) {
    numericIndex -= 1;
  }

  let tailToken = numericIndex >= 0 ? tokens[numericIndex] : '';
  let bookTokens = numericIndex >= 0 ? tokens.slice(0, numericIndex) : tokens.slice(0, -1);

  if (!tailToken && /\d/.test(ref)) {
    const compactMatch = ref.trim().match(/^([^\d]+?)(\d[^\s]*)$/);
    if (compactMatch?.[1] && compactMatch[2]) {
      bookTokens = compactMatch[1].trim().split(/\s+/);
      tailToken = compactMatch[2];
    }
  }

  const book = normalizeBookName(bookTokens.join(' '));
  const sanitizedTailToken = tailToken.replace(/[)\]]+$/, '');

  // Split range if hyphen present (e.g. 90b:18-20, 90b:18-90b:20, 1:1-5)
  const rangeParts = sanitizedTailToken.split(/[-–]/);
  const tailHead = rangeParts[0] || '';
  const tailEnd = rangeParts.length > 1 ? rangeParts[rangeParts.length - 1] : undefined;

  // Replace Cyrillic 'а' and 'б' with Latin 'a' and 'b'
  const tail = tailHead.toLowerCase().replace(/а/g, 'a').replace(/б/g, 'b');
  const tailEndClean = tailEnd ? tailEnd.toLowerCase().replace(/а/g, 'a').replace(/б/g, 'b') : undefined;

  const isTanakhBook = Boolean(book) && isKnownTanakhBook(book);
  const isTalmudBook = Boolean(book) && isKnownTalmudBook(book);
  const looksLikeTalmudShape = /^\d+[ab](?::\d+)?$/.test(tail);

  // --- 1. Талмудический формат: 29a, 29b:3, 29a.5, 90b:18-20
  const mTalmud = tail.match(/^(\d+)\s*([ab])?(?:[:.]\s*(\d+))?$/);
  if (mTalmud && (isTalmudBook || (!isTanakhBook && looksLikeTalmudShape))) {
    const daf = parseInt(mTalmud[1], 10);
    const amud = (mTalmud[2] as 'a' | 'b') ?? undefined;
    const segment = mTalmud[3] ? parseInt(mTalmud[3], 10) : undefined;

    let endDaf = daf;
    let endAmud = amud;
    let endSegment = segment;

    if (tailEndClean) {
      const mTalmudEnd = tailEndClean.match(/^(?:(\d+)\s*([ab])?[:.])?\s*(\d+)$/);
      if (mTalmudEnd) {
        if (mTalmudEnd[1]) endDaf = parseInt(mTalmudEnd[1], 10);
        if (mTalmudEnd[2]) endAmud = mTalmudEnd[2] as 'a' | 'b';
        if (mTalmudEnd[3]) endSegment = parseInt(mTalmudEnd[3], 10);
      }
    }

    const result: ParsedRef = {
      type: 'talmud',
      book,
      daf,
      amud,
      segment,
      endDaf: tailEndClean ? endDaf : undefined,
      endAmud: tailEndClean ? endAmud : undefined,
      endSegment: tailEndClean ? endSegment : undefined,
      fullRef: ref,
    };
    if (process.env.NODE_ENV !== 'production') {
      debugLog('[RefUtils] Parsed Talmud ref:', { ref, result });
    }
    return result;
  }

  // --- 2. Библейский формат: Genesis 1:1, Genesis 1:1-5
  const mBible = tail.match(/^(\d+):(\d+)$/);
  if (mBible && isTanakhBook) {
    const chapter = parseInt(mBible[1], 10);
    const verse = parseInt(mBible[2], 10);

    let endChapter = chapter;
    let endVerse = verse;

    if (tailEndClean) {
      const mBibleEnd = tailEndClean.match(/^(?:(\d+):)?(\d+)$/);
      if (mBibleEnd) {
        if (mBibleEnd[1]) endChapter = parseInt(mBibleEnd[1], 10);
        if (mBibleEnd[2]) endVerse = parseInt(mBibleEnd[2], 10);
      }
    }

    const result: ParsedRef = {
      type: 'tanakh',
      book,
      chapter,
      verse,
      endChapter: tailEndClean ? endChapter : undefined,
      endVerse: tailEndClean ? endVerse : undefined,
      fullRef: ref,
    };
    if (process.env.NODE_ENV !== 'production') {
      debugLog('[RefUtils] Parsed Tanakh ref:', { ref, result });
    }
    return result;
  }

  // --- 2a. Библейский формат с артефактами "23a:2"
  if (isTanakhBook) {
    const mBibleAmud = tail.match(/^(\d+)[ab]:(\d+)$/);
    if (mBibleAmud) {
      const result: ParsedRef = {
        type: 'tanakh',
        book,
        chapter: parseInt(mBibleAmud[1], 10),
        verse: parseInt(mBibleAmud[2], 10),
        fullRef: ref,
      };
      if (process.env.NODE_ENV !== 'production') {
        debugLog('[RefUtils] Parsed Tanakh ref (amud artifact):', { ref, result });
      }
      return result;
    }
  }

  // --- 3. Ссылка только на главу: Genesis 1
  const mBibleCh = tail.match(/^(\d+)$/);
  if (mBibleCh && isTanakhBook) {
    const result: ParsedRef = {
      type: 'tanakh',
      book,
      chapter: parseInt(mBibleCh[1], 10),
      verse: undefined,
      fullRef: ref,
    };
    if (process.env.NODE_ENV !== 'production') {
      debugLog('[RefUtils] Parsed Tanakh chapter ref:', { ref, result });
    }
    return result;
  }

  // --- 3a. Ссылка только на главу с артефактами "23a"
  if (isTanakhBook) {
    const mBibleChAmud = tail.match(/^(\d+)[ab]$/);
    if (mBibleChAmud) {
      const result: ParsedRef = {
        type: 'tanakh',
        book,
        chapter: parseInt(mBibleChAmud[1], 10),
        verse: undefined,
        fullRef: ref,
      };
      if (process.env.NODE_ENV !== 'production') {
        debugLog('[RefUtils] Parsed Tanakh chapter ref (amud artifact):', { ref, result });
      }
      return result;
    }
  }

  const result: ParsedRef = { type: 'other', book, fullRef: ref };
  if (process.env.NODE_ENV !== 'production') {
    debugLog('[RefUtils] Parsed other ref:', { ref, result });
  }
  return result;
}

export function isRefOverlap(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;

  const pa = parseRefSmart(a);
  const pb = parseRefSmart(b);
  if (!pa || !pb) return a.trim().toLowerCase() === b.trim().toLowerCase();

  if (pa.type !== pb.type || normalizeKey(pa.book) !== normalizeKey(pb.book)) {
    return false;
  }

  if (pa.type === 'talmud' && pb.type === 'talmud') {
    const dafA = pa.daf;
    const amudA = pa.amud || 'a';
    const dafB = pb.daf;
    const amudB = pb.amud || 'a';

    if (dafA !== dafB || amudA !== amudB) {
      return false;
    }

    if (pa.segment == null || pb.segment == null) {
      return true;
    }

    const startA = pa.segment;
    const endA = pa.endSegment ?? startA;
    const startB = pb.segment;
    const endB = pb.endSegment ?? startB;

    return Math.max(startA, startB) <= Math.min(endA, endB);
  }

  if (pa.type === 'tanakh' && pb.type === 'tanakh') {
    if (pa.chapter !== pb.chapter) {
      return false;
    }

    if (pa.verse == null || pb.verse == null) {
      return true;
    }

    const startA = pa.verse;
    const endA = pa.endVerse ?? startA;
    const startB = pb.verse;
    const endB = pb.endVerse ?? startB;

    return Math.max(startA, startB) <= Math.min(endA, endB);
  }

  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export function refEquals(a?: string, b?: string): boolean {
  return isRefOverlap(a, b);
}

// Нормализация ссылок для API
export function normalizeRefForAPI(ref: string): string {
  if (!ref) return ref;

  const cleanedRef = ref.replace(/(\d+)\s*а\b/gi, '$1a').replace(/(\d+)\s*б\b/gi, '$1b');
  const p = parseRefSmart(cleanedRef);
  if (!p) return cleanedRef;

  if (p.type === 'talmud' && p.segment != null) {
    const amud = p.amud ? `${p.daf}${p.amud}` : String(p.daf);
    return `${p.book} ${amud}.${p.segment}`;
  }

  if (p.type === 'tanakh' && p.verse != null) {
    return `${p.book} ${p.chapter}:${p.verse}`;
  }

  return cleanedRef;
}
