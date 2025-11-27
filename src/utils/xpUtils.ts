export function calcTextXp(text: string): number {
  const clean = text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  if (!clean.length) return 0;
  const scale = Math.ceil(clean.length / 220);
  return Math.min(25, 3 + Math.max(scale, 0));
}

export function docToPlainText(doc: any): string {
  if (!doc || typeof doc !== 'object') return '';
  const blocks = Array.isArray(doc.blocks) ? doc.blocks : [];
  const parts: string[] = [];
  blocks.forEach((block: any) => {
    if (block?.text) parts.push(String(block.text));
    if (block?.he) parts.push(String(block.he));
    if (block?.ru) parts.push(String(block.ru));
    if (block?.en) parts.push(String(block.en));
    if (Array.isArray(block?.items)) {
      parts.push(block.items.map((i: any) => (typeof i === 'string' ? i : '')).join(' '));
    }
  });
  return parts.join(' ');
}
