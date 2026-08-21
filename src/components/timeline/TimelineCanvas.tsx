import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Period, TimelinePerson } from '@/types/timeline';
import { ALL_COLLAPSED, buildTimelineBlocks, PeriodBlock } from '@/utils/layoutEngine';
import { getPeriodColor, generateColorSystem, getPersonColor } from '@/utils/timelineColors';
import { useTimelineNavigation } from '@/hooks/useTimelineNavigation';
import { Minimap } from './Minimap';
import { PersonCard } from './PersonCard';
import { getSealGeometry } from '@/utils/sealGenerator';
import { getPersonTier, getPersonHook, getPersonSealColor, getPersonLifespanLabel } from '@/utils/personVisuals';

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
  | { id: string; type: 'period_header'; x: number; y: number; width: number; height: number; period: Period; collapsed: boolean }
  | { id: string; type: 'period_label'; x: number; y: number; period: Period }
  | { id: string; type: 'generation_line'; x1: number; y1: number; x2: number; y2: number }
  | { id: string; type: 'generation_label'; x: number; y: number; label: string; periodId: string }
  | {
      id: string;
      type: 'person';
      x: number;
      y: number;
      width: number;
      height: number;
      person: TimelinePerson;
      period: Period;
      isFuzzy?: boolean;
      color?: string;
    };

