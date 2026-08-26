import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkGithubAlerts from 'remark-github-alerts';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { rehypeHebrewBidi } from '../../lib/markdown/rehypeHebrewBidi';
import { convertDocV1ToMarkdown } from '../../lib/markdown/legacyConverter';
import { getTextDirection } from '../../utils/hebrewUtils';
import { cn } from '../../lib/utils';

export interface MarkdownRendererProps {
  content: unknown;
  className?: string;
}

const customComponents: React.ComponentProps<typeof ReactMarkdown>['components'] = {
  // 1. Custom Links / Badge Interceptors
  a: ({ href, children, ...props }) => {
    if (!href) {
      return <span>{children}</span>;
    }

    // Reference badge: [label](ref:Berakhot_2a:1)
    if (href.startsWith('ref:')) {
      const targetRef = href.replace(/^ref:/, '').replace(/_/g, ' ');
      return (
        <span
          onClick={(e) => {
            e.stopPropagation();
            if (targetRef) {
              window.dispatchEvent(new CustomEvent('study-navigate-ref', { detail: targetRef }));
            }
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs font-mono font-semibold cursor-pointer hover:bg-amber-500/20 transition-all select-none"
          title={`Перейти к: ${targetRef}`}
          role="button"
          tabIndex={0}
        >
          📖 {children}
        </span>
      );
    }

    // Person badge: [label](person:Akiva)
    if (href.startsWith('person:')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-300 border border-purple-500/30 text-xs font-semibold select-none">
          👤 {children}
        </span>
      );
    }

    // Concept badge: [label](concept:Shmita)
    if (href.startsWith('concept:')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300 border border-blue-500/30 text-xs font-semibold select-none">
          💡 {children}
        </span>
      );
    }

    // Term badge: [label](term:Halakha)
    if (href.startsWith('term:')) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 my-0.5 mx-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30 text-xs font-semibold select-none">
          🏷️ {children}
        </span>
      );
    }

    // Standard safe external links
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sky-400 underline-offset-2 hover:underline focus:underline font-medium"
        {...props}
      >
        {children}
      </a>
    );
  },

  // 2. Syntax-highlighted Code Blocks & Inline Code
  code: ({ inline, className, children, ...props }: any) => {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');

    if (!inline && match) {
      return (
        <div className="rounded-xl overflow-hidden my-3 border border-border/50 shadow-sm">
          <div className="bg-muted/80 px-3 py-1 text-xs text-muted-foreground font-mono flex justify-between items-center border-b border-border/30">
            <span>{match[1]}</span>
          </div>
          <SyntaxHighlighter
            style={vscDarkPlus as any}
            language={match[1]}
            PreTag="div"
            customStyle={{
              margin: 0,
              padding: '1rem',
              fontSize: '0.875rem',
              lineHeight: '1.6',
              background: 'transparent',
            }}
            {...props}
          >
            {codeString}
          </SyntaxHighlighter>
        </div>
      );
    }

    if (!inline && codeString.includes('\n')) {
      return (
        <pre className="rounded-xl p-4 overflow-auto my-3 border border-border/40 bg-muted/40 text-xs font-mono">
          <code {...props}>{codeString}</code>
        </pre>
      );
    }

    return (
      <code className="bg-muted/80 text-foreground px-1.5 py-0.5 rounded text-[0.9em] font-mono border border-border/20" dir="ltr" {...props}>
        {children}
      </code>
    );
  },

  // 3. Tables with responsive container
  table: ({ children, ...props }) => (
    <div className="overflow-x-auto my-4 rounded-xl border border-border">
      <table className="w-full border-collapse text-sm" {...props}>
        {children}
      </table>
    </div>
  ),

  th: ({ children, ...props }) => (
    <th className="border-b border-border bg-muted/50 px-4 py-2.5 text-left font-semibold text-foreground text-xs uppercase tracking-wider" {...props}>
      {children}
    </th>
  ),

  td: ({ children, ...props }) => (
    <td className="border-b border-border/40 px-4 py-2 text-foreground/90 text-sm" {...props}>
      {children}
    </td>
  ),

  // 4. Headings
  h1: ({ children, ...props }) => (
    <h1 className="text-xl font-bold mt-6 mb-3 pb-2 border-b border-border/40 text-primary font-serif" {...props}>
      {children}
    </h1>
  ),
  h2: ({ children, ...props }) => (
    <h2 className="text-lg font-semibold mt-5 mb-2.5 text-foreground/95" {...props}>
      {children}
    </h2>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="text-base font-semibold mt-4 mb-2 text-amber-600 dark:text-amber-400" {...props}>
      {children}
    </h3>
  ),
  h4: ({ children, ...props }) => (
    <h4 className="text-sm font-semibold mt-3 mb-1.5 text-muted-foreground" {...props}>
      {children}
    </h4>
  ),

  // 5. Paragraphs with BiDi direction awareness
  p: ({ children, ...props }) => {
    const textContent = typeof children === 'string' ? children : '';
    const dir = textContent ? getTextDirection(textContent) : undefined;
    return (
      <p className="my-2.5 text-sm leading-relaxed text-foreground" dir={dir} {...props}>
        {children}
      </p>
    );
  },

  // 6. Blockquotes
  blockquote: ({ children, ...props }) => (
    <blockquote className="my-3 pl-4 border-l-4 border-primary/40 bg-muted/20 py-2 pr-3 rounded-r-md text-sm italic text-foreground/90" {...props}>
      {children}
    </blockquote>
  ),

  // 7. Lists
  ul: ({ children, ...props }) => (
    <ul className="my-3 space-y-1.5 list-disc list-inside text-sm leading-relaxed text-foreground/90" {...props}>
      {children}
    </ul>
  ),
  ol: ({ children, ...props }) => (
    <ol className="my-3 space-y-1.5 list-decimal list-inside text-sm leading-relaxed text-foreground/90" {...props}>
      {children}
    </ol>
  ),
  li: ({ children, ...props }) => (
    <li className="pl-1 text-foreground/90 leading-relaxed" {...props}>
      {children}
    </li>
  ),

  // 8. Horizontal line
  hr: () => <hr className="my-6 border-t border-border/40" />,
};

export function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  // Convert any legacy DocV1 structures or JSON strings to pure Markdown
  const markdown = useMemo(() => {
    return convertDocV1ToMarkdown(content);
  }, [content]);

  return (
    <div className={cn('doc', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkGithubAlerts]}
        rehypePlugins={[rehypeHebrewBidi]}
        components={customComponents}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
