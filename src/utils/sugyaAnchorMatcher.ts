import { isRefOverlap } from './refUtils';

/**
 * Sugya Anchor Matcher & Smooth Scroll Helper
 * Locates segment elements in DOM by Sefaria ref, scrolls cleanly,
 * and highlights start_anchor to end_anchor range with nikud tolerance.
 */

// Helper to strip Hebrew vowels (nikud) and cantillation (taamim)
export function stripHebrewVowels(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\u0591-\u05C7]/g, '') // remove nikud & taamim
    .replace(/<[^>]+>/g, ' ')        // remove HTML tags
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Punctuation-tolerant substring index finder for Hebrew anchors
 */
export function findSubstringIndicesInRawText(
  rawText: string,
  searchAnchor: string
): { startIndex: number; endIndex: number } {
  if (!rawText || !searchAnchor) return { startIndex: -1, endIndex: -1 };

  const cleanRaw = stripHebrewVowels(rawText);
  const cleanSearch = stripHebrewVowels(searchAnchor);

  let idx = cleanRaw.indexOf(cleanSearch);
  if (idx !== -1) {
    return { startIndex: idx, endIndex: idx + cleanSearch.length };
  }

  // Normalize punctuation differences (commas, quotes, colons)
  const cleanRawLetters = cleanRaw.replace(/[^\u05D0-\u05EA0-9]/g, ' ');
  const cleanSearchLetters = cleanSearch.replace(/[^\u05D0-\u05EA0-9]/g, ' ');

  const searchWords = cleanSearchLetters.trim().split(/\s+/).filter(Boolean);
  if (searchWords.length === 0) return { startIndex: -1, endIndex: -1 };

  const firstWordsPattern = searchWords.slice(0, Math.min(3, searchWords.length)).join('\\s+');
  try {
    const regex = new RegExp(firstWordsPattern, 'i');
    const match = regex.exec(cleanRawLetters);

    if (match) {
      return { startIndex: match.index, endIndex: match.index + match[0].length };
    }
  } catch (e) {
    // ignore regex parse errors
  }

  return { startIndex: -1, endIndex: -1 };
}

/**
 * Finds all DOM elements that match or overlap with the given Sefaria ref (supports single refs and ranges like Chullin 90b:18-20)
 */
export function getDOMTargetElementsForRef(ref?: string): Element[] {
  if (!ref) return [];

  try {
    const exactQuery = document.querySelectorAll(`[data-ref="${CSS.escape(ref)}"]`);
    if (exactQuery.length > 0) {
      return Array.from(exactQuery);
    }
  } catch (e) {
    // fallback if CSS.escape fails
  }

  const fallbackQuery = document.querySelectorAll(`[data-ref="${ref}"]`);
  if (fallbackQuery.length > 0) {
    return Array.from(fallbackQuery);
  }

  // Range match: check all elements with data-ref
  const matched: Element[] = [];
  const allRefElements = document.querySelectorAll('[data-ref]');
  allRefElements.forEach((el) => {
    const elRef = el.getAttribute('data-ref');
    if (elRef && isRefOverlap(elRef, ref)) {
      matched.push(el);
    }
  });

  return matched;
}

/**
 * Creates a DOM Range for startAnchor to endAnchor within targetElement,
 * accurately handling nikud/vowels and trimming trailing spaces/newlines to prevent underline artifacts.
 */
