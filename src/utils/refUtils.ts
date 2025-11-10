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
  chapter?: number;
  verse?: number;
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
  const tailHead = sanitizedTailToken.split(/[-–]/)[0];
  const tail = tailHead.toLowerCase();

  const isTanakhBook = Boolean(book) && isKnownTanakhBook(book);
  const isTalmudBook = Boolean(book) && isKnownTalmudBook(book);
  const looksLikeTalmudShape = /^\d+[ab](?::\d+)?$/.test(tail);

  // --- 1. Талмудический формат: 29a, 29b:3, 29a.5
  const mTalmud = tail.match(/^(\d+)\s*([ab])?(?:[:.]\s*(\d+))?$/);
  if (mTalmud && (isTalmudBook || (!isTanakhBook && looksLikeTalmudShape))) {
    const result: ParsedRef = {
      type: 'talmud',
      book,
      daf: parseInt(mTalmud[1], 10),
      amud: (mTalmud[2] as 'a' | 'b') ?? undefined,
      segment: mTalmud[3] ? parseInt(mTalmud[3], 10) : undefined,
      fullRef: ref,
    };
    if (process.env.NODE_ENV !== 'production') {
      debugLog('[RefUtils] Parsed Talmud ref:', { ref, result });
    }
    return result;
  }

  // --- 2. Библейский формат: Genesis 1:1
  const mBible = tail.match(/^(\d+):(\d+)$/);
  if (mBible && isTanakhBook) {
    const result: ParsedRef = {
      type: 'tanakh',
      book,
      chapter: parseInt(mBible[1], 10),
      verse: parseInt(mBible[2], 10),
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

export function refEquals(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const pa = parseRefSmart(a);
  const pb = parseRefSmart(b);
  if (!pa || !pb || pa.type !== pb.type) return a === b;
  if (pa.type === 'talmud' && pb.type === 'talmud') {
    return (
      pa.book === pb.book &&
      pa.daf === pb.daf &&
      (pa.amud || 'a') === (pb.amud || 'a') &&
      (pa.segment ?? 0) === (pb.segment ?? 0)
    );
  }
  if (pa.type === 'tanakh' && pb.type === 'tanakh') {
    return pa.book === pb.book && pa.chapter === pb.chapter && (pa.verse ?? 0) === (pb.verse ?? 0);
  }
  return a === b;
}

// Нормализация ссылок для API
export function normalizeRefForAPI(ref: string): string {
  if (!ref) return ref;

  const p = parseRefSmart(ref);
  if (!p) return ref;

  if (p.type === 'talmud' && p.segment != null) {
    const amud = p.amud ? `${p.daf}${p.amud}` : String(p.daf);
    return `${p.book} ${amud}.${p.segment}`;
  }

  if (p.type === 'tanakh' && p.verse != null) {
    return `${p.book} ${p.chapter}:${p.verse}`;
  }

  return ref;
}
