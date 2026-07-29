import React, { useState, useEffect, useCallback } from 'react';
import { Zap, RefreshCw, AlertCircle, Map, Layers, Eye, EyeOff, RotateCcw, Palette, ChevronDown, ChevronUp } from 'lucide-react';
import { calculateSugyaMap, SugyaMapData, SugyaNode } from '../../services/sugyaApi';
import { SugyaTreeNodeItem, TreeHierarchyNode } from './SugyaTreeNode';
import { scrollToAnchor, applyWholeSugyaHighlight } from '../../utils/sugyaAnchorMatcher';
import { Button } from '../ui/button';
import { TextSegment } from '../../types/text';
import { cn } from '../../lib/utils';

// Global in-memory cache surviving unmounts & full-screen mode toggles
const GLOBAL_SUGYA_MAP_CACHE: Record<string, SugyaMapData> = {};

const TAXONOMY_LEGEND = [
  { type: 'Statement', label: 'Утверждение / Тезис', colorBg: 'bg-blue-500/15 border-blue-500/40 text-blue-700 dark:text-blue-300', dot: 'bg-blue-500' },
  { type: 'Question', label: 'Вопрос (Шеела)', colorBg: 'bg-purple-500/15 border-purple-500/40 text-purple-700 dark:text-purple-300', dot: 'bg-purple-500' },
  { type: 'Attack', label: 'Атака / Возражение (Кушья)', colorBg: 'bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300', dot: 'bg-red-500' },
  { type: 'Defense', label: 'Защита / Решение (Тируц)', colorBg: 'bg-green-500/15 border-green-500/40 text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  { type: 'Proof', label: 'Доказательство (Раайя)', colorBg: 'bg-sky-500/15 border-sky-500/40 text-sky-700 dark:text-sky-300', dot: 'bg-sky-500' },
  { type: 'Answer', label: 'Ответ на вопрос', colorBg: 'bg-amber-500/15 border-amber-500/40 text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' },
];

interface SugyaMapContainerProps {
  currentRef?: string;
  segments?: TextSegment[];
  className?: string;
}

export function buildTreeFromNodes(nodes: SugyaNode[]): TreeHierarchyNode[] {
  if (!nodes || nodes.length === 0) return [];

  const rootNodes: TreeHierarchyNode[] = [];
  const stack: { level: number; node: TreeHierarchyNode }[] = [];

  for (const node of nodes) {
    const treeNode: TreeHierarchyNode = {
      ...node,
      children: [],
    };

    const level = node.level || 1;

    while (stack.length > 0 && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    if (stack.length === 0) {
      rootNodes.push(treeNode);
    } else {
      stack[stack.length - 1].node.children.push(treeNode);
    }

    stack.push({ level, node: treeNode });
  }

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
  const [showHighlights, setShowHighlights] = useState<boolean>(true);
  const [showLegend, setShowLegend] = useState<boolean>(false);

  // Auto-restore cached map when currentRef changes or component mounts
  useEffect(() => {
    if (currentRef && GLOBAL_SUGYA_MAP_CACHE[currentRef]) {
      setMapData(GLOBAL_SUGYA_MAP_CACHE[currentRef]);
    }
  }, [currentRef]);

  // Apply or toggle whole-sugya text highlights whenever mapData, showHighlights or currentRef updates
  useEffect(() => {
    applyWholeSugyaHighlight(mapData?.nodes, showHighlights);
    const timer = setTimeout(() => {
      applyWholeSugyaHighlight(mapData?.nodes, showHighlights);
    }, 150);
    return () => clearTimeout(timer);
  }, [mapData, showHighlights, currentRef]);

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
        GLOBAL_SUGYA_MAP_CACHE[currentRef] = data;
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
    scrollToAnchor(targetRef, node.start_anchor, node.end_anchor, node.type);

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
    <div className={cn("flex flex-col h-full bg-background min-h-0", className)}>
      {/* Container Header */}
      <div className="p-2.5 border-b border-border/20 flex items-center justify-between bg-muted/20 gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <Map className="w-4 h-4 text-amber-500" />
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

          {/* Toggle Whole-Sugya Highlights Button */}
          {mapData && (
            <Button
              size="sm"
              variant="outline"
              className={cn(
                "h-7 px-2 text-[11px] gap-1 transition-all",
                showHighlights
                  ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                  : "text-muted-foreground"
              )}
              title={showHighlights ? "Скрыть подсветку сугии в тексте" : "Показать подсветку сугии в тексте"}
              onClick={() => setShowHighlights(!showHighlights)}
            >
              {showHighlights ? (
                <Eye className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              <span>{showHighlights ? "Подсветка вкл" : "Подсветка выкл"}</span>
            </Button>
          )}

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
                  <span className={cn("w-2 h-2 rounded-full flex-shrink-0", item.dot)} />
                  <span className="truncate">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Loading Indicator / Skeleton */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-8 space-y-4 text-center">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin" />
              <Zap className="w-5 h-5 text-amber-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold text-foreground">Анализируем логику сугии...</p>
              <p className="text-[11px] text-muted-foreground">
                Строим иерархию тезисов, вопросов и возражений (H1–H6)
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

        {/* Empty State when no map calculated yet */}
        {!isLoading && !mapData && !error && (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center text-muted-foreground space-y-3">
            <div className="p-3 rounded-full bg-muted/40">
              <Layers className="w-6 h-6 opacity-60" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-foreground">Интерактивная Карта Сугии</p>
              <p className="text-[11px] text-muted-foreground max-w-[220px]">
                Нажмите «Просчитать сугию», чтобы распознать логическую структуру отрывка Гмары.
              </p>
            </div>
          </div>
        )}

        {/* Render Calculated Sugya Map Tree */}
        {!isLoading && mapData && (
          <div className="space-y-3">
            {/* Sugya Title Banner */}
            <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-800 dark:text-amber-200">
              📜 {mapData.sugya_title}
            </div>

            {/* Governing Mishnah Summary Banner */}
            {mapData.mishnah_summary && (
              <div className="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/15 text-[11px] text-amber-900/90 dark:text-amber-300/90 leading-relaxed space-y-1">
                <div className="font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1">
                  <span>📖 Исходная Мишна темы:</span>
                </div>
                <p>{mapData.mishnah_summary}</p>
              </div>
            )}

            {/* Tree Nodes Hierarchy */}
            <div className="space-y-1">
              {hierarchyTree.map((node) => (
                <SugyaTreeNodeItem
                  key={node.id}
                  node={node}
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