export function createPreciseAnchorRange(
  targetElement: Element,
  startAnchor: string,
  endAnchor?: string
): Range | null {
  const nodeMap: { node: Text; startInRaw: number; endInRaw: number }[] = [];
  const walker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT);
  let rawText = '';

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    const text = node.textContent || '';
    const startInRaw = rawText.length;
    rawText += text;
    const endInRaw = rawText.length;
    nodeMap.push({ node, startInRaw, endInRaw });
  }

  if (rawText.length === 0) return null;

  // 1. Build letter-to-raw map (only Hebrew letters & numbers)
  const letterToRawMap: number[] = [];
  let lettersOnlyText = '';
  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    if (/[\u05D0-\u05EA0-9]/.test(ch)) {
      letterToRawMap.push(i);
      lettersOnlyText += ch;
    }
  }

  if (lettersOnlyText.length === 0) return null;

  // 2. Clean start anchor to letters only
  const cleanStartLetters = (startAnchor || '').replace(/[^\u05D0-\u05EA0-9]/g, '');
  if (!cleanStartLetters) return null;

  let startLetterIdx = lettersOnlyText.indexOf(cleanStartLetters);
  if (startLetterIdx === -1) {
    const words = (startAnchor || '').replace(/[^\u05D0-\u05EA0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
    if (words.length > 0) {
      const shortStart = words.slice(0, Math.min(3, words.length)).join('');
      startLetterIdx = lettersOnlyText.indexOf(shortStart);
    }
  }

  if (startLetterIdx === -1) return null;

  // 3. Clean end anchor to letters only
  let endLetterIdx = -1;
  const cleanEndLetters = endAnchor ? endAnchor.replace(/[^\u05D0-\u05EA0-9]/g, '') : '';

  if (cleanEndLetters) {
    const lastIdx = lettersOnlyText.lastIndexOf(cleanEndLetters);
    if (lastIdx !== -1 && lastIdx >= startLetterIdx) {
      endLetterIdx = lastIdx + cleanEndLetters.length;
    } else {
      const endWords = endAnchor!.replace(/[^\u05D0-\u05EA0-9\s]/g, '').trim().split(/\s+/).filter(Boolean);
      if (endWords.length > 0) {
        const shortEnd = endWords.slice(Math.max(0, endWords.length - 3)).join('');
        const fIdx = lettersOnlyText.lastIndexOf(shortEnd);
        if (fIdx !== -1 && fIdx >= startLetterIdx) {
          endLetterIdx = fIdx + shortEnd.length;
        }
      }
    }
  }

  if (endLetterIdx === -1) {
    endLetterIdx = startLetterIdx + cleanStartLetters.length;
  }

  const rawStartIdx = letterToRawMap[startLetterIdx];
  const rawEndIdxChar = letterToRawMap[Math.min(endLetterIdx - 1, letterToRawMap.length - 1)];

  if (rawStartIdx === undefined || rawEndIdxChar === undefined) return null;

  const rawEndIdx = rawEndIdxChar + 1;

  if (rawStartIdx >= rawEndIdx) return null;

  // Find corresponding DOM Text nodes
  let startNodeInfo = nodeMap.find(m => rawStartIdx >= m.startInRaw && rawStartIdx < m.endInRaw);
  let endNodeInfo = nodeMap.find(m => rawEndIdx > m.startInRaw && rawEndIdx <= m.endInRaw);

  if (!startNodeInfo && nodeMap.length > 0) startNodeInfo = nodeMap[0];
  if (!endNodeInfo && nodeMap.length > 0) endNodeInfo = nodeMap[nodeMap.length - 1];

  if (!startNodeInfo || !endNodeInfo) return null;

  try {
    const range = document.createRange();
    range.setStart(startNodeInfo.node, Math.max(0, rawStartIdx - startNodeInfo.startInRaw));
    range.setEnd(endNodeInfo.node, Math.min((endNodeInfo.node.textContent || '').length, rawEndIdx - endNodeInfo.startInRaw));
    return range;
  } catch (err) {
    return null;
  }
}

export function scrollToAnchor(
  ref?: string,
  startAnchor?: string,
  endAnchor?: string,
  nodeType?: string
) {
  if (!ref) return;

  // 1. Locate DOM elements matching ref
  const targetElements = getDOMTargetElementsForRef(ref);

  if (targetElements.length === 0) {
    console.warn(`[SugyaAnchorMatcher] Segment element not found for ref: ${ref}`);
    return;
  }

  // 2. Smooth scroll first element into view centered
  targetElements[0].scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  // 3. Remove old highlights from previous node selections
  const oldActive = document.querySelectorAll('.sugya-segment-pulse, .sugya-container-active');
  oldActive.forEach((el) => {
    el.classList.remove(
      'sugya-segment-pulse',
      'sugya-pulse-active',
      'sugya-highlight-selected',
      'sugya-container-active',
      'type-Statement',
      'type-Question',
      'type-Attack',
      'type-Defense',
      'type-Proof',
      'type-Answer'
    );
  });

  const typeClass = nodeType ? `type-${nodeType}` : 'type-Statement';
  let phraseHighlighted = false;

  // 4. Try CSS Custom Highlight API if anchors provided for phrase-level precision
  if (startAnchor && 'Highlight' in window && 'highlights' in (window as any)) {
    try {
      const container = targetElements.length === 1 ? targetElements[0] : (targetElements[0].parentElement || targetElements[0]);
      const range = createPreciseAnchorRange(container, startAnchor, endAnchor);
      if (range) {
        const highlight = new (window as any).Highlight(range);
        (CSS as any).highlights.set('sugya-anchor-highlight', highlight);
        if (nodeType) {
          (CSS as any).highlights.set(`sugya-highlight-${nodeType}`, highlight);
        }
        phraseHighlighted = true;
      }
    } catch (err) {
      console.warn('[SugyaAnchorMatcher] CSS Highlight API failed for phrase', err);
    }
  }

  // 5. Apply container styling: if phrase was highlighted, only add subtle container border instead of full background pulse
  targetElements.forEach((el) => {
    if (phraseHighlighted) {
      el.classList.add('sugya-container-active', typeClass);
    } else {
      el.classList.add('sugya-segment-pulse', typeClass, 'sugya-pulse-active', 'sugya-highlight-selected');
    }
  });
}

// Active sugya state for real-time MutationObserver auto-highlighting
let activeSugyaNodes: Array<{ ref?: string; type?: string; start_anchor?: string; end_anchor?: string }> | null = null;
let activeHighlightsVisible: boolean = true;
let sugyaMutationObserver: MutationObserver | null = null;
let reapplyDebounceTimer: any = null;

function ensureSugyaMutationObserver() {
  if (sugyaMutationObserver || typeof window === 'undefined') return;

  sugyaMutationObserver = new MutationObserver((mutations) => {
    let hasNewNodes = false;
    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0) {
        hasNewNodes = true;
        break;
      }
    }

    if (hasNewNodes && activeSugyaNodes && activeHighlightsVisible) {
      clearTimeout(reapplyDebounceTimer);
      reapplyDebounceTimer = setTimeout(() => {
        _reapplySugyaHighlightsInternal();
      }, 120);
    }
  });

  const targetNode = document.querySelector('#talmud-reader-container') || document.body;
  sugyaMutationObserver.observe(targetNode, { childList: true, subtree: true });
}

