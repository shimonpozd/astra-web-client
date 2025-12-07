import { Period, TimelinePerson } from '@/types/timeline';

export interface PersonLayout {
  slug: string;
  x: number;
  y: number;
  width: number;
  tier: number;
  startYear?: number;
  endYear?: number;
  isFuzzy?: boolean;
}

export interface GroupLayout {
  id: string;
  label: string;
  people: TimelinePerson[];
  personsLayout: PersonLayout[];
  height: number;
  y: number;
}

export interface RowLayout {
  id:string;
  label: string;
  groups: GroupLayout[];
  height: number;
  y: number;
}

export interface PeriodBlock {
  id: string;
  period: Period;
  x: number;
  width: number;
  y: number;
  height: number;
  rows: RowLayout[];
}

interface BuildParams {
  people: TimelinePerson[];
  periods: Period[];
  yearToX: (year: number) => number;
}

// Layout constants
const TRACK_HEIGHT = 56;
const H_MARGIN = 12;
const V_MARGIN = 8;
const GROUP_HEADER = 22;
const GROUP_PADDING = 12;
const GROUP_GAP = 16;
const BLOCK_HEADER = 44;
const BLOCK_PADDING_Y = 20;
const MIN_PERIOD_WIDTH = 0;
const BLOCK_TOP = 96;
const MIN_BAR_WIDTH = 120;
const ROW_GAP = 28;
const CARD_PADDING_X = 12;
const TORAH_STEP_PX = 150;

function resolveGeneration(person: TimelinePerson, period?: Period): number | undefined {
  if (person.generation) return person.generation;
  const match = (person.subPeriod || '').toLowerCase().match(/gen(\d+)/);
  if (match) return Number(match[1]);
  const sub = period?.subPeriods?.find((sp) => sp.id === person.subPeriod);
  if (sub?.generation) return sub.generation;
  return undefined;
}

function normalizePersonDates(person: TimelinePerson, period?: Period): { start: number; end: number; isFuzzy: boolean } {
  const rawStart = person.birthYear ?? person.lifespan_range?.start ?? person.flouritYear;
  const rawEnd = person.deathYear ?? person.lifespan_range?.end;
  const gen = resolveGeneration(person, period);

  if (rawStart !== undefined && rawEnd !== undefined && rawStart < rawEnd) {
    return { start: rawStart, end: rawEnd, isFuzzy: false };
  }
  if (rawStart !== undefined) {
    return { start: rawStart, end: rawStart + 40, isFuzzy: true };
  }
  if (rawEnd !== undefined) {
    return { start: rawEnd - 40, end: rawEnd, isFuzzy: true };
  }

  // Спец-логика для Торы: фиксированный шаг по поколениям, чтобы поколение N всегда правее N-1
  if (period?.id === 'torah') {
    const g = gen ?? 1; // если поколение не указано — считаем его первым, чтобы не уезжать вправо
    const estStart = period.startYear + (g - 1) * 40;
    const estEnd = estStart + 80; // делаем длиннее по умолчанию, чтобы ощущалась длительная жизнь патриархов
    return { start: estStart, end: estEnd, isFuzzy: true };
  }

  if (period && gen) {
    const span = period.endYear - period.startYear;
    const estStart = period.startYear + (gen - 1) * Math.max(30, Math.min(60, span / Math.max(1, gen)));
    const estEnd = estStart + 60;
    return { start: estStart, end: estEnd, isFuzzy: true };
  }

  if (period) {
    const mid = (period.startYear + period.endYear) / 2;
    return { start: mid - 40, end: mid + 40, isFuzzy: true };
  }

  return { start: -3000, end: -2900, isFuzzy: true };
}

