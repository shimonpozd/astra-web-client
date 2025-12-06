import { useEffect, useMemo, useRef, useState } from 'react';
import { Period, TimelinePerson } from '@/types/timeline';
import { buildTimelineBlocks, PeriodBlock } from '@/utils/layoutEngine';
import { getPeriodColor } from '@/utils/timelineColors';
import { Minimap } from './Minimap';

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

export function TimelineCanvas({
  people,
  periods,
  minYear,
  maxYear,
  focusYear,
  onPersonSelect,
  selectedPersonSlug,
}: TimelineCanvasProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [view, setView] = useState<{ start: number; end: number }>({ start: minYear, end: minYear + (maxYear - minYear) * 0.2 });
  const pxPerYear = BASE_PX_PER_YEAR * zoom;
  const yearToX = (year: number) => (year - minYear) * pxPerYear;
  const timelineWidth = (maxYear - minYear) * pxPerYear;
  const [lod, setLod] = useState<LOD>('medium');

  const blocks: PeriodBlock[] = useMemo(
    () => buildTimelineBlocks({ people, periods, yearToX }),
    [people, periods, yearToX],
  );

  useEffect(() => {
    const s = zoom;
    setLod(s < 0.8 ? 'low' : s < 2 ? 'medium' : 'high');
  }, [zoom]);

  // focus scroll to specific year
  useEffect(() => {
    if (focusYear == null) return;
    const node = scrollRef.current;
    if (!node) return;
    const targetLeft = yearToX(focusYear) - node.clientWidth / 2;
    node.scrollTo({ left: targetLeft, behavior: 'smooth' });
  }, [focusYear, yearToX]);

  // sync view window for minimap
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const handler = () => {
      const start = minYear + node.scrollLeft / pxPerYear;
      const end = start + node.clientWidth / pxPerYear;
      setView({ start, end });
    };
    handler();
    node.addEventListener('scroll', handler);
    return () => node.removeEventListener('scroll', handler);
  }, [minYear, pxPerYear]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom((prev) => Math.min(4, Math.max(0.5, prev * factor)));
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-50 dark:bg-slate-900/80">
      <div
        ref={scrollRef}
        className="absolute inset-0 overflow-x-auto overflow-y-auto"
        onWheel={handleWheel}
      >
        <div
          className="relative"
          style={{
            width: timelineWidth,
            height: (blocks.length ? Math.max(...blocks.map((b) => b.y + b.height)) : 400) + 200,
          }}
        >
          {blocks.map((block) => {
            const color = getPeriodColor(periods, block.period.id);
            const showPeople = lod !== 'low';
            return (
              <div
                key={block.id}
                className="absolute rounded-xl border border-border/70 bg-white/70 p-3 shadow-sm backdrop-blur-sm dark:bg-slate-900/70"
                style={{ left: block.x, top: block.y, width: block.width, height: block.height }}
              >
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-sm font-bold" style={{ color }}>
                    {block.period.name_ru}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {block.period.startYear} — {block.period.endYear}
                  </div>
                </div>
                {lod === 'low' ? null : (
                  <div className="flex flex-col gap-2">
                    {block.rows.map((row) => {
                      let accTop = 0;
                      return (
                        <div key={row.id} className="relative" style={{ minHeight: row.height }}>
                          <div className="text-[12px] font-semibold text-slate-600 dark:text-slate-200 mb-1">{row.label}</div>
                          {row.groups.map((group) => {
                            const top = accTop;
                            accTop += group.height + 12;
                            const hasLayouts = Array.isArray(group.personsLayout) && group.personsLayout.length > 0;
                            return (
                              <div
                                key={group.id}
                                className="absolute inset-x-0 border border-border/50 rounded-md bg-background/60 p-1"
                                style={{ top, minHeight: group.height }}
                              >
                                <div className="text-[11px] font-semibold text-muted-foreground px-1">{group.label}</div>
                                {showPeople && hasLayouts && (
                                  <div className="relative" style={{ height: group.height }}>
                                    {group.personsLayout!.map((pl) => {
                                      const person = group.people.find((p) => p.slug === pl.slug);
                                      if (!person) return null;
                                      return (
                                        <button
                                          key={person.slug}
                                          className="absolute rounded-md border bg-white/80 px-2 py-1 text-left shadow-sm text-[12px] leading-tight hover:-translate-y-0.5 hover:shadow-md transition"
                                          style={{ left: pl.x, top: pl.y, width: Math.max(pl.width, 110) }}
                                          onClick={() => onPersonSelect(person)}
                                        >
                                          <div className="font-semibold line-clamp-2">{person.name_ru || person.name_en || person.slug}</div>
                                          <div className="text-[11px] text-muted-foreground">{person.lifespan || `${person.birthYear ?? ''}—${person.deathYear ?? ''}`}</div>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {showPeople && !hasLayouts && (
                                  <div className="flex flex-wrap gap-2 p-1">
                                    {group.people.map((person) => (
                                      <button
                                        key={person.slug}
                                        className="rounded-md border bg-white/80 px-2 py-1 text-left shadow-sm text-[12px] leading-tight hover:-translate-y-0.5 hover:shadow-md transition min-w-[120px]"
                                        onClick={() => onPersonSelect(person)}
                                      >
                                        <div className="font-semibold line-clamp-2">{person.name_ru || person.name_en || person.slug}</div>
                                        <div className="text-[11px] text-muted-foreground">{person.lifespan || `${person.birthYear ?? ''}—${person.deathYear ?? ''}`}</div>
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Minimap
        people={people}
        minYear={minYear}
        maxYear={maxYear}
        viewStart={view.start}
        viewEnd={view.end}
        onBrush={(start, end) => {
          const node = scrollRef.current;
          if (!node) return;
          const viewport = node.clientWidth;
          const desiredScale = Math.min(4, Math.max(0.5, viewport / ((end - start) * BASE_PX_PER_YEAR)));
          setZoom(desiredScale);
          const desiredLeft = (start - minYear) * BASE_PX_PER_YEAR * desiredScale;
          node.scrollTo({ left: desiredLeft, behavior: 'smooth' });
        }}
      />
    </div>
  );
}