function _reapplySugyaHighlightsInternal() {
  if (!activeSugyaNodes || !activeHighlightsVisible) return;
  
  // Re-run matching without resetting activeSugyaNodes
  const nodes = activeSugyaNodes;
  const TYPES = ['Statement', 'Question', 'Attack', 'Defense', 'Proof', 'Answer'];

  if ('Highlight' in window && 'highlights' in (window as any)) {
    for (const t of TYPES) {
      try {
        (CSS as any).highlights.delete(`sugya-highlight-${t}`);
      } catch (e) {
        // ignore
      }
    }
  }

  const oldTagged = document.querySelectorAll('.sugya-segment-tag');
  oldTagged.forEach((el) => {
    el.classList.remove('sugya-segment-tag', ...TYPES.map(t => `type-${t}`));
  });

  const rangesByType: Record<string, Range[]> = {
    Statement: [],
    Question: [],
    Attack: [],
    Defense: [],
    Proof: [],
    Answer: [],
  };

  const segmentTypesMap = new Map<Element, Set<string>>();

  for (const node of nodes) {
    if (!node.ref) continue;
    const targetElements = getDOMTargetElementsForRef(node.ref);

    if (targetElements.length === 0) continue;

    const nodeType = node.type && rangesByType[node.type] ? node.type : 'Statement';
    for (const el of targetElements) {
      if (!segmentTypesMap.has(el)) {
        segmentTypesMap.set(el, new Set());
      }
      segmentTypesMap.get(el)!.add(nodeType);
    }

    if (node.start_anchor) {
      try {
        const container = targetElements.length === 1 ? targetElements[0] : (targetElements[0].parentElement || targetElements[0]);
        const range = createPreciseAnchorRange(container, node.start_anchor, node.end_anchor);
        if (range) {
          rangesByType[nodeType].push(range);
        }
      } catch (err) {
        // ignore
      }
    }
  }

  for (const [el, types] of segmentTypesMap.entries()) {
    el.classList.add('sugya-segment-tag');
    if (types.size === 1) {
      const [singleType] = Array.from(types);
      el.classList.add(`type-${singleType}`);
    }
  }

  if ('Highlight' in window && 'highlights' in (window as any)) {
    for (const [t, ranges] of Object.entries(rangesByType)) {
      if (ranges.length > 0) {
        try {
          const highlight = new (window as any).Highlight(...ranges);
          (CSS as any).highlights.set(`sugya-highlight-${t}`, highlight);
        } catch (err) {
          // ignore
        }
      }
    }
  }
}