export function TimelineCanvas({
  people,
  periods,
  minYear,
  maxYear,
  focusYear,
  onPersonSelect,
  selectedPersonSlug,
}: TimelineCanvasProps) {
  const [activePeriodId, setActivePeriodId] = useState<string | null>(ALL_COLLAPSED);
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
    () => buildTimelineBlocks({ people, periods, yearToX, activePeriodId: activePeriodId || undefined }),
    [people, periods, yearToX, activePeriodId],
  );

  const nodes = useMemo<RenderNode[]>(() => {
    const acc: RenderNode[] = [];
    blocks.forEach((block) => {
      const Y_period = block.y;
      const collapsed = !block.rows.length || block.height <= 50;
      const headerHeight = Math.min(block.height, 44);

      acc.push({
        id: `${block.id}-header`,
        type: 'period_header',
        x: block.x,
        y: Y_period,
        width: block.width,
        height: headerHeight,
        period: block.period,
        collapsed,
      });

      // 1. Add Period Background
      acc.push({
        id: `${block.id}-bg`,
        type: 'period_bg',
        x: block.x,
        y: Y_period,
        width: block.width,
        height: block.height,
        period: block.period,
      });

      if (collapsed) return;

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
              color: getPersonColor(person, block.period),
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

  const periodBgNodes = useMemo(() => nodes.filter((n): n is Extract<RenderNode, { type: 'period_bg' }> => n.type === 'period_bg'), [nodes]);
  const periodHeaderNodes = useMemo(() => nodes.filter((n): n is Extract<RenderNode, { type: 'period_header' }> => n.type === 'period_header'), [nodes]);
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
      { person: TimelinePerson; x: number; y: number; width: number; height: number; period: Period; isFuzzy?: boolean; color?: string }
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
        color: n.color,
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
          <defs>
            <linearGradient id="star-card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--card))" />
              <stop offset="100%" stopColor="hsl(var(--muted))" />
            </linearGradient>
            <filter id="star-card-glow" x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="2" stdDeviation="4" floodColor="#C9A94E" floodOpacity="0.3" />
            </filter>
          </defs>

          <g
            id="timeline-content-group"
            transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}
          >
            {/* Period headers (for accordion toggle) */}
            {periodHeaderNodes.map((n) => {
              const color = getPeriodColor(periods, n.period.id);
              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer select-none"
                  onClick={() =>
                    setActivePeriodId((prev) => {
                      if (prev === n.period.id) return ALL_COLLAPSED;
                      if (prev === ALL_COLLAPSED && n.collapsed) return n.period.id;
                      return n.period.id;
                    })
                  }
                >
                  <rect
                    x={0}
                    y={0}
                    width={n.width}
                    height={n.height}
                    rx={10}
                    fill="hsl(var(--card))"
                    stroke={color}
                    strokeWidth={1.5}
                    opacity={n.collapsed ? 0.9 : 0.98}
                  />
                  <text
                    x={14}
                    y={18}
                    className="font-semibold text-sm select-none"
                    style={{ fontFamily: "'Fraunces', Georgia, serif" }}
                    fill="hsl(var(--foreground))"
                  >
                    {n.period.name_ru}
                  </text>
                  <text
                    x={14}
                    y={32}
                    className="text-[11px] font-medium select-none"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                    fill="hsl(var(--muted-foreground))"
                  >
                    {n.period.startYear} — {n.period.endYear}
                  </text>
                  <rect
                    x={n.width - 90}
                    y={8}
                    width={78}
                    height={n.height - 16}
                    rx={8}
                    fill={color}
                    opacity={0.15}
                    stroke={color}
                    strokeWidth={1}
                  />
                  <text
                    x={n.width - 51}
                    y={n.height / 2 + 4}
                    textAnchor="middle"
                    className="text-[11px] font-semibold select-none"
                    style={{ fontFamily: "'Inter', sans-serif" }}
                    fill={color}
                  >
                    {n.collapsed ? 'Раскрыть' : 'Свернуть'}
                  </text>
                </g>
              );
            })}

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
                    fill="hsl(var(--card))"
                    fillOpacity={0.35}
                    className="pointer-events-none"
                  />
                  <rect
                    x={0}
                    y={0}
                    width={n.width}
                    height={n.height}
                    rx={14}
                    fill={color}
                    fillOpacity={n.period.id === 'torah' ? 0.09 : 0.05}
                    stroke={color}
                    strokeWidth={1.5}
                    strokeOpacity={0.4}
                    className="pointer-events-none"
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
                strokeOpacity={0.6}
              />
            ))}
            
            {/* Generation Labels */}
            {generationLabelNodes.map((n) => (
              <text
                key={n.id}
                x={n.x}
                y={n.y}
                className="text-xs font-semibold select-none"
                style={{ fontFamily: "'Inter', sans-serif" }}
                fill="hsl(var(--muted-foreground))"
                opacity={n.periodId === 'torah' && n.label.toLowerCase().includes('поколение') ? 0 : 0.9}
              >
                {n.label}
              </text>
            ))}

            {/* People (SVG Nodes with Generative Seals and 3-Tier Hierarchy) */}
            {personNodes.map((n) => {
              const person = n.person;
              const tier = getPersonTier(person);
              const sealColor = getPersonSealColor(person, n.period);
              const geo = getSealGeometry(person.slug);
              const isSelected = selectedPersonSlug === person.slug;
              const isHovered = hoveredSlug === person.slug;
              const isDimmed = Boolean(hoveredSlug && hoveredSlug !== person.slug);
              
              const displayName = person.name_ru || person.name_en || person.slug;
              const lifespanLabel = getPersonLifespanLabel(person);
              const hook = getPersonHook(person, 75);

              const cardW = n.width;
              const cardH = n.height - 6;

              // Responsive width thresholds
              const isUltraNarrow = cardW < 45;
              const isNarrow = cardW >= 45 && cardW < 100;
              const isStandard = cardW >= 100;

              // Seal sizing per tier
              const baseSealSize = isUltraNarrow
                ? Math.min(22, Math.max(14, cardW - 8))
                : tier === 'star'
                ? 32
                : tier === 'notable'
                ? 24
                : 16;
              const sealSize = Math.min(baseSealSize, cardH - 8);
              const sealScale = sealSize / 100;

              const sealX = isUltraNarrow ? (cardW - sealSize) / 2 : 7;
              const sealY = (cardH - sealSize) / 2;

              // Multi-line name wrapping calculation
              const textLeft = sealX + sealSize + 6;
              const availableTextW = Math.max(20, cardW - textLeft - (tier === 'star' ? 18 : 6));
              const maxCharsPerLine = Math.max(6, Math.floor(availableTextW / 7.2));

              // Wrap name into up to 2 lines
              const wrapNameWords = (fullName: string, limitPerLine: number): string[] => {
                const words = fullName.split(/\s+/);
                const lines: string[] = [];
                let curr = '';

                for (let i = 0; i < words.length; i++) {
                  const w = words[i];
                  if (!curr) {
                    curr = w;
                  } else if ((curr + ' ' + w).length <= limitPerLine) {
                    curr += ' ' + w;
                  } else {
                    lines.push(curr);
                    curr = w;
                    if (lines.length === 1) {
                      // Second line gets remaining words (with truncation if too long)
                      const rest = words.slice(i).join(' ');
                      if (rest.length > limitPerLine) {
                        lines.push(rest.slice(0, Math.max(3, limitPerLine - 1)) + '…');
                      } else {
                        lines.push(rest);
                      }
                      curr = '';
                      break;
                    }
                  }
                }
                if (curr && lines.length < 2) {
                  if (curr.length > limitPerLine) {
                    lines.push(curr.slice(0, Math.max(3, limitPerLine - 1)) + '…');
                  } else {
                    lines.push(curr);
                  }
                }
                return lines;
              };

              const nameLines = isUltraNarrow ? [] : wrapNameWords(displayName, maxCharsPerLine);

              // Background & border styling using theme variables
              const bgFill = tier === 'star'
                ? 'url(#star-card-grad)'
                : isHovered
                ? 'hsl(var(--muted))'
                : 'hsl(var(--card))';

              const borderStroke = isSelected
                ? '#C9A94E'
                : tier === 'star'
                ? '#C9A94E'
                : tier === 'notable'
                ? isHovered
                  ? sealColor
                  : 'rgba(201, 169, 78, 0.4)'
                : isHovered
                ? 'hsl(var(--foreground))'
                : 'hsl(var(--border))';

              const strokeWidth = isSelected ? 2.5 : tier === 'star' ? 1.8 : 1;

              // LOD and metadata visibility
              const showText = lod !== 'low' || tier !== 'regular';
              const showSubtitle = (tier !== 'regular' || isHovered) && isStandard && lifespanLabel && cardH >= 44 && nameLines.length === 1;
              const showHook = isHovered && hook && cardW >= 160 && tier !== 'regular' && nameLines.length === 1;

              // Vertical positions for name lines
              const lineCount = nameLines.length;
              const startNameY = showSubtitle
                ? 17
                : lineCount === 2
                ? (cardH / 2) - 3
                : (cardH / 2) + 4;

              return (
                <g
                  key={n.id}
                  transform={`translate(${n.x}, ${n.y})`}
                  className="cursor-pointer select-none"
                  onClick={() => onPersonSelect(person)}
                  onMouseEnter={() => setHoveredSlug(person.slug)}
                  onMouseLeave={() => setHoveredSlug(null)}
                  opacity={isDimmed ? 0.35 : 1}
                  filter={tier === 'star' && !isDimmed ? 'url(#star-card-glow)' : undefined}
                >
                  {/* Card base background */}
                  <rect
                    x={0}
                    y={0}
                    width={cardW}
                    height={cardH}
                    rx={10}
                    fill={bgFill}
                    stroke={borderStroke}
                    strokeWidth={strokeWidth}
                  />

                  {/* Star mark for Star tier */}
                  {tier === 'star' && cardW >= 60 && (
                    <text
                      x={cardW - 10}
                      y={14}
                      textAnchor="middle"
                      fill="#C9A94E"
                      fontSize={11}
                      fontWeight="bold"
                      className="pointer-events-none select-none"
                    >
                      ★
                    </text>
                  )}

                  {/* Generative Seal SVG rendered natively */}
                  <g
                    transform={`translate(${sealX}, ${sealY}) scale(${sealScale})`}
                    className="pointer-events-none"
                  >
                    <path
                      d={geo.pathD}
                      fill={`${sealColor}28`}
                      stroke={sealColor}
                      strokeWidth={3.5}
                      strokeLinejoin="round"
                    />
                    <circle cx={50} cy={50} r={geo.centerRadius} fill={sealColor} />
                    {geo.strokes.map((st, i) => (
                      <line
                        key={i}
                        x1={st.x1}
                        y1={st.y1}
                        x2={st.x2}
                        y2={st.y2}
                        stroke={sealColor}
                        strokeWidth={3}
                        strokeLinecap="round"
                        opacity={0.9}
                      />
                    ))}
                  </g>

                  {/* Card Text & Metadata (when width allows) */}
                  {!isUltraNarrow && showText && (
                    <g
                      transform={`translate(${textLeft}, 0)`}
                      className="pointer-events-none"
                    >
                      {/* Name lines */}
                      {nameLines.map((line, lIdx) => (
                        <text
                          key={lIdx}
                          x={0}
                          y={startNameY + lIdx * 12.5}
                          dominantBaseline={lineCount === 1 && !showSubtitle ? 'middle' : 'auto'}
                          style={{
                            fontFamily:
                              tier === 'regular'
                                ? "'Inter', sans-serif"
                                : "'Fraunces', Georgia, serif",
                            fontWeight: tier === 'regular' ? 500 : 600,
                            fontSize: tier === 'star' ? '12.5px' : tier === 'notable' ? '11.5px' : '11px',
                          }}
                          fill="hsl(var(--foreground))"
                        >
                          {line}
                        </text>
                      ))}

                      {/* Lifespan / Generation Subtitle */}
                      {showSubtitle && (
                        <text
                          x={0}
                          y={33}
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: '9.5px',
                            fontWeight: tier === 'star' ? 600 : 400,
                          }}
                          fill={tier === 'star' ? '#C9A94E' : 'hsl(var(--muted-foreground))'}
                        >
                          {lifespanLabel}
                        </text>
                      )}

                      {/* Hook text line on hover */}
                      {showHook && (
                        <text
                          x={0}
                          y={44}
                          style={{
                            fontFamily: "'Inter', sans-serif",
                            fontSize: '9px',
                            fontStyle: 'italic',
                          }}
                          fill="hsl(var(--muted-foreground))"
                        >
                          {hook.length > 25 ? hook.slice(0, 24) + '…' : hook}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              );
            })}
          </g>

        </svg>
      </div>

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
