import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Period, TimelinePerson } from '@/types/timeline';
import { buildTimelineBlocks, PeriodBlock } from '@/utils/layoutEngine';
import { getPeriodColor, generateColorSystem } from '@/utils/timelineColors';
import { useTimelineNavigation } from '@/hooks/useTimelineNavigation';
import { Minimap } from './Minimap';
import { PersonCard } from './Timeline';
import { buildTickMarks } from '@/utils/dateCalculations';
import { TimelineAxis } from './TimelineAxis';

type LOD = 'low' | 'medium' | 'high';

interface TimelineCanvasProps {
  people: TimelinePerson[];
  periods: Period[];
  minYear: number;
  maxYear: number;
  focusYear?: number | null;
  onPersonSelect: (p: TimelinePerson) => void;
  selectedPersonSlug?: string | null;
}

const BASE_PX_PER_YEAR = 3;
const BAR_TRACK_HEIGHT = 56;

type RenderNode =
  | { id: string; type: 'period_bg'; x: number; y: number; width: number; height: number; period: Period }
  | { id: string; type: 'period_label'; x: number; y: number; period: Period }
  | { id: string; type: 'generation_line'; x1: number; y1: number; x2: number; y2: number; }
  | { id: string; type: 'generation_label'; x: number; y: number; label: string }
  | { id: string; type: 'person'; x: number; y: number; width: number; height: number; person: TimelinePerson; period: Period };