function buildBinPackedLayouts(
  people: TimelinePerson[],
  period: Period,
  yearToX: (year: number) => number,
  xOffset = 0,
  periodWidth: number,
): { layouts: PersonLayout[]; rowsCount: number } {
  if (!people.length) return { layouts: [], rowsCount: 0 };

  const sorted = [...people].sort((a, b) => {
    if (period.id === 'torah') {
      const ga = resolveGeneration(a, period) ?? 0;
      const gb = resolveGeneration(b, period) ?? 0;
      if (ga !== gb) return ga - gb;
    }
    const aStart = normalizePersonDates(a, period).start;
    const bStart = normalizePersonDates(b, period).start;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = normalizePersonDates(a, period).end;
    const bEnd = normalizePersonDates(b, period).end;
    return aEnd - bEnd;
  });

  const layouts: PersonLayout[] = [];
  const trackEnds: number[] = []; // в px относительно периода

  sorted.forEach((person) => {
    const { start, end, isFuzzy } = normalizePersonDates(person, period);

    let xStartRaw: number;
    let xEndRaw: number;

    if (period.id === 'torah') {
      // Дискретный шаг по поколениям для Торы
      const g = resolveGeneration(person, period) ?? 1;
      const STEP = TORAH_STEP_PX;
      const estStartPx = (g - 1) * STEP;
      xStartRaw = estStartPx;
      xEndRaw = estStartPx + Math.max(MIN_BAR_WIDTH, STEP * 0.8);
    } else {
      xStartRaw = yearToX(start) - xOffset;
      xEndRaw = yearToX(end) - xOffset;
    }

    const xStart_initial = Math.max(0, xStartRaw);
    const xEnd_initial = Math.min(periodWidth, xEndRaw);

    const width = Math.max(MIN_BAR_WIDTH, xEnd_initial - xStart_initial);
    const xStart = Math.max(0, Math.min(xStart_initial, periodWidth - width - CARD_PADDING_X));

    // Greedy packing: ищем первый трек без пересечения по X
    let trackIndex = trackEnds.findIndex((endPx) => xStart > endPx + H_MARGIN);
    if (trackIndex === -1) {
      trackIndex = trackEnds.length;
      trackEnds.push(xStart + width);
    } else {
      trackEnds[trackIndex] = xStart + width;
    }

    layouts.push({
      slug: person.slug,
      x: xStart + CARD_PADDING_X,
      y: GROUP_HEADER + 10 + trackIndex * (TRACK_HEIGHT + V_MARGIN),
      width,
      tier: trackIndex,
      startYear: start,
      endYear: end,
      isFuzzy,
    });
  });

  return { layouts, rowsCount: trackEnds.length };
}

function createGroupLayout(
    id: string,
    label: string,
    people: TimelinePerson[],
    yOffset: number,
    period: Period,
    yearToX: (year: number) => number,
    periodWidth: number
): GroupLayout {
    const { layouts, rowsCount } = buildBinPackedLayouts(people, period, yearToX, yearToX(period.startYear), periodWidth);
    const groupBodyHeight = rowsCount > 0 ? rowsCount * (TRACK_HEIGHT + V_MARGIN) - V_MARGIN : 0;
    const groupHeight = GROUP_HEADER + GROUP_PADDING * 2 + groupBodyHeight;

    return {
        id,
        label,
        people,
        personsLayout: layouts,
        height: groupHeight,
        y: yOffset,
    };
}


