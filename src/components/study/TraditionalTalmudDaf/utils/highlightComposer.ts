import { escapeAttr } from './highlightMatching';

export interface HighlightRange {
  start: number; // clean text character start index
  end: number;   // clean text character end index
  layer: 'dh' | 'sage' | 'concept' | 'sugya';
  classes: string[];
  attributes?: Record<string, string>;
}

export interface ASTNode {
  start: number;
  end: number;
  layer: 'root' | 'sugya' | 'dh' | 'sage' | 'concept';
  classes: string[];
  attributes?: Record<string, string>;
  children: ASTNode[];
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

  // Sentinel value for the end of text
  cleanToRawStart.push(rawText.length);

  return { cleanText, cleanToRawStart };
}

/**
 * Inserts a child range into an AST node tree.
 * If range spans across existing child boundaries of node, splits it cleanly.
 */
function insertRangeIntoAST(parent: ASTNode, range: HighlightRange) {
  const rStart = Math.max(parent.start, range.start);
  const rEnd = Math.min(parent.end, range.end);

  if (rStart >= rEnd) return;

  if (parent.children.length === 0) {
    parent.children.push({
      start: rStart,
      end: rEnd,
      layer: range.layer,
      classes: range.classes,
      attributes: range.attributes,
      children: [],
    });
    return;
  }

  const overlappingChildren = parent.children.filter(
    (child) => Math.max(child.start, rStart) < Math.min(child.end, rEnd)
  );

  if (overlappingChildren.length === 0) {
    parent.children.push({
      start: rStart,
      end: rEnd,
      layer: range.layer,
      classes: range.classes,
      attributes: range.attributes,
      children: [],
    });
    parent.children.sort((a, b) => a.start - b.start);
    return;
  }

  for (const child of overlappingChildren) {
    const oStart = Math.max(child.start, rStart);
    const oEnd = Math.min(child.end, rEnd);
    if (oStart < oEnd) {
      insertRangeIntoAST(child, {
        ...range,
        start: oStart,
        end: oEnd,
      });
    }
  }

  let curr = rStart;
  const sortedChildren = [...parent.children].sort((a, b) => a.start - b.start);

  for (const child of sortedChildren) {
    if (child.start > curr && rEnd > curr) {
      const gapEnd = Math.min(child.start, rEnd);
      if (curr < gapEnd) {
        parent.children.push({
          start: curr,
          end: gapEnd,
          layer: range.layer,
          classes: range.classes,
          attributes: range.attributes,
          children: [],
        });
      }
    }
    curr = Math.max(curr, child.end);
  }

  if (curr < rEnd) {
    parent.children.push({
      start: curr,
      end: rEnd,
      layer: range.layer,
      classes: range.classes,
      attributes: range.attributes,
      children: [],
    });
  }

  parent.children.sort((a, b) => a.start - b.start);
}

/**
 * Builds a hierarchical AST tree where Sugya spans are continuous outer wrappers,
 * and DH/Sages/Concepts spans are cleanly nested inner children.
 */
export function buildHighlightTree(
  cleanLength: number,
  ranges: HighlightRange[]
): ASTNode {
  const root: ASTNode = {
    start: 0,
    end: cleanLength,
    layer: 'root',
    classes: [],
    children: [],
  };

  const sugyaRanges = ranges.filter((r) => r.layer === 'sugya');
  const dhRanges = ranges.filter((r) => r.layer === 'dh');
  const entityRanges = ranges.filter((r) => r.layer === 'sage' || r.layer === 'concept');

  // Level 1: Outer Sugya containers
  const sortedSugya = sugyaRanges
    .filter((r) => r.start < r.end && r.start < cleanLength)
    .sort((a, b) => a.start - b.start);

  for (const s of sortedSugya) {
    root.children.push({
      start: Math.max(0, s.start),
      end: Math.min(cleanLength, s.end),
      layer: 'sugya',
      classes: s.classes,
      attributes: s.attributes,
      children: [],
    });
  }

  // Level 2: Middle DH containers (Rashi & Tosafot)
  for (const dh of dhRanges) {
    insertRangeIntoAST(root, dh);
  }

  // Level 3: Inner Entity containers (Sages & Concepts)
  for (const ent of entityRanges) {
    insertRangeIntoAST(root, ent);
  }

  return root;
}

/**
 * Renders an ASTNode tree recursively into valid, non-corrupting HTML with unbroken Sugya outer spans.
 */
function renderASTNode(
  node: ASTNode,
  rawText: string,
  cleanToRawStart: number[]
): string {
  let contentHtml = '';
  let currClean = node.start;

  const sortedChildren = [...node.children].sort((a, b) => a.start - b.start);

  for (const child of sortedChildren) {
    if (child.start > currClean) {
      const rStart = cleanToRawStart[currClean] ?? 0;
      const rEnd = cleanToRawStart[child.start] ?? rStart;
      contentHtml += rawText.slice(rStart, rEnd);
    }

    contentHtml += renderASTNode(child, rawText, cleanToRawStart);
    currClean = Math.max(currClean, child.end);
  }

  if (currClean < node.end) {
    const rStart = cleanToRawStart[currClean] ?? 0;
    const rEnd = cleanToRawStart[node.end] ?? rStart;
    contentHtml += rawText.slice(rStart, rEnd);
  }

  if (node.layer === 'root') {
    return contentHtml;
  }

  const mergedClasses = (node.classes || []).join(' ');
  const attrStrings = Object.entries(node.attributes || {}).map(
    ([k, v]) => `${k}="${escapeAttr(v)}"`
  );
  const attrPart = attrStrings.length > 0 ? ' ' + attrStrings.join(' ') : '';

  return `<span class="${mergedClasses}"${attrPart}>${contentHtml}</span>`;
}

/**
 * Hierarchical HTML Highlight Composer:
 * Wraps Sugya phrases in continuous unbroken outer <span> containers,
 * with Rashi/Tosafot and Sages/Concepts nested cleanly inside.
 */
export function compositeTextWithHighlights(rawText: string, ranges: HighlightRange[]): string {
  if (!rawText) return '';
  if (!ranges || ranges.length === 0) return rawText;

  const { cleanText, cleanToRawStart } = buildCleanToRawMap(rawText);
  if (cleanText.length === 0 || cleanToRawStart.length === 0) return rawText;

  const validRanges = ranges
    .filter((r) => r && r.start >= 0 && r.end > r.start && r.start < cleanText.length)
    .map((r) => ({
      ...r,
      start: Math.max(0, r.start),
      end: Math.min(cleanText.length, r.end),
    }));

  if (validRanges.length === 0) return rawText;

  const astRoot = buildHighlightTree(cleanText.length, validRanges);
  return renderASTNode(astRoot, rawText, cleanToRawStart);
}
