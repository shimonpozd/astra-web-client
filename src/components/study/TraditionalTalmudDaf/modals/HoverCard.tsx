import React from 'react';
import DOMPurify from 'dompurify';

interface HoverCardProps {
  hoverCard: {
    slug: string;
    type: 'sage' | 'concept';
    x: number;
    y: number;
    summary: string | null;
    label: string;
  } | null;
}

export const HoverCard: React.FC<HoverCardProps> = ({ hoverCard }) => {
  if (!hoverCard) return null;

  return (
    <div
      className="fixed z-[100] w-72 max-w-[90vw] -translate-x-1/2 -translate-y-full pb-2 transition-opacity duration-150 pointer-events-none"
      style={{ left: `${hoverCard.x}px`, top: `${hoverCard.y - 6}px` }}
    >
      <div className="rounded-xl border border-border/80 bg-popover p-3 text-popover-foreground shadow-2xl backdrop-blur-md space-y-1.5 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {hoverCard.type}
          </span>
        </div>

        {hoverCard.label && (
          <div className="text-base font-semibold leading-tight text-foreground">
            {hoverCard.label}
          </div>
        )}

        {hoverCard.summary ? (
          <div
            className="prose prose-sm max-w-none text-foreground prose-headings:text-foreground prose-p:leading-snug prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(hoverCard.summary) }}
          />
        ) : null}
      </div>
    </div>
  );
};
