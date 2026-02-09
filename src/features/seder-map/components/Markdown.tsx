import { useMemo } from 'react';
import DOMPurify from 'dompurify';
import { marked } from 'marked';

type MarkdownProps = {
  content: string;
  className?: string;
  dir?: 'rtl' | 'ltr' | 'auto';
};

marked.setOptions({
  gfm: true,
  breaks: true,
});

export default function Markdown({ content, className, dir = 'auto' }: MarkdownProps) {
  const html = useMemo(() => {
    const raw = marked.parse(content || '') as string;
    return DOMPurify.sanitize(raw, {
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|node):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
    });
  }, [content]);

  return (
    <div
      className={className}
      dir={dir}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
