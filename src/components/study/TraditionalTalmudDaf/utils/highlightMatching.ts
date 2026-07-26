import { stripHebrewVowels, stripPunctuation } from '../../../../utils/hebrewUtils';
import { CompiledSageHighlight, CompiledConceptHighlight, TraditionalComment, TextToken } from '../types';
import { parseCommentDh } from './commentParsing';

export const escapeAttr = (value: string) => (value || '').replace(/"/g, '&quot;');

export const highlightFullPhraseInHtml = (
  html: string,
  regex: RegExp,
  wrapFn: (matchedText: string) => string
): string => {
  const plainToHtmlIndex: number[] = [];
  let plainText = '';
  let inTag = false;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    if (char === '<') {
      inTag = true;
    } else if (char === '>') {
      inTag = false;
    } else if (!inTag) {
      plainToHtmlIndex.push(i);
      plainText += char;
    }
  }

  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  const matches: { startHtml: number; endHtml: number }[] = [];

  while ((match = regex.exec(plainText)) !== null) {
    const matchStart = match.index;
    const matchEnd = match.index + match[0].length;

    if (matchStart < plainToHtmlIndex.length && matchEnd <= plainToHtmlIndex.length) {
      const startHtml = plainToHtmlIndex[matchStart];
      const lastPlainIdx = matchEnd - 1;
      const endHtml = plainToHtmlIndex[lastPlainIdx] + 1;

      matches.push({ startHtml, endHtml });
    }

    if (!regex.global) break;
  }

  if (matches.length === 0) return html;

  let result = html;
  for (let i = matches.length - 1; i >= 0; i--) {
    const { startHtml, endHtml } = matches[i];
    const matchedHtmlChunk = result.substring(startHtml, endHtml);
    if (matchedHtmlChunk.includes('class="highlight-dh')) continue;

    const wrapped = wrapFn(matchedHtmlChunk);
    result = result.substring(0, startHtml) + wrapped + result.substring(endHtml);
  }

  return result;
};

export const replaceOutsideTags = (html: string, regex: RegExp, replacer: (match: string) => string) => {
  const parts = html.split(/(<[^>]+>)/g);
  let openHighlightSpanCount = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part.startsWith('<')) {
      if (/^<span\b[^>]*class="[^"]*highlight-/i.test(part)) {
        openHighlightSpanCount += 1;
      } else if (part === '</span>' && openHighlightSpanCount > 0) {
        openHighlightSpanCount -= 1;
      }
      continue;
    }

    if (openHighlightSpanCount === 0) {
      regex.lastIndex = 0; // Reset state for global regexes
      parts[i] = part.replace(regex, replacer);
    }
  }
  return parts.join('');
};

export const renderHighlightedText = (
  text: string,
  sages: CompiledSageHighlight[] = [],
  concepts: CompiledConceptHighlight[] = [],
) => {
  let html = text || '';

  for (const sage of sages) {
    const periodRaw = (sage.period || 'sage').toLowerCase();
    const periodBase = periodRaw.split('_')[0] || 'sage';
    const colorClass = `highlight-sage-${periodBase}`;
    html = replaceOutsideTags(html, sage.regex, (match) => {
      return `<span class="highlight-sage ${colorClass} hover-target" data-entity-type="sage" data-slug="${escapeAttr(sage.slug)}">${match}</span>`;
    });
  }

  for (const concept of concepts) {
    for (const rx of concept.regexes || []) {
      html = replaceOutsideTags(html, rx, (match) => {
        return `<span class="highlight-concept hover-target" data-entity-type="concept" data-slug="${escapeAttr(concept.slug)}">${match}</span>`;
      });
    }
  }

  return html;
};

const wildPlaceholder = '(?:[\\u05D0-\\u05EA\\u05B0-\\u05C7\\s"\'\u200E\u200F]{1,25})';

