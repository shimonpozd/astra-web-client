import type { DocV1, Block } from '../../types/text';

/**
 * Converts legacy XML tags in text to standard Markdown link schemes.
 * e.g. <ref tref="Chullin 116a:5">Хулин 116а</ref> -> [Хулин 116а](ref:Chullin_116a:5)
 */
export function convertXmlTagsToMarkdown(text: string): string {
  if (!text || !text.includes('<')) return text;

  let result = text;

  // 1. <ref tref="...">content</ref> or <ref>content</ref>
  result = result.replace(
    /<ref(?:\s+tref=["']([^"']+)["'])?(?:\s*\/>|>([\s\S]*?)<\/ref>)/gi,
    (_, trefAttr, inner) => {
      const content = (inner || trefAttr || '').trim();
      const targetRef = (trefAttr || inner || '').trim().replace(/\s+/g, '_');
      return `[${content}](ref:${targetRef})`;
    }
  );

  // 2. <persn>content</persn> or <person>content</person>
  result = result.replace(
    /<(?:persn|person)>([\s\S]*?)<\/(?:persn|person)>/gi,
    (_, inner) => `[${inner.trim()}](person:${inner.trim().replace(/\s+/g, '_')})`
  );

  // 3. <concept>content</concept>
  result = result.replace(
    /<concept>([\s\S]*?)<\/concept>/gi,
    (_, inner) => `[${inner.trim()}](concept:${inner.trim().replace(/\s+/g, '_')})`
  );

  // 4. <term>content</term>
  result = result.replace(
    /<term>([\s\S]*?)<\/term>/gi,
    (_, inner) => `[${inner.trim()}](term:${inner.trim().replace(/\s+/g, '_')})`
  );

  return result;
}

/**
 * Converts a legacy Block into Markdown text.
 */
export function convertBlockToMarkdown(rawBlock: Block | any): string {
  if (!rawBlock || typeof rawBlock !== 'object') return '';

  const block = rawBlock.data ? { ...rawBlock, ...rawBlock.data } : rawBlock;

  switch (block.type) {
    case 'heading': {
      const level = Math.min(6, Math.max(1, Number(block.level) || 2));
      const prefix = '#'.repeat(level);
      return `${prefix} ${convertXmlTagsToMarkdown(block.text || '')}`;
    }

    case 'paragraph': {
      return convertXmlTagsToMarkdown(block.text || '');
    }

    case 'quote': {
      const quoteText = convertXmlTagsToMarkdown(block.text || '');
      const lines = quoteText.split('\n').map((l: string) => `> ${l}`).join('\n');
      if (block.source) {
        return `${lines}\n>\n> — *${block.source}*`;
      }
      return lines;
    }

    case 'list': {
      if (!Array.isArray(block.items)) return '';
      return block.items
        .map((item: string, idx: number) => {
          const itemText = convertXmlTagsToMarkdown(String(item || ''));
          return block.ordered ? `${idx + 1}. ${itemText}` : `- ${itemText}`;
        })
        .join('\n');
    }

    case 'term': {
      const term = block.he || block.text || block.term || '';
      const def = block.ru || block.definition || block.en || '';
      if (!term && !def) return '';
      return `> [!NOTE]\n> **${term}**\n> ${def}`;
    }

    case 'callout': {
      const variant = (block.variant || 'info').toUpperCase();
      const alertType = variant === 'WARN' ? 'WARNING' : variant === 'DANGER' ? 'CAUTION' : 'NOTE';
      const text = convertXmlTagsToMarkdown(block.text || '');
      return `> [!${alertType}]\n> ${text.split('\n').join('\n> ')}`;
    }

    case 'code': {
      const lang = block.lang || '';
      const code = block.code || '';
      return `\`\`\`${lang}\n${code}\n\`\`\``;
    }

    case 'hr': {
      return '---';
    }

    case 'table': {
      const headers: string[] = block.headers || [];
      const rows: string[][] = block.rows || [];
      if (!headers.length && !rows.length) return '';

      const lines: string[] = [];
      if (headers.length) {
        lines.push(`| ${headers.join(' | ')} |`);
        lines.push(`| ${headers.map(() => '---').join(' | ')} |`);
      }
      for (const row of rows) {
        lines.push(`| ${row.join(' | ')} |`);
      }
      return lines.join('\n');
    }

    default:
      return block.text ? convertXmlTagsToMarkdown(String(block.text)) : '';
  }
}

/**
 * Converts legacy DocV1 or arbitrary message content into standard Markdown.
 */
export function convertDocV1ToMarkdown(doc: unknown): string {
  if (!doc) return '';

  if (typeof doc === 'string') {
    const trimmed = doc.trim();
    // Try to parse if it's a JSON string
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return convertDocV1ToMarkdown(parsed);
      } catch {
        return convertXmlTagsToMarkdown(doc);
      }
    }
    return convertXmlTagsToMarkdown(doc);
  }

  if (typeof doc === 'object' && doc !== null) {
    const obj: any = doc;
    const blocks: Block[] = obj.blocks || (obj.doc && obj.doc.content) || obj.content;

    if (Array.isArray(blocks)) {
      return blocks
        .map(convertBlockToMarkdown)
        .filter(Boolean)
        .join('\n\n');
    }

    // Study format with explanation/paragraphs
    if (obj.explanation && Array.isArray(obj.explanation.paragraphs)) {
      return obj.explanation.paragraphs
        .map((p: string) => convertXmlTagsToMarkdown(p))
        .join('\n\n');
    }

    return JSON.stringify(doc, null, 2);
  }

  return String(doc);
}