/**
 * Highlights all exact word/phrase ranges belonging to the calculated sugya map
 */
export function applyWholeSugyaHighlight(
  nodes?: Array<{ ref?: string; type?: string; start_anchor?: string; end_anchor?: string }>,
  isVisible: boolean = true
) {
  activeSugyaNodes = isVisible ? (nodes || null) : null;
  activeHighlightsVisible = isVisible;
  ensureSugyaMutationObserver();

  _reapplySugyaHighlightsInternal();
}

/**
 * Highlights segment / phrase on hover over Mind Map tree node
 */
export function highlightNodeHover(
  ref?: string,
  _nodeType?: string,
  isHovered: boolean = true,
  startAnchor?: string,
  endAnchor?: string
) {
  if (!ref) return;
  const targetElements = getDOMTargetElementsForRef(ref);

  if ('Highlight' in window && 'highlights' in (window as any)) {
    try {
      if (isHovered && startAnchor) {
        const container = targetElements.length === 1 ? targetElements[0] : (targetElements[0]?.parentElement || targetElements[0]);
        if (container) {
          const range = createPreciseAnchorRange(container, startAnchor, endAnchor);
          if (range) {
            const highlight = new (window as any).Highlight(range);
            (CSS as any).highlights.set('sugya-hover-highlight', highlight);
          }
        }
      } else {
        (CSS as any).highlights.delete('sugya-hover-highlight');
      }
    } catch (e) {
      // ignore
    }
  }

  targetElements.forEach((el) => {
    if (isHovered) {
      el.classList.add('sugya-node-hover-active');
    } else {
      el.classList.remove('sugya-node-hover-active');
    }
  });
}

/**
 * Highlights Mind Map tree node on hover over Talmud text segment in reader
 */
export function highlightMindMapNodeOnHover(ref?: string, isHovered: boolean = true) {
  if (!ref) return;

  const treeNodeElements = document.querySelectorAll('[data-sugya-node-ref]');
  treeNodeElements.forEach((el) => {
    const nodeRef = el.getAttribute('data-sugya-node-ref');
    if (nodeRef && isRefOverlap(ref, nodeRef)) {
      if (isHovered) {
        el.classList.add('sugya-tree-node-hover-active');
      } else {
        el.classList.remove('sugya-tree-node-hover-active');
      }
    }
  });
}
