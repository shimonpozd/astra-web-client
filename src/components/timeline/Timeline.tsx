// DEPRECATED: Legacy HTML timeline. Use TimelineCanvas exclusively.
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Period, TimelinePerson } from '@/types/timeline';
import { buildTimelineBlocks, PeriodBlock, PersonLayout } from '@/utils/layoutEngine';
import { getPeriodColor, generateColorSystem } from '@/utils/timelineColors';
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
const GROUP_HEADER = 24; // Обновлено для соответствия layoutEngine
const PERIOD_HEADER = 40;

function groupBg(id: string): string {
  if (id.startsWith('preflood_cain')) return 'bg-rose-50/80 dark:bg-rose-900/30';
  if (id.startsWith('preflood_seth')) return 'bg-emerald-50/80 dark:bg-emerald-900/30';
  if (id.startsWith('flood_line_shem')) return 'bg-teal-50/80 dark:bg-teal-900/30';
  if (id.startsWith('flood_line_ham')) return 'bg-amber-50/80 dark:bg-amber-900/30';
  if (id.startsWith('flood_line_japheth')) return 'bg-sky-50/80 dark:bg-sky-900/30';
  return 'bg-muted/30 dark:bg-muted/20';
}

export function PersonCard({
  person,
  layout,
  onSelect,
  isSelected,
  periodColor,
  period,
}: {
  person: TimelinePerson;
  layout: PersonLayout;
  onSelect: (p: TimelinePerson) => void;
  isSelected: boolean;
  periodColor: string;
  period?: Period;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const nameRu = person.name_ru || (person as any).display?.name_ru;
  const nameEn = person.name_en || (person as any).title_en || person.slug;
  const displayNameRu = nameRu || nameEn;
  const displayNameEn = nameRu ? nameEn : undefined; // Показываем английское только если есть русское
  
  const start = person.birthYear ?? person.lifespan_range?.start;
  const end = person.deathYear ?? person.lifespan_range?.end;
  const age = start !== undefined && end !== undefined && start !== null && end !== null ? end - start : undefined;
  
  // Формируем метку дат жизни, избегая "null null"
  let lifespanLabel = '';
  if (start !== undefined && start !== null && end !== undefined && end !== null) {
    lifespanLabel = `${start}–${end}${age !== undefined ? ` • ~${age} лет` : ''}`;
  } else if (person.lifespan) {
    lifespanLabel = person.lifespan;
  }
  
  // Полная информация для tooltip
  const fullInfo = [
    nameRu && nameEn ? `${nameRu} (${nameEn})` : displayNameRu,
    lifespanLabel,
    person.summary_html ? 'Есть описание' : undefined,
  ].filter(Boolean).join('\n');

  const CARD_WIDTH = Math.max(layout.width || 160, 120);
  const CARD_HEIGHT = 100;

  // Вычисляем цвет карточки на основе периода, поколения и региона
  const getCardColor = () => {
    // Базовый цвет периода
    let color = periodColor;
    
    // Если есть поколение, добавляем вариацию цвета
    const generation = person.generation || (period?.subPeriods?.find(sp => sp.id === person.subPeriod)?.generation);
    if (generation) {
      // Создаем вариацию цвета для поколения (слегка изменяем hue)
      const hueShift = (generation - 1) * 5; // Сдвиг hue на 5 градусов для каждого поколения
      // Парсим HSL из periodColor
      const hslMatch = periodColor.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        const hue = parseInt(hslMatch[1]) + hueShift;
        const saturation = parseInt(hslMatch[2]);
        const lightness = parseInt(hslMatch[3]);
        color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }
    }
    
    // Если есть регион, добавляем дополнительную вариацию
    const region = person.region || (period?.subPeriods?.find(sp => sp.id === person.subPeriod)?.region);
    if (region) {
      // Добавляем небольшой сдвиг lightness для регионов
      const hslMatch = color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (hslMatch) {
        const hue = parseInt(hslMatch[1]);
        const saturation = parseInt(hslMatch[2]);
        let lightness = parseInt(hslMatch[3]);
        // Разные регионы - разные оттенки lightness
        const regionShift = region === 'eretz_israel' ? 5 : region === 'babylonia' ? -5 : 0;
        lightness = Math.max(30, Math.min(70, lightness + regionShift));
        color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
      }
    }
    
    return color;
  };

  const cardColor = getCardColor();

  return (
    <div className="absolute group" style={{ left: layout.x, top: layout.y }}>
      <button
        type="button"
        className={cn(
          'relative rounded-lg border text-left shadow-sm transition-all duration-200',
          'hover:shadow-md',
          isSelected ? 'ring-2 ring-offset-1 ring-primary shadow-md' : 'ring-0',
          layout.isFuzzy ? 'border-dashed' : 'border-solid'
        )}
        style={{ 
          width: CARD_WIDTH, 
          height: CARD_HEIGHT,
          borderLeftColor: cardColor,
          borderLeftWidth: '4px',
          background: layout.isFuzzy
            ? `linear-gradient(90deg, transparent 0%, ${cardColor}33 20%, ${cardColor}66 50%, ${cardColor}33 80%, transparent 100%)`
            : 'hsl(var(--card))',
          borderColor: isSelected ? cardColor : 'hsl(var(--border))',
        }}
        onClick={() => onSelect(person)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        {/* Фон с цветом периода (с opacity) */}
        {!layout.isFuzzy && (
          <div 
            className="absolute inset-0 rounded-lg opacity-10 dark:opacity-15"
            style={{ backgroundColor: cardColor }}
          />
        )}
        
        {/* Содержимое карточки */}
        <div className="relative h-full flex flex-col p-3">
          {/* Русское имя - крупное сверху */}
          <div className="flex-1 flex items-start">
            <div 
              className="text-sm font-semibold leading-tight line-clamp-2 break-words"
              style={{ color: 'hsl(var(--foreground))' }}
            >
              {displayNameRu}
            </div>
          </div>
          
          {/* Английское имя - мелкое снизу (только если есть русское) */}
          {displayNameEn && (
            <div className="mt-1">
              <div className="text-xs text-muted-foreground line-clamp-1">
                {displayNameEn}
              </div>
            </div>
          )}
          
          {/* Даты жизни - в самом низу */}
          {lifespanLabel && (
            <div className="mt-auto pt-1 border-t border-border/30">
              <div className="text-[10px] text-muted-foreground font-medium">
                {lifespanLabel}
              </div>
            </div>
          )}
        </div>

        {/* Индикатор выбора */}
        {isSelected && (
          <div 
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-background shadow-lg"
            style={{ backgroundColor: cardColor }}
          />
        )}
      </button>

      {/* Tooltip с полной информацией */}
      {showTooltip && (
        <div 
          className="absolute z-50 px-3 py-2 rounded-lg shadow-xl border bg-popover text-popover-foreground text-xs max-w-xs pointer-events-none"
          style={{ 
            left: '50%',
            top: 'calc(100% + 8px)',
            transform: 'translateX(-50%)',
          }}
        >
          <div className="whitespace-pre-line font-medium">{fullInfo}</div>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-popover border-l border-t" />
        </div>
      )}
    </div>
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

  // Прокрутка к выбранной персоне отключена, чтобы избежать смещения при открытии модального окна
  // Прокрутка будет происходить только при явном действии пользователя (например, через поиск)

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

      <div 
        ref={scrollRef} 
        className="absolute inset-0 overflow-x-auto overflow-y-auto pt-10 scroll-smooth"
        onWheel={(e) => {
          // Зум с Ctrl/Cmd
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.9 : 1.1;
            const newZoom = Math.min(4, Math.max(0.5, zoom * factor));
            onZoomChange(newZoom);
          }
        }}
      >
        <div className="relative" style={{ width: timelineWidth, height: maxHeight }}>
          {blocks.map((block) => {
            const periodColor = getPeriodColor(periods, block.period.id);
            return (
              <div
                key={block.period.id}
                className="absolute rounded-xl border-2 shadow-sm backdrop-blur-sm transition-all duration-200 hover:shadow-md overflow-hidden"
                style={{ 
                  left: block.x, 
                  top: block.y, 
                  width: block.width, 
                  height: block.height,
                  borderColor: periodColor,
                  backgroundColor: 'hsl(var(--card))',
                  boxShadow: `0 2px 4px -1px rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.06)`,
                }}
              >
                <div className="relative p-4">
                  <div className="mb-3 flex items-center justify-between pb-2 border-b border-border/50">
                    <div className="text-base font-bold" style={{ color: periodColor }}>
                      {block.period.name_ru}
                    </div>
                    <div className="text-xs text-muted-foreground font-medium px-2 py-1 rounded-md bg-muted/50">
                      {block.period.startYear} — {block.period.endYear}
                    </div>
                  </div>
                  <div className="flex flex-col gap-4 overflow-hidden">
                    {block.rows.map((row) => {
                      return (
                        <div key={row.id} className="relative overflow-hidden" style={{ minHeight: row.height }}>
                          {row.label && (
                            <div className="text-sm font-semibold text-foreground mb-2 px-1">
                              {row.label}
                            </div>
                          )}
                          <div className="relative" style={{ minHeight: row.height - (row.label ? GROUP_HEADER : 0) }}>
                            {row.groups.reduce<{ accTop: number; nodes: React.ReactNode[] }>(
                              (acc, group) => {
                                const node = (
                                  <div
                                    key={group.id}
                                    className={`absolute border border-border/40 rounded-lg p-2 w-full backdrop-blur-sm overflow-hidden ${groupBg(group.id)}`}
                                    style={{ top: acc.accTop, minHeight: group.height }}
                                  >
                                    {group.label && (
                                      <div className="text-xs font-semibold text-muted-foreground px-2 py-1 mb-2 border-b border-border/30">
                                        {group.label}
                                      </div>
                                    )}
                                    <div className="relative overflow-hidden" style={{ minHeight: group.height - (group.label ? GROUP_HEADER : 0) }}>
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
                                        periodColor={periodColor}
                                        period={block.period}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                                );
                                return { accTop: acc.accTop + group.height + GROUP_GAP, nodes: [...acc.nodes, node] };
                              },
                              { accTop: 0, nodes: [] },
                            ).nodes}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
