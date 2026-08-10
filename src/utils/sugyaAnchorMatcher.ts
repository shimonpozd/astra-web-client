import { isRefOverlap } from './refUtils';
import { buildCleanToRawMap, compositeTextWithHighlights, HighlightRange } from '../components/study/TraditionalTalmudDaf/utils/highlightComposer';
import { stripPunctuation } from './hebrewUtils';

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

  const nodeMatches: Array<{ startCleanIdx: number; node: any }> = [];

  for (const node of segNodes) {
    const startQuote = node.start_anchor || node.start_quote;
    if (!startQuote) continue;

    const cleanStart = stripHebrewVowels(startQuote).trim();
    if (cleanStart.length < 2) continue;

    let startCleanIdx = cleanText.indexOf(cleanStart);
    if (startCleanIdx === -1) {
      const noPunctStart = stripPunctuation(cleanStart).trim();
      if (noPunctStart.length >= 2) {
        startCleanIdx = cleanText.indexOf(noPunctStart);
      }
    }
    if (startCleanIdx === -1) {
      const words = cleanStart.split(/\s+/).filter((w) => w.length >= 2);
      for (const w of words) {
        const idx = cleanText.indexOf(w);
        if (idx !== -1) {
          startCleanIdx = idx;
          break;
        }
      }
    }

    if (startCleanIdx !== -1) {
      nodeMatches.push({ startCleanIdx, node });
    }
  }

  if (nodeMatches.length === 0) return [];

  nodeMatches.sort((a, b) => a.startCleanIdx - b.startCleanIdx);

  const sugyaRanges: HighlightRange[] = [];

  for (let k = 0; k < nodeMatches.length; k++) {
    const curr = nodeMatches[k];
    const nextStartClean = k + 1 < nodeMatches.length
      ? nodeMatches[k + 1].startCleanIdx
      : cleanText.length;

    const startClean = (k === 0 && curr.startCleanIdx <= 5) ? 0 : curr.startCleanIdx;
    const endClean = Math.max(startClean + 1, nextStartClean);

    if (endClean - startClean >= 3 || (k === nodeMatches.length - 1 && endClean > startClean)) {
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
          'data-node-type': String(node.type || 'Statement'),
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

export function highlightNodeHover(nodeId?: string, nodeType?: string, isHovered: boolean = true) {
  if (!nodeId) return;
  const spans = document.querySelectorAll(`.sugya-span-text[data-node-id="${CSS.escape(nodeId)}"]`);
  const typeCls = `type-${nodeType || 'Statement'}`;

  spans.forEach((el) => {
    if (isHovered) {
      el.classList.add('sugya-node-hover-active', typeCls);
    } else {
      el.classList.remove('sugya-node-hover-active', typeCls);
    }
  });
}

export function highlightMindMapNodeOnHover(nodeId?: string, nodeType?: string, isHovered: boolean = true) {
  if (!nodeId) return;
  const treeRoot = document.querySelector('[data-sugya-tree-root]');
  const targetCards = document.querySelectorAll(`[data-sugya-node-id="${CSS.escape(nodeId)}"], #sugya-tree-node-${CSS.escape(nodeId)}`);
  const typeCls = `type-${nodeType || 'Statement'}`;

  if (isHovered) {
    if (treeRoot) treeRoot.classList.add('sugya-tree-has-hover');
    targetCards.forEach((el) => {
      el.classList.add('sugya-tree-node-hover-active', typeCls);
    });
  } else {
    targetCards.forEach((el) => {
      el.classList.remove('sugya-tree-node-hover-active', typeCls);
    });
    if (treeRoot) {
      const remainingHover = treeRoot.querySelectorAll('.sugya-tree-node-hover-active');
      if (remainingHover.length === 0) {
        treeRoot.classList.remove('sugya-tree-has-hover');
      }
    }
  }
}

export function applyWholeSugyaHighlight(nodes?: any[], isVisible: boolean = true) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sugya-nodes-updated', { detail: isVisible ? (nodes || null) : null }));
  }
}

export function getActiveSugyaNodes() {
  return null;
}