export function buildTimelineBlocks({ people, periods, yearToX }: BuildParams): PeriodBlock[] {
  const peopleByPeriod: Record<string, TimelinePerson[]> = {};
  periods.forEach(p => { peopleByPeriod[p.id] = [] });
  people.forEach(p => {
    if (p.period && peopleByPeriod[p.period]) {
      peopleByPeriod[p.period].push(p);
    }
  });

  const unslotted = periods.map(period => {
    const periodPeople = peopleByPeriod[period.id] ?? [];
    const x = yearToX(period.startYear);
    const width = yearToX(period.endYear) - x;
    let periodWidth: number;
    if (period.id === 'torah') {
      const maxGen = periodPeople.reduce((acc, p) => {
        const g = resolveGeneration(p, period);
        return g && g > acc ? g : acc;
      }, 0) || 10; // если нет данных, считаем хотя бы 10 шагов
      periodWidth = Math.max(MIN_PERIOD_WIDTH, TORAH_STEP_PX * (maxGen + 2));
    } else {
      periodWidth = Math.max(width, MIN_PERIOD_WIDTH);
    }
    
    let groups: GroupLayout[] = [];
    let groupCursorY = 0;

    if (period.id === 'malakhim_divided') {
        const israel = periodPeople.filter((p) => (p.subPeriod || '').toLowerCase().includes('israel'));
        const judah = periodPeople.filter((p) => (p.subPeriod || '').toLowerCase().includes('judah'));
        const other = periodPeople.filter((p) => !(p.subPeriod || '').toLowerCase().includes('israel') && !(p.subPeriod || '').toLowerCase().includes('judah'));
        
        const malakhimGroups: {label: string, people: TimelinePerson[]}[] = [
            { label: 'Царство Израиль', people: israel },
            { label: 'Царство Иуда', people: judah },
            { label: 'Прочие', people: other },
        ];

        malakhimGroups.forEach(({label, people: groupPeople}) => {
            if(groupPeople.length === 0) return;
            const group = createGroupLayout(`${period.id}-${label.toLowerCase()}`, label, groupPeople, groupCursorY, period, yearToX, periodWidth);
            groups.push(group);
            groupCursorY += group.height + GROUP_GAP;
        });

    } else if (period.id === 'torah') {
        // Стратегия GENEALOGY упрощенная: одна группа на линию, без деления по поколениям
        const lineageOrder = [
          { id: 'preflood_root', label: 'Линия Адама' },
          { id: 'preflood_cain', label: 'Линия Каина' },
          { id: 'preflood_seth', label: 'Линия Шета' },
          { id: 'postflood_root', label: 'Линия Ноя' },
          { id: 'postflood_line_shem', label: 'Линия Шема' },
          { id: 'postflood_line_ham', label: 'Линия Хама' },
          { id: 'postflood_line_japheth', label: 'Линия Яфета' },
          { id: 'other', label: 'Прочие' },
        ];
        const buckets: Record<string, TimelinePerson[]> = {};
        lineageOrder.forEach((l) => { buckets[l.id] = []; });

        periodPeople.forEach((p) => {
          const sub = (p.subPeriod || '').toLowerCase();
          const key =
            sub.startsWith('preflood_root') ? 'preflood_root' :
            sub.startsWith('preflood_cain') ? 'preflood_cain' :
            sub.startsWith('preflood_seth') ? 'preflood_seth' :
            sub.startsWith('postflood_root') ? 'postflood_root' :
            sub.startsWith('postflood_line_shem') ? 'postflood_line_shem' :
            sub.startsWith('postflood_line_ham') ? 'postflood_line_ham' :
            sub.startsWith('postflood_line_japheth') ? 'postflood_line_japheth' :
            'other';
          if (!buckets[key]) buckets[key] = [];
          buckets[key].push(p);
        });

        lineageOrder.forEach(({id, label}) => {
          const list = buckets[id] || [];
          if (!list.length) return;
          const group = createGroupLayout(`${period.id}-${id}`, label, list, groupCursorY, period, yearToX, periodWidth);
          groups.push(group);
          groupCursorY += group.height + GROUP_GAP;
        });

    } else {
        const peopleByGeneration: Record<string, TimelinePerson[]> = {};
        periodPeople.forEach(p => {
            const gen = resolveGeneration(p) ?? 'unknown';
            if (!peopleByGeneration[gen]) peopleByGeneration[gen] = [];
            peopleByGeneration[gen].push(p);
        });

        const generationKeys = Object.keys(peopleByGeneration).sort((a, b) => {
            if (a === 'unknown') return 1; if (b === 'unknown') return -1;
            return Number(a) - Number(b);
        });

        generationKeys.forEach(key => {
            const generationPeople = peopleByGeneration[key];
            if (generationPeople.length === 0) return;

            const label = key === 'unknown' ? 'Неизвестное поколение' : `Поколение ${key}`;
            const group = createGroupLayout(`${period.id}-gen-${key}`, label, generationPeople, groupCursorY, period, yearToX, periodWidth);
            groups.push(group);
            groupCursorY += group.height + GROUP_GAP;
        });
    }

    const rowHeight = groupCursorY > 0 ? groupCursorY - GROUP_GAP : 0;
    const row: RowLayout = {
      id: `${period.id}-main-row`,
      label: 'Main',
      groups: groups,
      height: rowHeight,
      y: BLOCK_HEADER + BLOCK_PADDING_Y,
    };
    
    const blockHeight = BLOCK_HEADER + BLOCK_PADDING_Y * 2 + rowHeight;
    
    const periodBlock: PeriodBlock = {
      id: period.id,
      period,
      x,
      width: periodWidth,
      y: 0, // Y will be assigned next
      height: blockHeight,
      rows: [row],
    };
    return periodBlock;
  });

  const sorted = unslotted.sort((a, b) => a.period.startYear - b.period.startYear);
  
  let cursorY = BLOCK_TOP;
  sorted.forEach((block) => {
    block.y = cursorY;
    cursorY += block.height + ROW_GAP;
  });

  return sorted;
}
