import { visit } from 'unist-util-visit';

const HEBREW_REGEX = /([\u0590-\u05FF\uFB1D-\uFB4F]+(?:[\s\u05BE]+[\u0590-\u05FF\uFB1D-\uFB4F]+)*)/g;

/**
 * Rehype plugin for isolating Hebrew runs inside mixed text with <bdi dir="rtl">
 */
export function rehypeHebrewBidi() {
  return (tree: any) => {
    visit(tree, 'element', (node: any) => {
      // Avoid modifying code, pre or already isolated bdi tags
      if (node.tagName === 'code' || node.tagName === 'pre' || node.tagName === 'bdi') {
        return;
      }

      if (!Array.isArray(node.children)) return;

      const newChildren: any[] = [];
      let modified = false;

      for (const child of node.children) {
        if (child.type === 'text' && typeof child.value === 'string' && /[\u0590-\u05FF]/.test(child.value)) {
          const text = child.value;
          let lastIndex = 0;
          let match: RegExpExecArray | null;

          HEBREW_REGEX.lastIndex = 0;
          while ((match = HEBREW_REGEX.exec(text)) !== null) {
            modified = true;
            const before = text.slice(lastIndex, match.index);
            if (before) {
              newChildren.push({ type: 'text', value: before });
            }

            newChildren.push({
              type: 'element',
              tagName: 'bdi',
              properties: {
                dir: 'rtl',
                className: ['font-hebrew', 'text-[1.05em]', 'font-semibold', 'text-foreground', 'tracking-wide']
              },
              children: [{ type: 'text', value: match[1] }]
            });

            lastIndex = match.index + match[0].length;
          }

          if (lastIndex < text.length) {
            newChildren.push({ type: 'text', value: text.slice(lastIndex) });
          }
        } else {
          newChildren.push(child);
        }
      }

      if (modified) {
        node.children = newChildren;
      }
    });
  };
}
