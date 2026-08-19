import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Zap, RefreshCw, AlertCircle, Map as MapIcon, Layers, RotateCcw, Palette, ChevronDown, ChevronUp, ArrowRight } from 'lucide-react';
import { calculateSugyaMap, SugyaMapData, SugyaNode } from '../../services/sugyaApi';
import { SugyaTreeNodeItem, TreeHierarchyNode } from './SugyaTreeNode';
import { scrollToAnchor, applyWholeSugyaHighlight, setSelectedSugyaNode, clearSugyaHoverState } from '../../utils/sugyaAnchorMatcher';
import { isRefOverlap } from '../../utils/refUtils';
import { Button } from '../ui/button';
import { TextSegment } from '../../types/text';
import { cn } from '../../lib/utils';

// Global in-memory v4 cache surviving unmounts & full-screen mode toggles
const GLOBAL_SUGYA_MAP_V4_CACHE: Record<string, SugyaMapData> = {};

const TAXONOMY_LEGEND = [
  { type: 'Statement', label: 'Утверждение / Тезис', icon: '📌', colorBg: 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  { type: 'Question', label: 'Вопрос (Шеела)', icon: '❓', colorBg: 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  { type: 'Attack', label: 'Атака / Возражение (Кушья)', icon: '⚔️', colorBg: 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  { type: 'Defense', label: 'Защита / Решение (Тируц)', icon: '🛡️', colorBg: 'bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-500' },
  { type: 'Proof', label: 'Доказательство (Раайя)', icon: '🧾', colorBg: 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  { type: 'Answer', label: 'Ответ на вопрос', icon: '💡', colorBg: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
];

const TAXONOMY_ICONS: Record<string, string> = {
  Statement: '📌',
  Question: '❓',
  Attack: '⚔️',
  Defense: '🛡️',
  Proof: '🧾',
  Answer: '💡',
};

interface SugyaMapContainerProps {
  currentRef?: string;
  segments?: TextSegment[];
  className?: string;
}

/**
 * Builds tree hierarchy using direct parent_id references,
 * with cycle detection and orphan node fallback handling.
 */
export function buildTreeFromNodes(nodes: SugyaNode[]): TreeHierarchyNode[] {
  if (!nodes || nodes.length === 0) return [];

  const hasParentIds = nodes.some((n) => n.parent_id !== undefined);

  if (!hasParentIds) {
    // Legacy fallback for nodes without parent_id
    const rootNodes: TreeHierarchyNode[] = [];
    const stack: { level: number; node: TreeHierarchyNode }[] = [];
    for (const node of nodes) {
      const treeNode: TreeHierarchyNode = { ...node, children: [] };
      const level = node.level || 1;
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        stack.pop();
      }
      if (stack.length === 0) rootNodes.push(treeNode);
      else stack[stack.length - 1].node.children.push(treeNode);
      stack.push({ level, node: treeNode });
    }
    return rootNodes;
  }

  const nodeMap = new Map<string, TreeHierarchyNode>();
  const rootNodes: TreeHierarchyNode[] = [];

  nodes.forEach((node) => {
    nodeMap.set(node.id, { ...node, children: [] });
  });

  nodes.forEach((node) => {
    const currentTreeNode = nodeMap.get(node.id);
    if (!currentTreeNode) return;

    if (node.parent_id && nodeMap.has(node.parent_id) && node.parent_id !== node.id) {
      // Cycle detection: walk up from parent_id to check if node.id is an ancestor
      let isCycle = false;
      let currParentId: string | null | undefined = node.parent_id;
      const visitedAncestors = new Set<string>();

      while (currParentId) {
        if (currParentId === node.id || visitedAncestors.has(currParentId)) {
          isCycle = true;
          break;
        }
        visitedAncestors.add(currParentId);
        const ancestorNode = nodeMap.get(currParentId);
        currParentId = ancestorNode?.parent_id;
      }

      if (!isCycle) {
        const parentNode = nodeMap.get(node.parent_id);
        parentNode?.children.push(currentTreeNode);
      } else {
        rootNodes.push(currentTreeNode);
      }
    } else {
      rootNodes.push(currentTreeNode);
    }
  });

  return rootNodes;
}

export const SugyaMapContainer: React.FC<SugyaMapContainerProps> = ({
  currentRef,
  segments,
  className,
}) => {
  const [mapData, setMapData] = useState<SugyaMapData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState<boolean>(false);
  const fetchingRef = useRef<string | null>(null);

  // Helper to store mapData into V4 cache
  const cacheMapForTopic = useCallback((data: SugyaMapData, primaryRef?: string) => {
    const refsToSave = new Set<string>();
    if (primaryRef) refsToSave.add(primaryRef);

    data.nodes?.forEach((node) => {
      if (node.ref) refsToSave.add(node.ref);
    });

    refsToSave.forEach((r) => {
      GLOBAL_SUGYA_MAP_V4_CACHE[r] = data;
      try {
        localStorage.setItem(`SUGYA_MAP_V4_CACHE_${r}`, JSON.stringify(data));
      } catch (e) {
        // ignore storage limits
      }
    });
  }, []);

  // Auto-restore cached map from V4 memory/localStorage or fetch from PostgreSQL DB on mount
  useEffect(() => {
    if (!currentRef) return;

    const normalizedRef = currentRef.replace(/[: ]/g, '.');
    const existing =
      GLOBAL_SUGYA_MAP_V4_CACHE[currentRef] ||
      GLOBAL_SUGYA_MAP_V4_CACHE[normalizedRef];

    if (existing) {
      setError(null);
      setMapData(existing);
      return;
    }

    try {
      const stored =
        localStorage.getItem(`SUGYA_MAP_V4_CACHE_${currentRef}`) ||
        localStorage.getItem(`SUGYA_MAP_V4_CACHE_${normalizedRef}`);

      if (stored) {
        const parsed: SugyaMapData = JSON.parse(stored);
        cacheMapForTopic(parsed, currentRef);
        setError(null);
        setMapData(parsed);
        return;
      }
    } catch (e) {
      // ignore
    }

    // Deduplication guard: don't issue duplicate parallel network requests for the exact same ref
    if (fetchingRef.current === currentRef) {
      return;
    }

    fetchingRef.current = currentRef;
    let isMounted = true;
    calculateSugyaMap(currentRef, segments, undefined, false)
      .then((data) => {
        if (isMounted && data && data.nodes && data.nodes.length > 0) {
          cacheMapForTopic(data, currentRef);
          setMapData(data);
        }
      })
      .catch(() => {
        // Silently ignore if no map exists in DB yet
      })
      .finally(() => {
        if (fetchingRef.current === currentRef) {
          fetchingRef.current = null;
        }
      });

    return () => {
      isMounted = false;
    };
  }, [currentRef, cacheMapForTopic]);

  // Apply sugya text highlights and notify reader components whenever mapData or currentRef updates
  useEffect(() => {
    applyWholeSugyaHighlight(mapData?.nodes, true);
  }, [mapData, currentRef]);

  // Highlight and auto-scroll tree node in Sugya Map panel matching active ref in reader
  useEffect(() => {
    if (!currentRef) return;
    const treeNodeElements = document.querySelectorAll('[data-sugya-node-ref]');
    treeNodeElements.forEach((el) => {
      const nodeRef = el.getAttribute('data-sugya-node-ref');
      if (nodeRef && isRefOverlap(currentRef, nodeRef)) {
        el.classList.add('sugya-tree-node-selected');
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } else {
        el.classList.remove('sugya-tree-node-selected');
      }
    });
  }, [currentRef, mapData]);

  const handleCalculateMap = useCallback(async (forceRecalculate = false) => {
    if (!currentRef && (!segments || segments.length === 0)) {
      setError('Нет активного отрывка Гмары для анализа');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const data = await calculateSugyaMap(currentRef || '', segments, undefined, forceRecalculate);
      setMapData(data);
      if (currentRef) {
        cacheMapForTopic(data, currentRef);
      }
    } catch (err: any) {
      console.error('[SugyaMapContainer] Calculation error:', err);
      setError(err.message || 'Ошибка при вычислении логической карты сугии');
    } finally {
      setIsLoading(false);
    }
  }, [currentRef, segments]);

  const handleNodeClick = useCallback((node: SugyaNode) => {
    const targetRef = node.ref || currentRef;
    setSelectedSugyaNode(String(node.id), String(node.type));
    scrollToAnchor(
      targetRef,
      node.start_anchor,
      node.end_anchor,
      node.type,
      node.sub_index,
      undefined,
      node.start_word_idx,
      node.end_word_idx
    );

    window.dispatchEvent(
      new CustomEvent('sugya-node-click', {
        detail: {
          ref: targetRef,
          start_anchor: node.start_anchor,
          end_anchor: node.end_anchor,
          type: node.type,
        },
      })
    );
  }, [currentRef]);

  const hierarchyTree = mapData?.nodes ? buildTreeFromNodes(mapData.nodes) : [];

  return (
    <div 
      className={cn("flex flex-col h-full bg-background min-h-0", className)}
      onMouseLeave={clearSugyaHoverState}
    >
      {/* Container Header */}
      <div className="p-2.5 border-b border-border/20 flex items-center justify-between bg-muted/20 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <MapIcon className="w-4 h-4 text-amber-500" />
          <span className="font-semibold text-xs tracking-wide uppercase">
            Карта Сугии
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Toggle Legend Panel Button */}
          <Button
            size="sm"
            variant="outline"
            className={cn(
              "h-7 px-2 text-[11px] gap-1 transition-all",
              showLegend
                ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                : "text-muted-foreground"
            )}
            title="Показать/скрыть легенду цветов логических категорий"
            onClick={() => setShowLegend(!showLegend)}
          >
            <Palette className="w-3.5 h-3.5 text-amber-500" />
            <span>Легенда</span>
            {showLegend ? <ChevronUp className="w-3 h-3 ml-0.5" /> : <ChevronDown className="w-3 h-3 ml-0.5" />}
          </Button>

          {/* Calculate / Recalculate Button */}
          <Button
            size="sm"
            variant="default"
            className="h-7 text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white shadow-sm transition-all"
            disabled={isLoading}
            onClick={() => handleCalculateMap(!!mapData)}
          >
            {isLoading ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : mapData ? (
              <RotateCcw className="w-3.5 h-3.5 text-yellow-100" />
            ) : (
              <Zap className="w-3.5 h-3.5 text-yellow-200 fill-yellow-200" />
            )}
            <span>{mapData ? "Пересчитать" : "Просчитать"}</span>
          </Button>
        </div>
      </div>

      {/* Dialogue Flow Ribbon */}
      {!isLoading && mapData && mapData.nodes && mapData.nodes.length > 0 && (
        <div className="px-3 py-2 border-b border-border/15 bg-card/40 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex-shrink-0 mr-1">
            Поток:
          </span>
          {mapData.nodes.map((node, idx) => (
            <React.Fragment key={node.id}>
              {idx > 0 && <ArrowRight className="w-3 h-3 text-muted-foreground/40 flex-shrink-0" />}
              <button
                type="button"
                onClick={() => handleNodeClick(node)}
                title={`${node.type}${node.speaker ? ` (${node.speaker})` : ''}: ${node.title}`}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent/60 hover:bg-amber-500/20 text-[11px] font-semibold transition-all flex-shrink-0 border border-border/30 hover:border-amber-500/40"
              >
                <span>{TAXONOMY_ICONS[node.type] || '📌'}</span>
                {node.speaker && <span className="text-[10px] opacity-85 truncate max-w-[80px]">{node.speaker}</span>}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Main Content Body */}
      <div className="flex-1 overflow-y-auto p-3 min-h-0 space-y-3">
        {/* Expandable Taxonomy Color Legend */}
        {showLegend && (
          <div className="p-2.5 rounded-lg bg-card border border-border/60 shadow-sm space-y-2 text-xs">
            <div className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider flex items-center justify-between">
              <span>🎨 Легенда Цветов Категорий</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {TAXONOMY_LEGEND.map((item) => (
                <div
                  key={item.type}
                  className={cn(
                    "flex items-center gap-1.5 p-1.5 rounded border text-[11px] font-medium transition-all",
                    item.colorBg
                  )}
                >
                  <span>{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <Zap className="w-5 h-5 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Анализируем логику сугии...</p>
              <p className="text-[11px] text-muted-foreground">
                Быстрая типизация спанов и построение графа parent_id
              </p>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && !isLoading && (
          <div className="p-3 rounded-lg border border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !mapData && !error && (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground space-y-3">
            <div className="p-3 rounded-full bg-muted/40">
              <Layers className="w-6 h-6 opacity-60" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Интерактивная Карта Сугии</p>
              <p className="text-[11px] text-muted-foreground max-w-[220px]">
                Нажмите «Просчитать», чтобы распознать логическую структуру отрывка Гмары.
              </p>
            </div>
          </div>
        )}

        {/* Render Calculated Sugya Map Tree */}
        {!isLoading && mapData && (
          <div className="space-y-3">
            {/* Sugya Title Banner */}
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/25 text-sm font-bold text-amber-900 dark:text-amber-200 leading-snug">
              📜 {mapData.sugya_title}
            </div>

            {/* Tree Nodes Hierarchy */}
            <div className="space-y-1" data-sugya-tree-root="true">
              {hierarchyTree.map((node) => (
                <SugyaTreeNodeItem
                  key={node.id}
                  node={node}
                  currentRef={currentRef}
                  onNodeClick={handleNodeClick}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