export function TimelineCanvas({
  people,
  periods,
  minYear,
  maxYear,
  focusYear,
  onPersonSelect,
  selectedPersonSlug,
}: TimelineCanvasProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<{ active: boolean; lastX: number; lastY: number; lastT: number; vx: number; vy: number }>({
    active: false,
    lastX: 0,
    lastY: 0,
    lastT: 0,
    vx: 0,
    vy: 0,
  });
  const [lod, setLod] = useState<LOD>('medium');
  const hasFitted = useRef(false);
  const [hoveredSlug, setHoveredSlug] = useState<string | null>(null);

  const { transform, panBy, zoomAt, applyViewport, flyTo } = useTimelineNavigation({
    minScale: 0.05,
    maxScale: 5,
  });

  const yearToX = useCallback(
    (year: number) => (year - minYear) * BASE_PX_PER_YEAR,
    [minYear],
  );
  const timelineWidth = (maxYear - minYear) * BASE_PX_PER_YEAR;

  const blocks: PeriodBlock[] = useMemo(
    () => buildTimelineBlocks({ people, periods, yearToX }),
    [people, periods, yearToX],
  );

  const nodes = useMemo<RenderNode[]>(() => {
    const acc: RenderNode[] = [];
    blocks.forEach((block) => {
      const Y_period = block.y;

      // 1. Add Period Background and Label
      acc.push({
        id: `${block.id}-bg`,
        type: 'period_bg',
        x: block.x,
        y: Y_period,
        width: block.width,
        height: block.height,
        period: block.period,
      });
      acc.push({
        id: `${block.id}-label`,
        type: 'period_label',
        x: block.x + 12,
        y: Y_period + 10,
        period: block.period,
      });

      block.rows.forEach((row) => {
        const Y_row = row.y; // y-offset of the row within the block

        row.groups.forEach((group) => {
          const Y_group = group.y; // y-offset of the group within the row

          // 2. Add Generation Lines and Labels
          const groupAbsoluteY = Y_period + Y_row + Y_group;
          acc.push({
            id: `${group.id}-line`,
            type: 'generation_line',
            x1: block.x,
            y1: groupAbsoluteY,
            x2: block.x + block.width,
            y2: groupAbsoluteY,
          });
          acc.push({
            id: `${group.id}-label`,
            type: 'generation_label',
            x: block.x + 12,
            y: groupAbsoluteY + 15,
            label: group.label,
          });
          
          group.personsLayout.forEach((pl) => {
            const person = group.people.find((p) => p.slug === pl.slug);
            if (!person) return;
            
            const Y_local = pl.y; // y-offset of the person within the group

            // 3. Add Person card with absolute Y
            acc.push({
              id: pl.slug,
              type: 'person',
              x: block.x + pl.x,
              y: groupAbsoluteY + Y_local,
              width: pl.width,
              height: BAR_TRACK_HEIGHT,
              person,
              period: block.period,
            });
          });
        });
      });
    });
    return acc;
  }, [blocks]);

  const contentHeight = useMemo(
    () => (blocks.length ? Math.max(...blocks.map((b) => b.y + b.height)) + 240 : 800),
    [blocks],
  );

  const ticks = useMemo(() => {
    const span = Math.abs(maxYear - minYear);
    const step = span > 2000 ? 200 : span > 1200 ? 100 : 50;
    return buildTickMarks(minYear, maxYear, step);
  }, [maxYear, minYear]);

  const periodBgNodes = useMemo(() => nodes.filter((n): n is Extract<RenderNode, { type: 'period_bg' }> => n.type === 'period_bg'), [nodes]);
  const periodLabelNodes = useMemo(() => nodes.filter((n): n is Extract<RenderNode, { type: 'period_label' }> => n.type === 'period_label'), [nodes]);
  const generationLineNodes = useMemo(() => nodes.filter((n): n is Extract<RenderNode, { type: 'generation_line' }> => n.type === 'generation_line'), [nodes]);
  const generationLabelNodes = useMemo(() => nodes.filter((n): n is Extract<RenderNode, { type: 'generation_label' }> => n.type === 'generation_label'), [nodes]);
  const personNodes = useMemo(() => nodes.filter((n): n is Extract<RenderNode, { type: 'person' }> => n.type === 'person'), [nodes]);

  const viewWindow = useMemo(() => {
    const viewportWidth = viewportRef.current?.clientWidth ?? 1;
    const start = minYear + (-transform.x / Math.max(0.0001, transform.scale)) / BASE_PX_PER_YEAR;
    const end = start + (viewportWidth / Math.max(0.0001, transform.scale)) / BASE_PX_PER_YEAR;
    return { start, end };
  }, [minYear, transform.x, transform.scale]);

  const personLookup = useMemo(() => {
    const map = new Map<
      string,
      { person: TimelinePerson; x: number; y: number; width: number; height: number; period: Period }
    >();
    nodes.forEach((n) => {
      if (n.type !== 'person') return;
      map.set(n.person.slug, {
        person: n.person,
        x: n.x,
        y: n.y,
        width: n.width,
        height: n.height,
        period: n.period,
      });
    });
    return map;
  }, [nodes]);

  useEffect(() => {
    const s = transform.scale;
    setLod(s < 0.7 ? 'low' : s < 1.6 ? 'medium' : 'high');
  }, [transform.scale]);

  // Fit initial view once content sizes known
  useEffect(() => {
    if (hasFitted.current) return;
    const node = viewportRef.current;
    if (!node) return;
    if (!personNodes.length && !periodBgNodes.length) return;
    const scaleX = node.clientWidth / Math.max(1, timelineWidth + 200);
    const scaleY = node.clientHeight / Math.max(1, contentHeight + 200);
    const desiredScale = Math.min(5, Math.max(0.1, Math.min(scaleX, scaleY)));
    const centeredX = (node.clientWidth - timelineWidth * desiredScale) / 2;
    const centeredY = (node.clientHeight - contentHeight * desiredScale) / 2;
    flyTo(centeredX, centeredY, desiredScale);
    hasFitted.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineWidth, contentHeight, personNodes.length, periodBgNodes.length]);

  useEffect(() => {
    if (focusYear == null || !viewportRef.current) return;
    const viewportWidth = viewportRef.current.clientWidth;
    const targetX = -yearToX(focusYear) * transform.scale + viewportWidth / 2;
    flyTo(targetX, transform.y, transform.scale);
  }, [focusYear, flyTo, transform.scale, transform.y, yearToX]);

  const worldToScreen = useCallback(
    (point: { x: number; y: number }) => ({
      x: point.x * transform.scale + transform.x,
      y: point.y * transform.scale + transform.y,
    }),
    [transform],
  );

  const yearToScreenX = useCallback(
    (year: number) => transform.x + (year - minYear) * BASE_PX_PER_YEAR * transform.scale,
    [minYear, transform.x, transform.scale],
  );

  const fitToScreen = useCallback(() => {
    const node = viewportRef.current;
    if (!node) return;
    const desiredScale = Math.min(5, Math.max(0.2, node.clientWidth / (timelineWidth + 240)));
    const centeredX = (node.clientWidth - timelineWidth * desiredScale) / 2;
    flyTo(centeredX, transform.y, desiredScale);
  }, [flyTo, timelineWidth, transform.y]);

  const focusToMid = useCallback(() => {
    const midYear = (minYear + maxYear) / 2;
    const node = viewportRef.current;
    if (!node) return;
    const targetX = -yearToX(midYear) * transform.scale + node.clientWidth / 2;
    flyTo(targetX, transform.y, transform.scale);
  }, [flyTo, maxYear, minYear, transform.scale, transform.y, yearToX]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button === 2) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-interactive="true"]')) return;
    pointerRef.current = {
      active: true,
      lastX: e.clientX,
      lastY: e.clientY,
      lastT: performance.now(),
      vx: 0,
      vy: 0,
    };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current.active) return;
    const now = performance.now();
    const dx = e.clientX - pointerRef.current.lastX;
    const dy = e.clientY - pointerRef.current.lastY;
    const dt = Math.max(16, now - pointerRef.current.lastT);
    pointerRef.current.vx = (dx / dt) * 16;
    pointerRef.current.vy = (dy / dt) * 16;
    pointerRef.current.lastX = e.clientX;
    pointerRef.current.lastY = e.clientY;
    pointerRef.current.lastT = now;
    panBy(dx, dy);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!pointerRef.current.active) return;
    panBy(0, 0, { vx: pointerRef.current.vx, vy: pointerRef.current.vy });
    pointerRef.current.active = false;
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = viewportRef.current?.getBoundingClientRect();
    if (!rect) return;
    const point = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const factor = Math.exp(-e.deltaY * 0.0014);
    zoomAt(point, factor);
  };

  const activeDetailSlug = hoveredSlug ?? selectedPersonSlug ?? null;
  const activeDetail = activeDetailSlug ? personLookup.get(activeDetailSlug) : undefined;
  const activeDetailScreen = activeDetail
    ? worldToScreen({ x: activeDetail.x + activeDetail.width / 2, y: activeDetail.y })
    : null;

  return (
    <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900">
      <div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border bg-white/80 px-3 py-2 shadow-lg backdrop-blur-md dark:bg-slate-900/80">
        <button
          type="button"
          className="text-xs font-semibold px-2 py-1 rounded-md border border-border/60 hover:bg-muted"
          onClick={fitToScreen}
        >
          Fit to screen
        </button>
        <button
          type="button"
          className="text-xs font-semibold px-2 py-1 rounded-md border border-border/60 hover:bg-muted"
          onClick={focusToMid}
        >
          Focus to date
        </button>
      </div>

      <div
        ref={viewportRef}
        className="absolute inset-0 cursor-grab select-none active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onWheel={handleWheel}
        style={{ touchAction: 'none' }}
      >
        <svg
          width="100%"
          height="100%"
          className="absolute top-0 left-0"
        >
          <g
            id="timeline-content-group"
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          >
            {/* Period backgrounds */}
            {periodBgNodes.map((n) => {
              const color = getPeriodColor(periods, n.period.id);
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <rect
                    x={-10}
                    y={-10}
                    width={n.width + 20}
                    height={n.height + 20}
                    rx={16}
                    fill="white"
                    opacity={0.85}
                    stroke="rgba(0,0,0,0.04)"
                    style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.08))' }}
                  />
                  <rect
                    x={0}
                    y={0}
                    width={n.width}
                    height={n.height}
                    rx={14}
                    fill="rgba(255,255,255,0.78)"
                    stroke={color}
                    strokeWidth={2}
                  />
                </g>
              );
            })}

            {/* Generation lines */}
            {generationLineNodes.map((n) => (
              <line
                key={n.id}
                x1={n.x1}
                y1={n.y1}
                x2={n.x2}
                y2={n.y2}
                stroke="#e2e8f0"
                strokeWidth={1}
                strokeDasharray="4 4"
              />
            ))}
            
            {/* Period Labels */}
            {periodLabelNodes.map((n) => {
              const color = getPeriodColor(periods, n.period.id);
              return (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <text x={0} y={14} className="text-sm font-bold" fill={color}>
                    {n.period.name_ru}
                  </text>
                  <text x={0} y={30} className="text-[11px] font-semibold" fill="rgba(0,0,0,0.55)">
                    {n.period.startYear} — {n.period.endYear}
                  </text>
                </g>
              );
            })}
            
            {/* Generation Labels */}
            {generationLabelNodes.map((n) => (
              <text key={n.id} x={n.x} y={n.y} className="text-xs font-semibold text-slate-500">
                {n.label}
              </text>
            ))}

            {/* People */}
            {personNodes.map((n) => {
              const colors = generateColorSystem(n.person.period);
              const isSelected = selectedPersonSlug === n.person.slug;
              const isDimmed = Boolean(hoveredSlug && hoveredSlug !== n.person.slug);
              const displayName = n.person.name_ru || n.person.name_en;
              const lifespan = n.person.lifespan || `${n.person.birthYear ?? ''}–${n.person.deathYear ?? ''}`;

              return (
                <g 
                  key={n.id} 
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer"
                  onClick={() => onPersonSelect(n.person)}
                  onMouseEnter={() => setHoveredSlug(n.person.slug)}
                  onMouseLeave={() => setHoveredSlug(null)}
                >
                  <rect
                    x={0}
                    y={0}
                    width={n.width}
                    height={n.height - 6}
                    rx={8}
                    fill={colors.personBar.normal}
                    stroke={isSelected ? colors.periodBase : 'transparent'}
                    strokeWidth={2}
                    opacity={isDimmed ? 0.3 : 1}
                  />
                  {lod !== 'low' && n.width > 70 && (() => {
                      const age = (n.person.deathYear && n.person.birthYear) ? `(~${n.person.deathYear - n.person.birthYear} лет)` : '';
                      const lifespan = n.person.lifespan || `${n.person.birthYear ?? ''}–${n.person.deathYear ?? ''}`;

                      return (
                        <text 
                          x={12}
                          y={14}
                          className="text-xs select-none pointer-events-none"
                          fill={colors.text.onPeriod}
                          opacity={isDimmed ? 0.35 : 0.95}
                        >
                          <tspan x="12" dy="0" className="font-semibold">{n.person.name_ru || n.person.name_en}</tspan>
                          <tspan x="12" dy="1.2em" className="font-semibold">{n.person.name_he}</tspan>
                          <tspan x="12" dy="1.2em" className="text-[10px]">{lifespan} {age}</tspan>
                        </text>
                      );
                  })()}
                </g>
              );
            })}
          </g>

        </svg>
      </div>

      <svg
        className="pointer-events-none absolute bottom-0 left-0 right-0"
        height={80}
        width="100%"
      >
        <TimelineAxis ticks={ticks} yearToX={yearToScreenX} height={40} />
      </svg>

      {activeDetail && lod === 'high' && activeDetailScreen && (
        <div
          className={cn(
            'pointer-events-auto absolute z-40 transition-opacity duration-150',
            hoveredSlug === activeDetail.person.slug ? 'opacity-100' : 'opacity-90',
          )}
          style={{
            left: activeDetailScreen.x,
            top: activeDetailScreen.y - 140,
            transform: 'translate(-40%, -10%)',
          }}
        >
          <PersonCard
            person={activeDetail.person}
            layout={{ x: 0, y: 0, width: 160, height: 100, tier: 0, slug: activeDetail.person.slug }}
            onSelect={onPersonSelect}
            isSelected={selectedPersonSlug === activeDetail.person.slug}
            periodColor={getPeriodColor(periods, activeDetail.period.id)}
            period={activeDetail.period}
          />
        </div>
      )}

      <Minimap
        people={people}
        minYear={minYear}
        maxYear={maxYear}
        viewStart={viewWindow.start}
        viewEnd={viewWindow.end}
        onBrush={(start, end) => {
          const node = viewportRef.current;
          if (!node) return;
          applyViewport(start, end, minYear, BASE_PX_PER_YEAR, node.clientWidth);
        }}
      />
    </div>
  );
}
