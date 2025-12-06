import { Period, TimelinePerson } from '@/types/timeline';

export interface PersonLayout {
  slug: string;
  x: number;
  y: number;
  width: number;
  tier: number;
  startYear?: number;
  endYear?: number;
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
const H_MARGIN = 18;
const V_MARGIN = 10;
const GROUP_HEADER = 22;
const GROUP_PADDING = 12;
const GROUP_GAP = 16;
const BLOCK_HEADER = 44;
const BLOCK_PADDING_Y = 20;
const MIN_PERIOD_WIDTH = 0;
const BLOCK_TOP = 96;
const MIN_BAR_WIDTH = 120;
const ROW_GAP = 28;
const CARD_PADDING_X = 20;

function getPersonBounds(person: TimelinePerson): { start: number; end: number } {
  const rawStart = person.birthYear ?? person.lifespan_range?.start ?? person.flouritYear;
  const rawEnd = person.deathYear ?? person.lifespan_range?.end;

  if (rawStart !== undefined && rawEnd !== undefined && rawStart < rawEnd) {
    return { start: rawStart, end: rawEnd };
  }
  if (rawStart !== undefined) {
    return { start: rawStart, end: rawStart + 40 };
  }
  if (rawEnd !== undefined) {
    return { start: rawEnd - 40, end: rawEnd };
  }
  return { start: -3000, end: -2900 };
}

function resolveGeneration(person: TimelinePerson): number | undefined {
    if (person.generation) return person.generation;
    const match = (person.subPeriod || '').toLowerCase().match(/gen(\d+)/);
    if (match) return Number(match[1]);
    return undefined;
}

function buildBinPackedLayouts(
  people: TimelinePerson[],
  yearToX: (year: number) => number,
  xOffset = 0,
  periodWidth: number,
): { layouts: PersonLayout[]; rowsCount: number } {
  if (!people.length) return { layouts: [], rowsCount: 0 };

  const sorted = [...people].sort((a, b) => {
    const aStart = getPersonBounds(a).start;
    const bStart = getPersonBounds(b).start;
    if (aStart !== bStart) return aStart - bStart;
    const aEnd = getPersonBounds(a).end;
    const bEnd = getPersonBounds(b).end;
    return aEnd - bEnd;
  });

  const layouts: PersonLayout[] = [];

  sorted.forEach((person, index) => {
    const { start, end } = getPersonBounds(person);

    const xStartRaw = yearToX(start) - xOffset;
    const xEndRaw = yearToX(end) - xOffset;

    const xStart_initial = Math.max(0, xStartRaw);
    const xEnd_initial = Math.min(periodWidth, xEndRaw);

    const width = Math.max(MIN_BAR_WIDTH, xEnd_initial - xStart_initial);
    const xStart = Math.max(0, Math.min(xStart_initial, periodWidth - width - CARD_PADDING_X));
    const rowIndex = index;

    layouts.push({
      slug: person.slug,
      x: xStart + CARD_PADDING_X,
      y: GROUP_HEADER + 10 + rowIndex * (TRACK_HEIGHT + V_MARGIN),
      width,
      tier: rowIndex,
      startYear: start,
      endYear: end,
    });
  });

  return { layouts, rowsCount: sorted.length };
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
    const { layouts, rowsCount } = buildBinPackedLayouts(people, yearToX, yearToX(period.startYear), periodWidth);
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
    const periodWidth = Math.max(width, MIN_PERIOD_WIDTH);
    
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