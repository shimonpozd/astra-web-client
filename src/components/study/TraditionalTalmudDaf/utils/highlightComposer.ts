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
 * Renders inner content of clean text interval [rStart, rEnd] with active DH and Entity highlights.
 * Uses interval partitioning to ensure every raw character in [rStart, rEnd] is rendered EXACTLY ONCE.
 */
function renderInnerRanges(
  rStart: number,
  rEnd: number,
  rawText: string,
  cleanToRawStart: number[],
  innerRanges: HighlightRange[]
): string {
  if (rStart >= rEnd) return '';

  // Filter ranges that overlap with [rStart, rEnd]
  const activeRanges = innerRanges
    .filter((r) => Math.max(r.start, rStart) < Math.min(r.end, rEnd))
    .map((r) => ({
      ...r,
      start: Math.max(r.start, rStart),
      end: Math.min(r.end, rEnd),
    }));

  if (activeRanges.length === 0) {
    const rawS = cleanToRawStart[rStart] ?? 0;
    const rawE = cleanToRawStart[rEnd] ?? rawS;
    return rawText.slice(rawS, rawE);
  }

  // Collect all unique boundary points within [rStart, rEnd]
  const boundarySet = new Set<number>();
  boundarySet.add(rStart);
  boundarySet.add(rEnd);

  for (const r of activeRanges) {
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

    // Find active inner ranges covering [bStart, bEnd]
    const active = activeRanges.filter((r) => r.start <= bStart && r.end >= bEnd);

    if (active.length === 0) {
      htmlResult += rawChunk;
    } else {
      const classesSet = new Set<string>();
      const attributesMap: Record<string, string> = {};

      for (const r of active) {
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
 * Non-duplicating Hierarchical Highlight Composer:
 * 1. Wraps Sugya phrases in continuous unbroken outer <span> containers.
 * 2. Renders inner DH (Rashi/Tosafot) and Entity (Sages/Concepts) highlights inside Sugya spans (and gaps).
 * 3. Guarantees every raw character is rendered EXACTLY ONCE with zero letter repetitions or broken words.
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

  // Partition cleanText into Sugya spans and gaps between Sugya spans
  let htmlResult = '';
  let currClean = 0;

  for (const sugya of sugyaRanges) {
    if (sugya.start > currClean) {
      // Gap before this Sugya span
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
