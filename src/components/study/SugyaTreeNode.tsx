import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Bookmark, User, CornerDownRight } from 'lucide-react';
import { SugyaNode, SugyaNodeType } from '../../services/sugyaApi';
import { highlightNodeHover, highlightMindMapNodeOnHover } from '../../utils/sugyaAnchorMatcher';
import { isRefOverlap } from '../../utils/refUtils';
import { cn } from '../../lib/utils';

export interface TreeHierarchyNode extends SugyaNode {
  children: TreeHierarchyNode[];
}

interface SugyaTreeNodeProps {
  node: TreeHierarchyNode;
  onNodeClick: (node: SugyaNode) => void;
  defaultExpanded?: boolean;
  currentRef?: string;
}

const TAXONOMY_CONFIG: Record<
  SugyaNodeType | string, 
  { label: string; icon: string; badgeClass: string; borderClass: string; bgCardClass: string }
> = {
  Statement: {
    label: 'Statement',
    icon: '📌',
    badgeClass: 'bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/40',
    borderClass: 'border-l-blue-500',
    bgCardClass: 'bg-blue-500/10 border-blue-500/30 dark:bg-blue-950/25',
  },
  Question: {
    label: 'Question',
    icon: '❓',
    badgeClass: 'bg-purple-500/20 text-purple-700 dark:text-purple-300 border-purple-500/40',
    borderClass: 'border-l-purple-500',
    bgCardClass: 'bg-purple-500/10 border-purple-500/30 dark:bg-purple-950/25',
  },
  Attack: {
    label: 'Attack',
    icon: '⚔️',
    badgeClass: 'bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40',
    borderClass: 'border-l-red-500',
    bgCardClass: 'bg-red-500/10 border-red-500/30 dark:bg-red-950/25',
  },
  Defense: {
    label: 'Defense',
    icon: '🛡️',
    badgeClass: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40',
    borderClass: 'border-l-emerald-500',
    bgCardClass: 'bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/25',
  },
  Proof: {
    label: 'Proof',
    icon: '🧾',
    badgeClass: 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border-sky-500/40',
    borderClass: 'border-l-sky-500',
    bgCardClass: 'bg-sky-500/10 border-sky-500/30 dark:bg-sky-950/25',
  },
  Answer: {
    label: 'Answer',
    icon: '💡',
    badgeClass: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/40',
    borderClass: 'border-l-amber-500',
    bgCardClass: 'bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/25',
  },
};

export const SugyaTreeNodeItem: React.FC<SugyaTreeNodeProps> = ({
  node,
  onNodeClick,
  defaultExpanded = true,
  currentRef,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;

  const config = TAXONOMY_CONFIG[node.type] || TAXONOMY_CONFIG.Statement;
  const isRefMatched = Boolean(currentRef && node.ref && isRefOverlap(currentRef, node.ref));

  return (
    <div className="flex flex-col space-y-1 my-1">
      <div
        data-sugya-node-id={node.id}
        data-node-type={node.type}
        data-sugya-node-ref={node.ref}
        data-is-active-ref={isRefMatched ? "true" : "false"}
        id={`sugya-tree-node-${node.id}`}
        className={cn(
          "group flex items-start gap-2 p-2 rounded-lg border transition-all cursor-pointer select-none border-l-4",
          config.borderClass,
          config.bgCardClass,
          currentRef
            ? (isRefMatched
                ? "opacity-100 shadow-md font-semibold ring-1 ring-amber-500/40"
                : "opacity-45 grayscale-[15%] hover:opacity-90 hover:grayscale-0")
            : "opacity-100 hover:bg-accent/40"
        )}
        onClick={() => onNodeClick(node)}
        onMouseEnter={() => {
          highlightNodeHover(String(node.id), String(node.type), true);
          highlightMindMapNodeOnHover(String(node.id), String(node.type), true);
        }}
        onMouseLeave={() => {
          highlightNodeHover(String(node.id), String(node.type), false);
          highlightMindMapNodeOnHover(String(node.id), String(node.type), false);
        }}
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

            {/* Speaker Badge */}
            {node.speaker && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/25">
                <User className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                <span>{node.speaker}</span>
              </span>
            )}

            {/* Sefaria Ref */}
            {node.ref && (
              <span className="text-[10px] text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                <Bookmark className="w-2.5 h-2.5 opacity-60" />
                {node.ref}
                {typeof node.sub_index === 'number' && node.sub_index > 0 && (
                  <span className="text-amber-600 dark:text-amber-400 font-bold ml-0.5">
                    #{node.sub_index + 1}
                  </span>
                )}
              </span>
            )}
          </div>

          {/* Node Title (Main Russian Explanation) */}
          <div className="text-[13px] sm:text-sm font-semibold leading-snug text-foreground group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
            {node.title}
          </div>

          {/* Relation Label (Logical connection to parent node) */}
          {node.relation_label && (
            <div className="text-[11px] text-muted-foreground/80 font-medium flex items-center gap-1 mt-0.5">
              <CornerDownRight className="w-3 h-3 text-amber-500/70" />
              <span>{node.relation_label}</span>
            </div>
          )}
        </div>
      </div>

      {/* Nested Children Nodes */}
      {hasChildren && isExpanded && (
        <div className="pl-4 sm:pl-5 border-l border-border/30 ml-2 space-y-1">
          {node.children.map((childNode) => (
            <SugyaTreeNodeItem
              key={childNode.id}
              node={childNode}
              currentRef={currentRef}
              onNodeClick={onNodeClick}
            />
          ))}
        </div>
      )}
    </div>
  );
};
