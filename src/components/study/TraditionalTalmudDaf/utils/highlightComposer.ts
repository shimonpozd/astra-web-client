import { escapeAttr } from './highlightMatching';

export interface HighlightRange {
  start: number; // clean text character start index
  end: number;   // clean text character end index
  layer: 'dh' | 'sage' | 'concept' | 'sugya';
  classes: string[];
  attributes?: Record<string, string>;
}

/**
 * Builds cleanText (letters/digits/spaces, skipping nikud, taamim, HTML tags)
 * and cleanToRawStart array of size cleanText.length + 1.
 * cleanToRawStart[c] is the raw text index where clean character c starts.
 * cleanToRawStart[cleanText.length] is rawText.length.
 */
export function buildCleanToRawMap(rawText: string): { cleanText: string; cleanToRawStart: number[] } {
  const cleanToRawStart: number[] = [];
  let cleanText = '';

  let inTag = false;
  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    if (ch === '<') {
      inTag = true;
      continue;
    }
    if (ch === '>') {
      inTag = false;
      continue;
    }
    if (inTag) continue;

    const isNikudOrTaam = /[\u0591-\u05C7\u200E\u200F]/.test(ch);
    if (!isNikudOrTaam) {
      cleanToRawStart.push(i);
      cleanText += ch;
    }
  }

  // Sentinel value for the end of rawText
  cleanToRawStart.push(rawText.length);

  return { cleanText, cleanToRawStart };
}

/**
 * Renders Entity ranges (Sages & Concepts) over clean text interval [rStart, rEnd].
 */
function renderEntityRanges(
  rStart: number,
  rEnd: number,
  rawText: string,
  cleanToRawStart: number[],
  entityRanges: HighlightRange[]
): string {
  if (rStart >= rEnd) return '';

  const active = entityRanges
    .filter((r) => Math.max(r.start, rStart) < Math.min(r.end, rEnd))
    .map((r) => ({
      ...r,
      start: Math.max(r.start, rStart),
      end: Math.min(r.end, rEnd),
    }));

  if (active.length === 0) {
    const rawS = cleanToRawStart[rStart] ?? 0;
    const rawE = cleanToRawStart[rEnd] ?? rawS;
    return rawText.slice(rawS, rawE);
  }

  const boundarySet = new Set<number>();
  boundarySet.add(rStart);
  boundarySet.add(rEnd);

  for (const r of active) {
    boundarySet.add(r.start);
    boundarySet.add(r.end);
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);
  let htmlResult = '';

  for (let i = 0; i < boundaries.length - 1; i++) {
    const bStart = boundaries[i];
    const bEnd = boundaries[i + 1];

    if (bStart >= bEnd) continue;

    const rawS = cleanToRawStart[bStart] ?? 0;
    const rawE = cleanToRawStart[bEnd] ?? rawS;
    const rawChunk = rawText.slice(rawS, rawE);

    const activeInSlice = active.filter((r) => r.start <= bStart && r.end >= bEnd);

    if (activeInSlice.length === 0) {
      htmlResult += rawChunk;
    } else {
      const classesSet = new Set<string>();
      const attributesMap: Record<string, string> = {};

      for (const r of activeInSlice) {
        for (const cls of r.classes || []) {
          if (cls) classesSet.add(cls);
        }
        if (r.attributes) {
          for (const [k, v] of Object.entries(r.attributes)) {
            if (v !== undefined && v !== null) {
              attributesMap[k] = v;
            }
          }
        }
      }

      const mergedClasses = Array.from(classesSet).join(' ');
      const attrStrings = Object.entries(attributesMap).map(
        ([k, v]) => `${k}="${escapeAttr(v)}"`
      );
      const attrPart = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';

      htmlResult += `<span class="${mergedClasses}"${attrPart}>${rawChunk}</span>`;
    }
  }

  return htmlResult;
}

/**
 * Renders DH ranges (Rashi / Tosafot) over clean text interval [rStart, rEnd],
 * nesting Entity ranges (Sages & Concepts) cleanly inside DH spans and gaps.
 */
