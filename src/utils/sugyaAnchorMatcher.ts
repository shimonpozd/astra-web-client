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
      const textContent = targetElement.textContent || '';
      const cleanContent = stripHebrewVowels(textContent);
      const cleanStart = stripHebrewVowels(startAnchor);
      const cleanEnd = endAnchor ? stripHebrewVowels(endAnchor) : cleanStart;

      const startIndex = cleanContent.indexOf(cleanStart);
      let endIndex = cleanEnd ? cleanContent.lastIndexOf(cleanEnd) : -1;

      if (startIndex !== -1) {
        if (endIndex === -1 || endIndex < startIndex) {
          endIndex = startIndex + cleanStart.length;
        } else {
          endIndex += cleanEnd.length;
        }

        // Find text nodes to build Range
        const treeWalker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT);
        let currentPos = 0;
        let startNode: Node | null = null;
        let startOffset = 0;
        let endNode: Node | null = null;
        let endOffset = 0;

        while (treeWalker.nextNode()) {
          const node = treeWalker.currentNode;
          const nodeLen = (node.textContent || '').length;

          if (!startNode && currentPos + nodeLen >= startIndex) {
            startNode = node;
            startOffset = Math.max(0, startIndex - currentPos);
          }
          if (startNode && currentPos + nodeLen >= endIndex) {
            endNode = node;
            endOffset = Math.min(nodeLen, endIndex - currentPos);
            break;
          }
          currentPos += nodeLen;
        }

        if (startNode && endNode) {
          const range = document.createRange();
          range.setStart(startNode, startOffset);
          range.setEnd(endNode, endOffset);

          const highlight = new (window as any).Highlight(range);
          (CSS as any).highlights.set('sugya-anchor-highlight', highlight);
        }
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
  const isVisible = activeHighlightsVisible;
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
    targetElement.classList.add('sugya-segment-tag');

    if (node.start_anchor) {
      try {
        const textContent = targetElement.textContent || '';
        const startRes = findSubstringIndicesInRawText(textContent, node.start_anchor);
        const endRes = node.end_anchor
          ? findSubstringIndicesInRawText(textContent, node.end_anchor)
          : startRes;

        let startIndex = startRes.startIndex;
        let endIndex = endRes.endIndex !== -1 ? endRes.endIndex : (startIndex !== -1 ? startIndex + stripHebrewVowels(node.start_anchor).length : -1);

        if (startIndex !== -1) {
          if (endIndex === -1 || endIndex < startIndex) {
            endIndex = startIndex + stripHebrewVowels(node.start_anchor).length;
          }

          const treeWalker = document.createTreeWalker(targetElement, NodeFilter.SHOW_TEXT);
          let currentPos = 0;
          let startNode: Node | null = null;
          let startOffset = 0;
          let endNode: Node | null = null;
          let endOffset = 0;

          while (treeWalker.nextNode()) {
            const textNode = treeWalker.currentNode;
            const nodeLen = (textNode.textContent || '').length;

            if (!startNode && currentPos + nodeLen >= startIndex) {
              startNode = textNode;
              startOffset = Math.max(0, startIndex - currentPos);
            }
            if (startNode && currentPos + nodeLen >= endIndex) {
              endNode = textNode;
              endOffset = Math.min(nodeLen, endIndex - currentPos);
              break;
            }
            currentPos += nodeLen;
          }

          if (startNode && endNode) {
            const range = document.createRange();
            range.setStart(startNode, startOffset);
            range.setEnd(endNode, endOffset);
            rangesByType[nodeType].push(range);
          }
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
export function highlightNodeHover(ref?: string, nodeType?: string, isHovered: boolean = true) {
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
