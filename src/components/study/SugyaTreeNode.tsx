import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Bookmark } from 'lucide-react';
import { SugyaNode, SugyaNodeType } from '../../services/sugyaApi';
import { highlightNodeHover, scrollToAnchor } from '../../utils/sugyaAnchorMatcher';
import { cn } from '../../lib/utils';

export interface TreeHierarchyNode extends SugyaNode {
  children: TreeHierarchyNode[];
}

interface SugyaTreeNodeProps {
  node: TreeHierarchyNode;
  onNodeClick: (node: SugyaNode) => void;
  defaultExpanded?: boolean;
}

const TAXONOMY_CONFIG: Record<
  SugyaNodeType | string, 
  { label: string; icon: string; badgeClass: string; borderClass: string }
> = {
  Statement: {
    label: 'Statement',
    icon: '📌',
    badgeClass: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
    borderClass: 'border-l-blue-500',
  },
  Question: {
    label: 'Question',
    icon: '❓',
    badgeClass: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
    borderClass: 'border-l-purple-500',
  },
  Attack: {
    label: 'Attack',
    icon: '⚔️',
    badgeClass: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
    borderClass: 'border-l-red-500',
  },
  Defense: {
    label: 'Defense',
    icon: '🛡️',
    badgeClass: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
    borderClass: 'border-l-emerald-500',
  },
  Proof: {
    label: 'Proof',
    icon: '🧾',
    badgeClass: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30',
    borderClass: 'border-l-sky-500',
  },
  Answer: {
    label: 'Answer',
    icon: '💡',
    badgeClass: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
    borderClass: 'border-l-amber-500',
  },
};

export const SugyaTreeNodeItem: React.FC<SugyaTreeNodeProps> = ({
  node,
  onNodeClick,
  defaultExpanded = true,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;

  const config = TAXONOMY_CONFIG[node.type] || TAXONOMY_CONFIG.Statement;

  return (
    <div className="flex flex-col space-y-1 my-1">
      <div
        data-sugya-node-ref={node.ref}
        className={cn(
          "group flex items-start gap-2 p-2 rounded-lg border border-border/40 bg-card/60 hover:bg-accent/40 transition-all cursor-pointer select-none",
          config.borderClass,
          "border-l-4"
        )}
        onClick={() => onNodeClick(node)}
        onMouseEnter={() => highlightNodeHover(node.ref, node.type, true)}
        onMouseLeave={() => highlightNodeHover(node.ref, node.type, false)}
      >
        {/* Expand / Collapse toggle */}
        {hasChildren ? (
          <button
            type="button"
            className="p-0.5 rounded hover:bg-muted/80 text-muted-foreground mt-0.5"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" />
            )}
          </button>
        ) : (
          <span className="w-4 h-4" />
        )}

        <div className="flex-1 min-w-0 flex flex-col gap-1">
          <div className="flex items-center gap-2 flex-wrap">
            {/* Taxonomy Badge */}
            <span
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border",
                config.badgeClass
              )}
            >
              <span>{config.icon}</span>
              <span>{config.label}</span>
            </span>

            {/* Sefaria Ref */}
            {node.ref && (
              <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                <Bookmark className="w-2.5 h-2.5 opacity-60" />
                {node.ref}
              </span>
            )}
          </div>

          {/* Node Title (Main Russian Explanation) */}
          <div className="text-[13px] sm:text-sm font-semibold leading-snug text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {node.title}
          </div>
        </div>
      </div>

      {/* Nested Children Tree */}
      {hasChildren && isExpanded && (
        <div className="pl-4 border-l-2 border-border/30 ml-2 space-y-1">
          {node.children.map((childNode) => (
            <SugyaTreeNodeItem
              key={childNode.id}
              node={childNode}
              onNodeClick={onNodeClick}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
};