function renderInnerRanges(
  rStart: number,
  rEnd: number,
  rawText: string,
  cleanToRawStart: number[],
  innerRanges: HighlightRange[]
): string {
  if (rStart >= rEnd) return '';

  const dhRanges = innerRanges
    .filter((r) => r.layer === 'dh' && Math.max(r.start, rStart) < Math.min(r.end, rEnd))
    .sort((a, b) => a.start - b.start);

  const entityRanges = innerRanges.filter((r) => r.layer === 'sage' || r.layer === 'concept');

  if (dhRanges.length === 0) {
    return renderEntityRanges(rStart, rEnd, rawText, cleanToRawStart, entityRanges);
  }

  let htmlResult = '';
  let currClean = rStart;

  for (const dh of dhRanges) {
    const dhStart = Math.max(currClean, dh.start);
    const dhEnd = Math.min(rEnd, dh.end);

    if (dhStart > currClean) {
      htmlResult += renderEntityRanges(currClean, dhStart, rawText, cleanToRawStart, entityRanges);
    }

    if (dhStart < dhEnd) {
      const innerContent = renderEntityRanges(dhStart, dhEnd, rawText, cleanToRawStart, entityRanges);
      const mergedClasses = (dh.classes || []).join(' ');
      const attrStrings = Object.entries(dh.attributes || {}).map(
        ([k, v]) => `${k}="${escapeAttr(v)}"`
      );
      const attrPart = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';

      htmlResult += `<span class="${mergedClasses}"${attrPart}>${innerContent}</span>`;
      currClean = dhEnd;
    }
  }

  if (currClean < rEnd) {
    htmlResult += renderEntityRanges(currClean, rEnd, rawText, cleanToRawStart, entityRanges);
  }

  return htmlResult;
}

/**
 * Hierarchical HTML Highlight Composer:
 * 1. Sugya phrases form continuous unbroken outer <span> containers.
 * 2. DH (Rashi/Tosafot) spans form middle <span> containers.
 * 3. Entity (Sages & Concepts) spans form inner <span> children inside DH and gaps.
 * 4. Guarantees every raw character is rendered EXACTLY ONCE with full visual fidelity.
 */
export function compositeTextWithHighlights(rawText: string, ranges: HighlightRange[]): string {
  if (!rawText) return '';
  if (!ranges || ranges.length === 0) return rawText;

  const { cleanText, cleanToRawStart } = buildCleanToRawMap(rawText);
  const cleanLength = cleanText.length;
  if (cleanLength === 0 || cleanToRawStart.length === 0) return rawText;

  const validRanges = ranges
    .filter((r) => r && r.start >= 0 && r.end > r.start && r.start < cleanLength)
    .map((r) => ({
      ...r,
      start: Math.max(0, r.start),
      end: Math.min(cleanLength, r.end),
    }));

  if (validRanges.length === 0) return rawText;

  const sugyaRanges = validRanges
    .filter((r) => r.layer === 'sugya')
    .sort((a, b) => a.start - b.start);

  const innerRanges = validRanges.filter((r) => r.layer !== 'sugya');

  let htmlResult = '';
  let currClean = 0;

  for (const sugya of sugyaRanges) {
    if (sugya.start > currClean) {
      htmlResult += renderInnerRanges(currClean, sugya.start, rawText, cleanToRawStart, innerRanges);
    }

    const sStart = Math.max(currClean, sugya.start);
    const sEnd = sugya.end;

    if (sStart < sEnd) {
      const innerHtml = renderInnerRanges(sStart, sEnd, rawText, cleanToRawStart, innerRanges);
      const mergedClasses = (sugya.classes || []).join(' ');
      const attrStrings = Object.entries(sugya.attributes || {}).map(
        ([k, v]) => `${k}="${escapeAttr(v)}"`
      );
      const attrPart = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';

      htmlResult += `<span class="${mergedClasses}"${attrPart}>${innerHtml}</span>`;
      currClean = sEnd;
    }
  }

  if (currClean < cleanLength) {
    htmlResult += renderInnerRanges(currClean, cleanLength, rawText, cleanToRawStart, innerRanges);
  }

  return htmlResult;
}
