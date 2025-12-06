import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Period, TimelinePerson } from '@/types/timeline';
import { buildTimelineBlocks, PeriodBlock, PersonLayout } from '@/utils/layoutEngine';
import { getPeriodColor } from '@/utils/timelineColors';
import { buildTickMarks } from '@/utils/dateCalculations';
import { Minimap } from './Minimap';

interface TimelineProps {
  people: TimelinePerson[];
  periods: Period[];
  minYear: number;
  maxYear: number;
  zoom: number;
  onZoomChange: (z: number) => void;
  selectedPersonSlug?: string | null;
  onPersonSelect: (p: TimelinePerson) => void;
}

const BASE_PX_PER_YEAR = 3;
const GROUP_HEADER = 20;
const PERIOD_HEADER = 32;

function PersonCard({
  person,
  layout,
  onSelect,
  isSelected,
}: {
  person: TimelinePerson;
  layout: PersonLayout;
  onSelect: (p: TimelinePerson) => void;
  isSelected: boolean;
}) {
  const title = person.name_ru || person.name_en || person.slug;
  const displayName = person.name_ru || (person as any).display?.name_ru || title;
  const start = person.birthYear ?? person.lifespan_range?.start;
  const end = person.deathYear ?? person.lifespan_range?.end;
  const age = start !== undefined && end !== undefined ? end - start : undefined;
  const lifespanLabel = start !== undefined && end !== undefined ? `${start}–${end}${age ? ` • ~${age} лет` : ''}` : person.lifespan ?? '';
  const cardWidth = Math.max(layout.width, 60);

  return (
    <button
      type="button"
      className={cn(
        'absolute rounded-md border bg-white/80 px-2 py-1 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:bg-slate-900/70',
        isSelected ? 'ring-2 ring-primary ring-offset-1' : 'border-border/70',
      )}
      style={{ left: layout.x, top: layout.y, width: cardWidth }}
      onClick={() => onSelect(person)}
      title={title}
    >
      <div className="space-y-0.5">
        <div className="text-[12px] font-semibold leading-tight line-clamp-2">{displayName}</div>
        <div className="text-[11px] text-muted-foreground line-clamp-1">{person.name_en || (person as any).title_en || person.slug}</div>
        {lifespanLabel && <div className="text-[10px] text-muted-foreground">{lifespanLabel}</div>}
      </div>
    </button>
  );
}

export function Timeline({
  people,
  periods,
  minYear,
  maxYear,
  zoom,
  onZoomChange,
  selectedPersonSlug,
  onPersonSelect,
}: TimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewWindow, setViewWindow] = useState<{ start: number; end: number }>({ start: minYear, end: minYear + (maxYear - minYear) * 0.2 });

  const pxPerYear = BASE_PX_PER_YEAR * zoom;
  const yearToX = (year: number) => (year - minYear) * pxPerYear;
  const timelineWidth = (maxYear - minYear) * pxPerYear;

  // Always render full set to avoid empty states
  const lodPeople = people;

  const blocks = useMemo<PeriodBlock[]>(() => buildTimelineBlocks({ people: lodPeople, periods, yearToX }), [lodPeople, periods, yearToX]);

  const maxHeight = useMemo(() => {
    if (!blocks.length) return 400;
    const maxY = Math.max(...blocks.map((b) => b.y + b.height));
    return maxY + 120;
  }, [blocks]);

  const ticks = useMemo(() => {
    const span = Math.abs(maxYear - minYear);
    const step = span > 2000 ? 200 : span > 1200 ? 100 : 50;
    return buildTickMarks(minYear, maxYear, step);
  }, [minYear, maxYear]);

  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handler = () => {
      const start = minYear + node.scrollLeft / pxPerYear;
      const end = start + node.clientWidth / pxPerYear;
      setViewWindow({ start, end });
    };
    handler();
    node.addEventListener('scroll', handler);
    return () => node.removeEventListener('scroll', handler);
  }, [minYear, pxPerYear]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-xl border border-border/60 bg-muted/40">
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-6 border-b border-border/60 bg-card/70 px-4 py-2">
        {ticks.map((t) => (
          <div key={t} className="text-[11px] font-semibold text-muted-foreground" style={{ marginLeft: yearToX(t) }}>
            {t}
          </div>
        ))}
        <div className="ml-auto text-[11px] text-muted-foreground">Zoom: {zoom.toFixed(2)}x</div>
      </div>

      <div ref={scrollRef} className="absolute inset-0 overflow-x-auto overflow-y-auto pt-10">
        <div className="relative" style={{ width: timelineWidth, height: maxHeight }}>
          {blocks.map((block) => {
            const periodColor = getPeriodColor(periods, block.period.id);
            return (
              <div
                key={block.period.id}
                className="absolute rounded-xl border border-border/70 bg-white/70 p-3 shadow-sm backdrop-blur-sm dark:bg-slate-900/70"
                style={{ left: block.x, top: block.y, width: block.width, height: block.height }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-bold" style={{ color: periodColor }}>
                    {block.period.name_ru}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {block.period.startYear} — {block.period.endYear}
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {block.rows.map((row) => {
                    return (
                      <div key={row.id} className="relative" style={{ minHeight: row.height }}>
                        <div className="text-[12px] font-semibold text-slate-600 dark:text-slate-200 mb-1">{row.label}</div>
                        <div className="relative" style={{ height: row.height - GROUP_HEADER }}>
                          {row.groups.reduce<{ accTop: number; nodes: React.ReactNode[] }>(
                            (acc, group) => {
                              const node = (
                                <div
                                  key={group.id}
                                  className="absolute border border-border/50 rounded-md bg-background/60 p-1 w-full"
                                  style={{ top: acc.accTop, minHeight: group.height }}
                                >
                                  <div className="text-[11px] font-semibold text-muted-foreground px-1">{group.label}</div>
                                  <div className="relative" style={{ height: group.height }}>
                                    {group.personsLayout.map((pl) => {
                                      const person = group.people.find((p) => p.slug === pl.slug);
                                      if (!person) return null;
                                  return (
                                    <PersonCard
                                      key={person.slug}
                                      person={person}
                                      layout={pl}
                                      onSelect={onPersonSelect}
                                      isSelected={selectedPersonSlug === person.slug}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                              );
                              return { accTop: acc.accTop + group.height + GROUP_HEADER, nodes: [...acc.nodes, node] };
                            },
                            { accTop: 0, nodes: [] },
                          ).nodes}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Minimap
        people={people}
        minYear={minYear}
        maxYear={maxYear}
        viewStart={viewWindow.start}
        viewEnd={viewWindow.end}
        onBrush={(start, end) => {
          const node = scrollRef.current;
          if (!node) return;
          const desiredLeft = (start - minYear) * pxPerYear;
          node.scrollTo({ left: desiredLeft, behavior: 'smooth' });
          onZoomChange(zoom);
        }}
      />
    </div>
  );
}
