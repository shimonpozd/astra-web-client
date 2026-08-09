import { isRefOverlap } from './refUtils';

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

const TAXONOMY_ICONS: Record<string, string> = {
  Statement: '📌',
  Question: '❓',
  Attack: '⚔️',
  Defense: '🛡️',
  Proof: '🧾',
  Answer: '💡',
};

function adjustIdxOutsideTag(htmlText: string, idx: number): number {
  if (idx <= 0 || idx >= htmlText.length) return idx;
  const lastOpen = htmlText.lastIndexOf('<', idx);
  const lastClose = htmlText.lastIndexOf('>', idx);

  if (lastOpen > lastClose) {
    const closeIdx = htmlText.indexOf('>', idx);
    if (closeIdx !== -1) {
      return closeIdx + 1;
    }
  }
  return idx;
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

  const segNodes = nodes.filter((n) => n.ref && isRefOverlap(n.ref, ref));
  if (segNodes.length === 0) return htmlText;

  // 1. Построение карты буква -> индекс в сыром HTML (пропуская HTML-теги и никуд)
  const letterToRawMap: number[] = [];
  let lettersOnlyText = '';

  let inTag = false;
  for (let i = 0; i < htmlText.length; i++) {
    const ch = htmlText[i];
    if (ch === '<') { inTag = true; continue; }
    if (ch === '>') { inTag = false; continue; }
    if (inTag) continue;

    if (/[\u05D0-\u05EA0-9]/.test(ch)) {
      letterToRawMap.push(i);
      lettersOnlyText += ch;
    }
  }

  if (lettersOnlyText.length === 0) return htmlText;

  // 2. Find start letter index for each node
  const nodeMatches: Array<{ startLetterIdx: number; node: any }> = [];

  for (const node of segNodes) {
    const startQuote = node.start_anchor || node.start_quote;
    if (!startQuote) continue;

    const cleanStart = stripHebrewVowels(startQuote).replace(/[^\u05D0-\u05EA0-9]/g, '');
    if (cleanStart.length < 2) continue;

    let startLetterIdx = lettersOnlyText.indexOf(cleanStart);
    if (startLetterIdx === -1) {
      const words = cleanStart.split(/\s+/).filter(Boolean);
      for (const w of words) {
        if (w.length >= 3) {
          const idx = lettersOnlyText.indexOf(w);
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

  if (nodeMatches.length === 0) return htmlText;

  // 3. Sort by start letter index ascending & construct contiguous Start-to-Start phrase boundaries
  nodeMatches.sort((a, b) => a.startLetterIdx - b.startLetterIdx);

  const matches: Array<{ startRawIdx: number; endRawIdx: number; node: any }> = [];

  for (let k = 0; k < nodeMatches.length; k++) {
    const curr = nodeMatches[k];
    const nextStartLetter = k + 1 < nodeMatches.length ? nodeMatches[k + 1].startLetterIdx : lettersOnlyText.length;

    const startLetter = k === 0 ? 0 : curr.startLetterIdx;
    const endLetter = Math.max(startLetter + 1, nextStartLetter);

    let startRawIdx = adjustIdxOutsideTag(htmlText, letterToRawMap[startLetter]);
    let endRawIdx = k === nodeMatches.length - 1
      ? htmlText.length
      : adjustIdxOutsideTag(htmlText, letterToRawMap[Math.min(endLetter, letterToRawMap.length - 1)] || htmlText.length);

    if (startRawIdx !== undefined && endRawIdx !== undefined && startRawIdx < endRawIdx) {
      matches.push({ startRawIdx, endRawIdx, node: curr.node });
    }
  }

  if (matches.length === 0) return htmlText;

  // 4. Sort in REVERSE order for safe HTML tag insertion from end of string to start
  matches.sort((a, b) => b.startRawIdx - a.startRawIdx);

  let result = htmlText;

  for (const m of matches) {
    const { startRawIdx, endRawIdx, node } = m;
    const phrase = result.slice(startRawIdx, endRawIdx);

    const icon = (node.type && TAXONOMY_ICONS[node.type]) || '📌';
    const levelClass = node.level === 2 ? 'level-2' : 'level-1';
    const typeClass = `type-${node.type || 'Statement'}`;
    const tooltipText = `${node.speaker ? `[${node.speaker}] ` : ''}${node.title || ''}`;
    const oddEvenClass = (node.sub_index || 0) % 2 === 0 ? 'sub-even' : 'sub-odd';
    const wrapped = `<span class="sugya-span-text ${levelClass} ${typeClass} ${oddEvenClass} cursor-pointer transition-all hover:brightness-125" data-node-id="${node.id || ''}" title="${tooltipText.replace(/"/g, '&quot;')}">${phrase}</span>`;

    result = result.slice(0, startRawIdx) + wrapped + result.slice(endRawIdx);
  }

  return result;
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