export const buildHebrewFuzzyRegex = (phrase: string): RegExp | null => {
  if (!phrase || phrase.trim().length < 2) return null;

  const parts = phrase.split(/(\[[^\]]*WILD[^\]]*\])/gi);
  const regexParts: string[] = [];

  for (const part of parts) {
    if (/^\[.*WILD.*\]$/i.test(part.trim())) {
      regexParts.push(wildPlaceholder);
      continue;
    }

    const clean = stripPunctuation(stripHebrewVowels(part))
      .replace(/[\u0591-\u05AF\u05C7\u200E\u200F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!clean) continue;

    const words = clean.split(' ');
    const escapedWords = words.map((word) => {
      return Array.from(word)
        .map((char: string) => {
          let baseChar = char;
          if (char === 'ם' || char === 'מ') baseChar = '[מם]';
          else if (char === 'ן' || char === 'נ') baseChar = '[נן]';
          else if (char === 'ץ' || char === 'צ') baseChar = '[צץ]';
          else if (char === 'ף' || char === 'פ') baseChar = '[פף]';
          else if (char === 'ך' || char === 'כ') baseChar = '[כך]';
          else if (char === 'י' || char === 'ו' || char === 'א' || char === 'ה') {
            return `${char}?[\\u0591-\\u05C7]*`;
          } else if (char >= '\u05D0' && char <= '\u05EA') {
            baseChar = char;
          } else {
            baseChar = char.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          }
          return `${baseChar}[\\u0591-\\u05C7]*`;
        })
        .join('');
    });

    const separator = `[\\s\\u200E\\u200F"'\\"().,!?;:\\-\\[\\]{}ׇ]*`;
    regexParts.push(escapedWords.join(separator));
  }

  if (regexParts.length === 0) return null;

  const separator = `[\\s\\u200E\\u200F"'\\"().,!?;:\\-\\[\\]{}ׇ]*`;
  const pattern = `(?<![\\u0590-\\u05FF])${regexParts.join(separator)}(?![\\u0590-\\u05FF])`;
  try {
    return new RegExp(pattern, 'gu');
  } catch (e) {
    return null;
  }
};

export function extractGemaraWordTokens(html: string): TextToken[] {
  const tokens: TextToken[] = [];
  let inTag = false;
  let currentWord = '';
  let wordStartHtml = -1;
  let wordEndHtml = -1;

  for (let i = 0; i < html.length; i++) {
    const char = html[i];
    if (char === '<') {
      inTag = true;
      continue;
    }
    if (char === '>') {
      inTag = false;
      continue;
    }
    if (inTag) continue;

    if (char >= '\u05D0' && char <= '\u05EA') {
      if (wordStartHtml === -1) wordStartHtml = i;
      wordEndHtml = i + 1;
      currentWord += char;
    } else if (/[\u0591-\u05C7\u200E\u200F]/.test(char)) {
      if (wordStartHtml !== -1) {
        wordEndHtml = i + 1;
      }
    } else {
      if (currentWord.length > 0 && wordStartHtml !== -1) {
        const clean = currentWord.replace(/[\u0591-\u05C7\u200E\u200F]/g, '');
        const stem = clean.replace(/[יואה]/g, '');
        if (clean.length >= 2) {
          tokens.push({
            clean,
            stem,
            startHtml: wordStartHtml,
            endHtml: wordEndHtml,
          });
        }
        currentWord = '';
        wordStartHtml = -1;
      }
    }
  }

  if (currentWord.length > 0 && wordStartHtml !== -1) {
    const clean = currentWord.replace(/[\u0591-\u05C7\u200E\u200F]/g, '');
    const stem = clean.replace(/[יואה]/g, '');
    if (clean.length >= 2) {
      tokens.push({
        clean,
        stem,
        startHtml: wordStartHtml,
        endHtml: wordEndHtml,
      });
    }
  }

  return tokens;
}

export function matchWordsEqual(w1: string, s1: string, w2: string, s2: string): boolean {
  if (w1 === w2) return true;
  if (s1.length >= 3 && s2.length >= 3 && s1 === s2) return true;
  return false;
}

