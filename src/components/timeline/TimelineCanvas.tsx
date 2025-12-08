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
  | { id: string; type: 'generation_label'; x: number; y: number; label: string; periodId: string }
  | { id: string; type: 'person'; x: number; y: number; width: number; height: number; person: TimelinePerson; period: Period; isFuzzy?: boolean };

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

          // 2. Add Generation Lines and Labels (кроме периода Торы — там оставляем только подпись ветви)
          const groupAbsoluteY = Y_period + Y_row + Y_group;
          if (block.period.id !== 'torah' && block.period.id !== 'shoftim') {
            acc.push({
              id: `${group.id}-line`,
              type: 'generation_line',
              x1: block.x,
              y1: groupAbsoluteY,
              x2: block.x + block.width,
              y2: groupAbsoluteY,
            });
          }
          const labelX = block.x + (group as any).xOffset + 12;
          const labelY = block.period.id === 'torah' ? groupAbsoluteY + 8 : groupAbsoluteY + 15;
          if (block.period.id !== 'shoftim') {
            acc.push({
              id: `${group.id}-label`,
              type: 'generation_label',
              x: labelX,
              y: labelY,
              label: group.label,
              periodId: block.period.id,
            });
          }
          
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
              isFuzzy: pl.isFuzzy,
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
      { person: TimelinePerson; x: number; y: number; width: number; height: number; period: Period; isFuzzy?: boolean }
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
        isFuzzy: n.isFuzzy,
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
    <div className="relative h-full w-full overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-25 blur-2xl [background:radial-gradient(circle_at_25%_18%,hsl(var(--muted))/16,transparent_42%),radial-gradient(circle_at_78%_12%,hsl(var(--card))/14,transparent_45%),radial-gradient(circle_at_46%_72%,hsl(var(--border))/18,transparent_50%)]" />
      <div className="absolute left-4 top-4 z-30 flex items-center gap-2 rounded-full border border-border/70 bg-card/90 px-3 py-2 shadow-lg backdrop-blur-md text-foreground">
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
                    x={0}
                    y={0}
                    width={n.width}
                    height={n.height}
                    rx={14}
                    fill={color}
                    opacity={n.period.id === 'torah' ? 0.12 : 0.08}
                    stroke={color}
                    strokeWidth={2}
                    style={{ filter: 'drop-shadow(0 10px 30px rgba(0,0,0,0.05))' }}
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
                stroke="hsl(var(--border))"
                strokeWidth={1}
                strokeDasharray="4 4"
                strokeOpacity={0.7}
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
                  <text
                    x={0}
                    y={30}
                    className="text-[11px] font-semibold text-muted-foreground"
                    fill="currentColor"
                  >
                    {n.period.startYear} — {n.period.endYear}
                  </text>
                </g>
              );
            })}
            
            {/* Generation Labels */}
            {generationLabelNodes.map((n) => (
              <text
                key={n.id}
                x={n.x}
                y={n.y}
                className="text-xs font-semibold text-muted-foreground"
                fill="currentColor"
                opacity={n.periodId === 'torah' && n.label.toLowerCase().includes('поколение') ? 0 : 1}
              >
                {n.label}
              </text>
            ))}

            {/* People */}
            {personNodes.map((n) => {
              const colors = generateColorSystem(n.person.period);
              const isSelected = selectedPersonSlug === n.person.slug;
              const isDimmed = Boolean(hoveredSlug && hoveredSlug !== n.person.slug);
              const isFuzzy = Boolean(n.isFuzzy || !n.person.deathYear || !n.person.birthYear);
              const displayName = n.person.name_ru || n.person.name_en || n.person.slug;
              const lifespan = n.person.lifespan || `${n.person.birthYear ?? ''}–${n.person.deathYear ?? ''}`;
              const safeId = n.id.replace(/[^a-zA-Z0-9-_]/g, '_');
              const gradId = `fuzzy-${safeId}`;
              const pillGradId = `pill-${safeId}`;
              const patternId = `pat-${safeId}`;
              const wrapName = (name: string, maxChars: number) => {
                const words = name.split(' ');
                const lines: string[] = [];
                let current = '';
                words.forEach((w) => {
                  if ((current + ' ' + w).trim().length <= maxChars) {
                    current = (current + ' ' + w).trim();
                  } else {
                    if (current) lines.push(current);
                    current = w;
                  }
                });
                if (current) lines.push(current);
                if (lines.length > 2) {
                  // ограничиваем двумя строками
                  const first = lines[0];
                  const rest = lines.slice(1).join(' ');
                  const truncated = rest.length > maxChars ? rest.slice(0, maxChars - 1) + '…' : rest;
                  return [first, truncated];
                }
                if (lines.length === 1 && lines[0].length > maxChars) {
                  // одиночное длинное слово — обрежем с многоточием
                  return [lines[0].slice(0, maxChars - 1) + '…'];
                }
                return lines;
              };
              const maxChars = Math.max(10, Math.floor(n.width / 7));
              const nameLines = wrapName(displayName, maxChars);
              const sub = (n.person.subPeriod || '').toLowerCase();
              const branchFill =
                sub.startsWith('preflood_root') ? 'rgba(156, 163, 175, 0.18)' :
                sub.startsWith('preflood_cain') ? 'rgba(244, 114, 182, 0.18)' :
                sub.startsWith('preflood_seth') ? 'rgba(52, 211, 153, 0.18)' :
                sub.startsWith('postflood_root') ? 'rgba(190, 190, 190, 0.18)' :
                sub.startsWith('postflood_line_shem') || sub.startsWith('flood_line_shem') ? 'rgba(45, 212, 191, 0.15)' :
                sub.startsWith('postflood_line_ham') || sub.startsWith('flood_line_ham') ? 'rgba(251, 191, 36, 0.15)' :
                sub.startsWith('postflood_line_japheth') || sub.startsWith('flood_line_japheth') ? 'rgba(96, 165, 250, 0.15)' :
                undefined;

              return (
                <g 
                  key={n.id} 
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer"
                  onClick={() => onPersonSelect(n.person)}
                  onMouseEnter={() => setHoveredSlug(n.person.slug)}
                  onMouseLeave={() => setHoveredSlug(null)}
                >
                  <defs>
                    <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor={colors.personBar.normal} stopOpacity={isFuzzy ? 0.05 : 0.4} />
                      <stop offset="20%" stopColor={colors.personBar.normal} stopOpacity={isFuzzy ? 0.7 : 1} />
                      <stop offset="80%" stopColor={colors.personBar.normal} stopOpacity={isFuzzy ? 0.7 : 1} />
                      <stop offset="100%" stopColor={colors.personBar.normal} stopOpacity={isFuzzy ? 0.05 : 0.4} />
                    </linearGradient>
                    <linearGradient id={pillGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="white" stopOpacity="0.18" />
                      <stop offset="50%" stopColor="white" stopOpacity="0.08" />
                      <stop offset="100%" stopColor="white" stopOpacity="0" />
                    </linearGradient>
                    <pattern id={patternId} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                      <line x1="0" y1="0" x2="0" y2="6" stroke={colors.personBar.normal} strokeWidth="1" strokeOpacity="0.18" />
                    </pattern>
                  </defs>
                  {branchFill && (
                    <rect
                      x={0}
                      y={0}
                      width={n.width}
                      height={n.height - 6}
                      rx={14}
                      fill={branchFill}
                      opacity={isDimmed ? 0.18 : 0.35}
                    />
                  )}
                  <rect
                    x={0}
                    y={0}
                    width={n.width}
                    height={n.height - 6}
                    rx={14}
                    fill={isFuzzy ? colors.personBar.estimated : colors.personBar.normal}
                    stroke={isSelected ? colors.periodBase : 'transparent'}
                    strokeWidth={isSelected ? 2 : 1.5}
                    opacity={isDimmed ? 0.35 : 1}
                  />
                  {isFuzzy && (
                    <rect
                      x={0}
                      y={0}
                      width={n.width}
                      height={n.height - 6}
                      rx={14}
                      fill={`url(#${gradId})`}
                      opacity={isDimmed ? 0.25 : 0.6}
                    />
                  )}
                  <rect
                    x={0}
                    y={0}
                    width={n.width}
                    height={n.height - 6}
                    rx={14}
                    fill={`url(#${pillGradId})`}
                    opacity={isDimmed ? 0.18 : 0.22}
                  />
                  {isFuzzy && (
                    <rect
                      x={0}
                      y={0}
                      width={n.width}
                      height={n.height - 6}
                      rx={14}
                      fill={`url(#${patternId})`}
                      opacity={isDimmed ? 0.14 : 0.24}
                    />
                  )}
                  {lod !== 'low' && n.width > 30 && (
                    <>
                      {nameLines.map((line, idx) => {
                        const lineY = (n.height - 6) / 2 - ((nameLines.length - 1) * 10) / 2 + idx * 12;
                        return (
                          <g key={`${n.id}-line-${idx}`}>
                            <text
                              x={n.width / 2}
                              y={lineY + 1}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="text-[11px] font-semibold select-none pointer-events-none"
                              fill="rgba(0,0,0,0.35)"
                            >
                              {line}
                            </text>
                            <text
                              x={n.width / 2}
                              y={lineY}
                              textAnchor="middle"
                              dominantBaseline="middle"
                              className="text-[11px] font-semibold select-none pointer-events-none"
                              fill="#ffffff"
                              stroke="rgba(0,0,0,0.22)"
                              strokeWidth={0.5}
                              paintOrder="stroke"
                              opacity={isDimmed ? 0.6 : 0.98}
                            >
                              {line}
                            </text>
                          </g>
                        );
                      })}
                    </>
                  )}
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
          <div className="flex flex-col gap-2">
            <PersonCard
              person={activeDetail.person}
              layout={{ x: 0, y: 0, width: 160, height: 100, tier: 0, slug: activeDetail.person.slug }}
              onSelect={onPersonSelect}
              isSelected={selectedPersonSlug === activeDetail.person.slug}
              periodColor={getPeriodColor(periods, activeDetail.period.id)}
              period={activeDetail.period}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="px-2 py-1 rounded-md text-xs bg-primary text-primary-foreground shadow-sm"
                onClick={() => onPersonSelect(activeDetail.person)}
              >
                Открыть профиль
              </button>
              <button
                type="button"
                className="px-2 py-1 rounded-md text-xs border border-border/70 bg-background/80 shadow-sm"
                onClick={() => window.open(`/sage/${activeDetail.person.slug}`, '_blank')}
              >
                В новой вкладке
              </button>
            </div>
          </div>
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
