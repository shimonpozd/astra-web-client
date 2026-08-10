import { escapeAttr } from './highlightMatching';

export interface HighlightRange {
  start: number; // clean text character start index
  end: number;   // clean text character end index
  layer: 'dh' | 'sage' | 'concept' | 'sugya';
  classes: string[];
  attributes?: Record<string, string>;
}

/**
 * Builds a map from clean text index (letters/digits only, skipping nikud, taamim, HTML tags)
 * to raw text index range.
 */
export function buildCleanToRawMap(rawText: string): { cleanText: string; cleanToRawStart: number[]; cleanToRawEnd: number[] } {
  const cleanToRawStart: number[] = [];
  const cleanToRawEnd: number[] = [];
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

    // Check if character is Hebrew letter, digit, or standard printable non-nikud char
    // Nikud and taamim are in range \u0591-\u05C7
    const isNikudOrTaam = /[\u0591-\u05C7\u200E\u200F]/.test(ch);
    if (!isNikudOrTaam) {
      cleanToRawStart.push(i);
      cleanText += ch;

      // Find raw end offset (including trailing nikud/taamim attached to this char)
      let endIdx = i + 1;
      while (endIdx < rawText.length) {
        const nextCh = rawText[endIdx];
        if (nextCh === '<') break;
        if (/[\u0591-\u05C7\u200E\u200F]/.test(nextCh)) {
          endIdx++;
        } else {
          break;
        }
      }
      cleanToRawEnd.push(endIdx);
    }
  }

  return { cleanText, cleanToRawStart, cleanToRawEnd };
}

/**
 * Combines multiple highlight ranges (DH, Sages, Concepts, Sugya) over raw text.
 * Divides clean text into non-overlapping interval slices and wraps each slice in a single HTML <span>
 * with merged CSS classes and data attributes.
 */
export function compositeTextWithHighlights(rawText: string, ranges: HighlightRange[]): string {
  if (!rawText) return '';
  if (!ranges || ranges.length === 0) return rawText;

  const { cleanText, cleanToRawStart, cleanToRawEnd } = buildCleanToRawMap(rawText);
  if (cleanText.length === 0 || cleanToRawStart.length === 0) return rawText;

  // Filter valid ranges within cleanText bounds
  const validRanges = ranges
    .filter((r) => r && r.start >= 0 && r.end > r.start && r.start < cleanText.length)
    .map((r) => ({
      ...r,
      start: Math.max(0, r.start),
      end: Math.min(cleanText.length, r.end),
    }));

  if (validRanges.length === 0) return rawText;

  // Collect all unique boundary points in clean text coordinates
  const boundarySet = new Set<number>();
  boundarySet.add(0);
  boundarySet.add(cleanText.length);

  for (const r of validRanges) {
    boundarySet.add(r.start);
    boundarySet.add(r.end);
  }

  const boundaries = Array.from(boundarySet).sort((a, b) => a - b);

  let htmlResult = '';
  let lastRawEnd = 0;

  for (let i = 0; i < boundaries.length - 1; i++) {
    const bStart = boundaries[i];
    const bEnd = boundaries[i + 1];

    if (bStart >= bEnd) continue;

    // Get active ranges covering interval [bStart, bEnd]
    const active = validRanges.filter((r) => r.start <= bStart && r.end >= bEnd);

    // Map clean text indices bStart..bEnd to raw text indices
    const rawStart = cleanToRawStart[bStart] ?? lastRawEnd;
    const rawEnd = bEnd >= cleanText.length
      ? rawText.length
      : (cleanToRawEnd[bEnd - 1] ?? rawStart);

    // Include any unmapped raw characters (e.g. leading whitespace or HTML tags) before rawStart
    if (rawStart > lastRawEnd) {
      htmlResult += rawText.slice(lastRawEnd, rawStart);
    }

    const chunkRawText = rawText.slice(rawStart, rawEnd);
    lastRawEnd = rawEnd;

    if (active.length === 0) {
      htmlResult += chunkRawText;
    } else {
      // Merge CSS classes (preserving layer priority order: sugya, dh, sage/concept)
      const classesSet = new Set<string>();
      const attributesMap: Record<string, string> = {};

      // Sort active ranges so sugya classes come first, then dh, then sage/concept
      const layerPriority: Record<string, number> = { sugya: 1, dh: 2, sage: 3, concept: 4 };
      active.sort((a, b) => (layerPriority[a.layer] || 99) - (layerPriority[b.layer] || 99));

      for (const r of active) {
        for (const cls of r.classes || []) {
          if (cls) classesSet.add(cls);
        }
        if (r.attributes) {
          for (const [attrKey, attrVal] of Object.entries(r.attributes)) {
            if (attrVal !== undefined && attrVal !== null) {
              attributesMap[attrKey] = attrVal;
            }
          }
        }
      }

      const mergedClasses = Array.from(classesSet).join(' ');
      const attrStrings = Object.entries(attributesMap).map(
        ([k, v]) => `${k}="${escapeAttr(v)}"`
      );
      const attrPart = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';

      htmlResult += `<span class="${mergedClasses}"${attrPart}>${chunkRawText}</span>`;
    }
  }

  if (lastRawEnd < rawText.length) {
    htmlResult += rawText.slice(lastRawEnd);
  }

  return htmlResult;
}