export const highlightDhInGemara = (
  text: string,
  commentsForSegment: TraditionalComment[],
  _activeRef: string | null = null,
  _hoveredRef: string | null = null
) => {
  if (!text) return text;

  const tokens = extractGemaraWordTokens(text);
  if (tokens.length === 0) return text;

  const sortedComments = [...commentsForSegment]
    .map(c => {
      const { dh } = parseCommentDh(c.he);
      const cleanWords = (dh || '')
        .replace(/[\u0591-\u05C7\u200E\u200F]/g, '')
        .replace(/["'""().,!?;:\-\[\]{}–—ׇ]/g, ' ')
        .split(/\s+/)
        .filter(w => w && w.length >= 2 && !/^(ופרכינן|פירש|כלומר|והכי|כגון|וזהו|וכו|גו|וגו|ע)$/i.test(w))
        .map(w => ({
          clean: w,
          stem: w.replace(/[יואה]/g, ''),
        }));
      return { comment: c, dh, cleanWords };
    })
    .filter(item => item.cleanWords.length > 0)
    .sort((a, b) => b.cleanWords.length - a.cleanWords.length);

  const matches: { startHtml: number; endHtml: number; commentRefs: string[]; isRashi: boolean; isTosafot: boolean }[] = [];

  for (const item of sortedComments) {
    const dhWords = item.cleanWords;
    let bestMatch: { startTokenIdx: number; endTokenIdx: number; count: number } | null = null;

    for (let tIdx = 0; tIdx < tokens.length; tIdx++) {
      const dhStart = 0;
      let count = 0;
      while (
        tIdx + count < tokens.length &&
        dhStart + count < dhWords.length &&
        matchWordsEqual(
          tokens[tIdx + count].clean,
          tokens[tIdx + count].stem,
          dhWords[dhStart + count].clean,
          dhWords[dhStart + count].stem
        )
      ) {
        count++;
      }

      if (count >= 2 || (count === 1 && dhWords.length === 1)) {
        if (!bestMatch || count > bestMatch.count) {
          bestMatch = { startTokenIdx: tIdx, endTokenIdx: tIdx + count - 1, count };
        }
      }
    }

    if (bestMatch) {
      const startHtml = tokens[bestMatch.startTokenIdx].startHtml;
      const endHtml = tokens[bestMatch.endTokenIdx].endHtml;
      const isRashi = item.comment.commentator.toLowerCase().includes('rashi');
      const isTosafot = item.comment.commentator.toLowerCase().includes('tosafot');

      const existingMatch = matches.find(m => m.startHtml === startHtml && m.endHtml === endHtml);
      if (existingMatch) {
        if (!existingMatch.commentRefs.includes(item.comment.ref)) {
          existingMatch.commentRefs.push(item.comment.ref);
        }
        if (isRashi) existingMatch.isRashi = true;
        if (isTosafot) existingMatch.isTosafot = true;
      } else {
        const overlaps = matches.some(m => Math.max(m.startHtml, startHtml) < Math.min(m.endHtml, endHtml));
        if (!overlaps) {
          matches.push({
            startHtml,
            endHtml,
            commentRefs: [item.comment.ref],
            isRashi,
            isTosafot,
          });
        }
      }
    }
  }

  if (matches.length === 0) return text;

  matches.sort((a, b) => b.startHtml - a.startHtml);

  let result = text;
  for (const m of matches) {
    const chunk = result.substring(m.startHtml, m.endHtml);
    const classes = ['highlight-dh'];
    if (m.isRashi) classes.push('dh-rashi');
    if (m.isTosafot) classes.push('dh-tosafot');
    const refsAttr = escapeAttr(m.commentRefs.join('|'));
    const wrapped = `<span class="${classes.join(' ')}" data-comment-ref="${refsAttr}">${chunk}</span>`;
    result = result.substring(0, m.startHtml) + wrapped + result.substring(m.endHtml);
  }

  return result;
};
