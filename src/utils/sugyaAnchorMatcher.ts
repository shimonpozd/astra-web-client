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

  // Build character index map between clean text (without nikud) and raw text (with nikud)
  const cleanToRawMap: number[] = [];
  let cleanText = '';
  for (let i = 0; i < rawText.length; i++) {
    const ch = rawText[i];
    if (!/[\u0591-\u05C7]/.test(ch)) {
      cleanToRawMap.push(i);
      cleanText += ch;
    }
  }

  const cleanStart = stripHebrewVowels(startAnchor).trim();
  if (!cleanStart) return null;

  const cleanStartIdx = cleanText.indexOf(cleanStart);
  if (cleanStartIdx === -1) return null;

  let cleanEndIdx = -1;
  const cleanEnd = endAnchor ? stripHebrewVowels(endAnchor).trim() : '';

  if (cleanEnd) {
    const lastIdx = cleanText.lastIndexOf(cleanEnd);
    if (lastIdx !== -1 && lastIdx >= cleanStartIdx) {
      cleanEndIdx = lastIdx + cleanEnd.length;
    }
  }

  if (cleanEndIdx === -1) {
    cleanEndIdx = cleanStartIdx + cleanStart.length;
  }

  // Trim trailing whitespace characters from cleanEndIdx
  while (cleanEndIdx > cleanStartIdx && /\s/.test(cleanText[cleanEndIdx - 1])) {
    cleanEndIdx--;
  }

  const rawStartIdx = cleanToRawMap[cleanStartIdx];
  let rawEndIdx = cleanToRawMap[Math.min(cleanEndIdx, cleanToRawMap.length - 1)];

  if (rawStartIdx === undefined) return null;

  if (cleanEndIdx >= cleanToRawMap.length || rawEndIdx === undefined) {
    rawEndIdx = rawText.length;
  }

  // Trim trailing raw text whitespace (spaces, newlines)
  while (rawEndIdx > rawStartIdx && /\s/.test(rawText[rawEndIdx - 1])) {
    rawEndIdx--;
  }

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

  // 1. Locate DOM element matching data-ref attribute or ref string
  const targetElement = 
    document.querySelector(`[data-ref="${CSS.escape(ref)}"]`) ||
    document.querySelector(`[data-ref="${ref}"]`);

  if (!targetElement) {
    console.warn(`[SugyaAnchorMatcher] Segment element not found for ref: ${ref}`);
    return;
  }

  // 2. Smooth scroll element into view centered
  targetElement.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });

  // 3. Remove old highlights from previous node selections
  const oldActive = document.querySelectorAll('.sugya-segment-pulse');
  oldActive.forEach((el) => {
    el.classList.remove(
      'sugya-segment-pulse',
      'sugya-pulse-active',
      'sugya-highlight-selected',
      'type-Statement',
      'type-Question',
      'type-Attack',
      'type-Defense',
      'type-Proof',
      'type-Answer'
    );
  });

  // 4. Apply non-destructive persistent background highlight class & pulse
  const typeClass = nodeType ? `type-${nodeType}` : 'type-Statement';
  targetElement.classList.add('sugya-segment-pulse', typeClass, 'sugya-pulse-active', 'sugya-highlight-selected');

  // 5. Try CSS Custom Highlight API if available & anchors provided for word-level precision
  if (startAnchor && 'Highlight' in window && 'highlights' in (window as any)) {
    try {
      const range = createPreciseAnchorRange(targetElement, startAnchor, endAnchor);
      if (range) {
        const highlight = new (window as any).Highlight(range);
        (CSS as any).highlights.set('sugya-anchor-highlight', highlight);
      }
    } catch (err) {
      console.warn('[SugyaAnchorMatcher] CSS Highlight API failed, using segment pulse fallback', err);
    }
  }
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
    el.classList.remove('sugya-segment-tag');
  });

  const rangesByType: Record<string, Range[]> = {
    Statement: [],
    Question: [],
    Attack: [],
    Defense: [],
    Proof: [],
    Answer: [],
  };

  for (const node of nodes) {
    if (!node.ref) continue;
    const targetElement =
      document.querySelector(`[data-ref="${CSS.escape(node.ref)}"]`) ||
      document.querySelector(`[data-ref="${node.ref}"]`);

    if (!targetElement) continue;

    const nodeType = node.type && rangesByType[node.type] ? node.type : 'Statement';
    targetElement.classList.add('sugya-segment-tag', `type-${nodeType}`);

    if (node.start_anchor) {
      try {
        const range = createPreciseAnchorRange(targetElement, node.start_anchor, node.end_anchor);
        if (range) {
          rangesByType[nodeType].push(range);
        }
      } catch (err) {
        // ignore
      }
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
 * Highlights segment on hover over Mind Map tree node
 */
export function highlightNodeHover(ref?: string, _nodeType?: string, isHovered: boolean = true) {
  if (!ref) return;
  const targetElement =
    document.querySelector(`[data-ref="${CSS.escape(ref)}"]`) ||
    document.querySelector(`[data-ref="${ref}"]`);

  if (!targetElement) return;

  if (isHovered) {
    targetElement.classList.add('sugya-node-hover-active');
  } else {
    targetElement.classList.remove('sugya-node-hover-active');
  }
}

/**
 * Highlights Mind Map tree node on hover over Talmud text segment in reader
 */
export function highlightMindMapNodeOnHover(ref?: string, isHovered: boolean = true) {
  if (!ref) return;

  try {
    const targetElements = document.querySelectorAll(`[data-sugya-node-ref="${CSS.escape(ref)}"]`);
    if (targetElements.length > 0) {
      targetElements.forEach((el) => {
        if (isHovered) {
          el.classList.add('sugya-tree-node-hover-active');
        } else {
          el.classList.remove('sugya-tree-node-hover-active');
        }
      });
      return;
    }
  } catch (e) {
    // fallback without CSS.escape
  }

  const fallbackElements = document.querySelectorAll(`[data-sugya-node-ref="${ref}"]`);
  fallbackElements.forEach((el) => {
    if (isHovered) {
      el.classList.add('sugya-tree-node-hover-active');
    } else {
      el.classList.remove('sugya-tree-node-hover-active');
    }
  });
}
