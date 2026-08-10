import { isRefOverlap } from './refUtils';
import { buildCleanToRawMap, compositeTextWithHighlights, HighlightRange } from '../components/study/TraditionalTalmudDaf/utils/highlightComposer';

export function stripHebrewVowels(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u0591-\u05C7]/g, '') // strip nikud & taamim
    .replace(/<[^>]+>/g, ' ')        // strip HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

export function getDOMTargetElementsForRef(ref?: string): Element[] {
  if (!ref) return [];
  try {
    const exactQuery = document.querySelectorAll(`[data-ref="${CSS.escape(ref)}"]`);
    if (exactQuery.length > 0) return Array.from(exactQuery);
  } catch (e) {}

  const fallbackQuery = document.querySelectorAll(`[data-ref="${ref}"]`);
  if (fallbackQuery.length > 0) return Array.from(fallbackQuery);

  const matched: Element[] = [];
  document.querySelectorAll('[data-ref]').forEach((el) => {
    const elRef = el.getAttribute('data-ref');
    if (elRef && isRefOverlap(elRef, ref)) {
      matched.push(el);
    }
  });
  return matched;
}



export function getSugyaRanges(
  rawText: string,
  ref: string,
  nodes?: Array<any>
): HighlightRange[] {
  if (!rawText || !nodes || nodes.length === 0 || !ref) return [];

  const segNodes = nodes.filter((n) => n && n.ref && isRefOverlap(n.ref, ref));
  if (segNodes.length === 0) return [];

  const { cleanText } = buildCleanToRawMap(rawText);
  if (!cleanText) return [];

  const lettersOnlyToCleanMap: number[] = [];
  let cleanLettersText = '';

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];
    if (/[\u05D0-\u05EA0-9]/.test(ch)) {
      lettersOnlyToCleanMap.push(i);
      cleanLettersText += ch;
    }
  }

  if (cleanLettersText.length === 0) return [];

  const nodeMatches: Array<{ startLetterIdx: number; node: any }> = [];

  for (const node of segNodes) {
    const startQuote = node.start_anchor || node.start_quote;
    if (!startQuote) continue;

    const cleanStart = stripHebrewVowels(startQuote).replace(/[^\u05D0-\u05EA0-9]/g, '');
    if (cleanStart.length < 2) continue;

    let startLetterIdx = cleanLettersText.indexOf(cleanStart);
    if (startLetterIdx === -1) {
      const words = cleanStart.split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (w.length >= 3) {
          const idx = cleanLettersText.indexOf(w);
          if (idx !== -1) {
            startLetterIdx = idx;
            break;
          }
        }
      }
    }

    if (startLetterIdx !== -1) {
      nodeMatches.push({ startLetterIdx, node });
    }
  }

  if (nodeMatches.length === 0) return [];

  nodeMatches.sort((a, b) => a.startLetterIdx - b.startLetterIdx);

  const sugyaRanges: HighlightRange[] = [];

  for (let k = 0; k < nodeMatches.length; k++) {
    const curr = nodeMatches[k];
    const nextStartLetter = k + 1 < nodeMatches.length
      ? nodeMatches[k + 1].startLetterIdx
      : cleanLettersText.length;

    const startLetter = (k === 0 && curr.startLetterIdx <= 5) ? 0 : curr.startLetterIdx;
    const endLetter = Math.max(startLetter + 1, nextStartLetter);

    const startClean = lettersOnlyToCleanMap[startLetter] ?? 0;
    const endClean = endLetter >= cleanLettersText.length
      ? cleanText.length
      : (lettersOnlyToCleanMap[endLetter] ?? cleanText.length);

    if (startClean < endClean) {
      const node = curr.node;
      const levelClass = node.level === 2 ? 'level-2' : 'level-1';
      const typeClass = `type-${node.type || 'Statement'}`;
      const oddEvenClass = (node.sub_index || 0) % 2 === 0 ? 'sub-even' : 'sub-odd';
      const tooltipText = `${node.speaker ? `[${node.speaker}] ` : ''}${node.title || node.title_ru || ''}`;

      sugyaRanges.push({
        start: startClean,
        end: endClean,
        layer: 'sugya',
        classes: ['sugya-span-text', levelClass, typeClass, oddEvenClass, 'cursor-pointer', 'transition-all', 'hover:brightness-125'],
        attributes: {
          'data-node-id': String(node.id || ''),
          'title': tooltipText,
        },
      });
    }
  }

  return sugyaRanges;
}

/**
 * Оборачивает фазы текста Гмары в Bidi-safe скобки ❪ ❫, микро-иконки и цветные подчёркивания.
 */
export function applySugyaSpansToSegmentHtml(
  htmlText: string,
  ref: string,
  nodes?: Array<any>
): string {
  if (!htmlText || !nodes || nodes.length === 0 || !ref) return htmlText;
  const sugyaRanges = getSugyaRanges(htmlText, ref, nodes);
  if (sugyaRanges.length === 0) return htmlText;
  return compositeTextWithHighlights(htmlText, sugyaRanges);
}

export function scrollToAnchor(ref?: string, _startAnchor?: string, _endAnchor?: string, _nodeType?: string) {
  if (!ref) return;
  const targetElements = getDOMTargetElementsForRef(ref);
  if (targetElements.length === 0) return;

  targetElements[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export function highlightNodeHover(ref?: string, _nodeType?: string, isHovered: boolean = true) {
  if (!ref) return;
  const targetElements = getDOMTargetElementsForRef(ref);
  targetElements.forEach((el) => {
    if (isHovered) el.classList.add('sugya-node-hover-active');
    else el.classList.remove('sugya-node-hover-active');
  });
}

export function highlightMindMapNodeOnHover(ref?: string, isHovered: boolean = true) {
  if (!ref) return;
  document.querySelectorAll('[data-sugya-node-ref]').forEach((el) => {
    const nodeRef = el.getAttribute('data-sugya-node-ref');
    if (nodeRef && isRefOverlap(ref, nodeRef)) {
      if (isHovered) el.classList.add('sugya-tree-node-hover-active');
      else el.classList.remove('sugya-tree-node-hover-active');
    }
  });
}

export function applyWholeSugyaHighlight(nodes?: any[], isVisible: boolean = true) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sugya-nodes-updated', { detail: isVisible ? (nodes || null) : null }));
  }
}

export function getActiveSugyaNodes() {
  return null;
}
