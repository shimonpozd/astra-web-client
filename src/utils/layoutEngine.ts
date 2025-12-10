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
  xOffset?: number;
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
const TORAH_COLUMN_WIDTH = TORAH_STEP_PX * 10; // фиксированная ширина колонки внутри Торы
// Для Шофтим держим компактный шаг: поколение идёт в фикcированном X-шаге, чтобы весь период не растягивался
const SHOFTIM_STEP_PX = 60;
const SHOFTIM_BAR_WIDTH = 80;
const GENERATION_COLUMN_WIDTH = 220;
const GRID_CARD_WIDTH = 140;
const GRID_COL_GAP = 40;
const GRID_COL_WIDTH = GRID_CARD_WIDTH + GRID_COL_GAP;
const HORIZONTAL_GAP = 80;
const STACK_GAP = 48;
const SECONDARY_TRACK_OFFSET = 800;

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
    // Если знаем только год смерти — фиксируем прямоугольник вправо от точки смерти,
    // чтобы не растягивать бар далеко в прошлое.
    return { start: rawEnd, end: rawEnd + 40, isFuzzy: true };
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
  xShift = 0,
): { layouts: PersonLayout[]; rowsCount: number } {
  if (!people.length) return { layouts: [], rowsCount: 0 };

  const minWidthForPeriod = period.id === 'malakhim_divided' ? 40 : MIN_BAR_WIDTH;

  const sorted = [...people].sort((a, b) => {
    if (period.id === 'torah') {
      const ga = resolveGeneration(a, period) ?? 0;
      const gb = resolveGeneration(b, period) ?? 0;
      if (ga !== gb) return ga - gb;
    }
    if (period.id === 'shoftim') {
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
      const estStartPx = (g - 1) * STEP + xShift;
      xStartRaw = estStartPx;
      xEndRaw = estStartPx + Math.max(MIN_BAR_WIDTH, STEP * 0.8);
    } else if (period.id === 'shoftim') {
      // Для Шофтим игнорируем даты: фиксированная ширина и шаг по поколению
      const g = resolveGeneration(person, period) ?? 1;
      const estStartPx = (g - 1) * SHOFTIM_STEP_PX;
      xStartRaw = estStartPx;
      xEndRaw = estStartPx + SHOFTIM_BAR_WIDTH;
    } else {
      xStartRaw = yearToX(start) - xOffset + xShift;
      xEndRaw = yearToX(end) - xOffset + xShift;
    }

    const xStart_initial = Math.max(0, xStartRaw);
    const xEnd_initial = Math.min(periodWidth, xEndRaw);

    const widthRaw = xEnd_initial - xStart_initial;
    const width = Math.max(minWidthForPeriod, widthRaw);
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
    periodWidth: number,
    xShift = 0,
    opts?: { grid?: boolean; cardWidth?: number; waterfall?: boolean; columnByGeneration?: boolean },
): GroupLayout {
    let layouts: PersonLayout[] = [];
    let rowsCount = 0;

    if (opts?.grid) {
      const cardW = opts.cardWidth ?? GRID_CARD_WIDTH;
      if (opts.columnByGeneration) {
        const byGen: Record<string, TimelinePerson[]> = {};
        people.forEach((p) => {
          const g = resolveGeneration(p, period) ?? 1;
          byGen[g] = byGen[g] || [];
          byGen[g].push(p);
        });
        const genKeys = Object.keys(byGen).sort((a, b) => Number(a) - Number(b));
        let maxRows = 0;
        genKeys.forEach((gKey) => {
          const genPeople = byGen[gKey];
          genPeople.forEach((person, rowIdx) => {
            const { start, end } = normalizePersonDates(person, period);
            const resolvedGen = resolveGeneration(person, period);
            const gNum = (resolvedGen ?? Number(gKey)) || 1;
            const colX = xShift + (gNum - 1) * TORAH_STEP_PX + CARD_PADDING_X;
            const y = GROUP_HEADER + 10 + rowIdx * (TRACK_HEIGHT + V_MARGIN);
            layouts.push({
              slug: person.slug,
              x: colX,
              y,
              width: cardW,
              tier: rowIdx,
              startYear: start,
              endYear: end,
              isFuzzy: true,
            });
          });
          maxRows = Math.max(maxRows, genPeople.length);
        });
        rowsCount = maxRows || 1;
      } else {
        layouts = people.map((person, idx) => {
          const { start, end } = normalizePersonDates(person, period);
          return {
            slug: person.slug,
            x: xShift + CARD_PADDING_X,
            y: GROUP_HEADER + 10 + idx * (TRACK_HEIGHT + V_MARGIN),
            width: cardW,
            tier: idx,
            startYear: start,
            endYear: end,
            isFuzzy: true,
          };
        });
        rowsCount = layouts.length ? layouts.length : 1;
      }
    } else if (opts?.waterfall) {
      // Сортируем по началу периода
      const sorted = [...people].sort((a, b) => normalizePersonDates(a, period).start - normalizePersonDates(b, period).start);
      const stepY = TRACK_HEIGHT * 0.9 + V_MARGIN;
      layouts = sorted.map((person, idx) => {
        const { start, end, isFuzzy } = normalizePersonDates(person, period);
        const xStart = Math.max(0, yearToX(start) - yearToX(period.startYear) + xShift);
        const xEnd = Math.min(periodWidth, yearToX(end) - yearToX(period.startYear) + xShift);
        const width = Math.max(40, xEnd - xStart);
        return {
          slug: person.slug,
          x: xStart,
          y: GROUP_HEADER + 6 + idx * stepY,
          width,
          tier: idx,
          startYear: start,
          endYear: end,
          isFuzzy,
        };
      });
      rowsCount = layouts.length;
    } else {
      const bin = buildBinPackedLayouts(people, period, yearToX, yearToX(period.startYear), periodWidth, xShift);
      layouts = bin.layouts;
      rowsCount = bin.rowsCount;
    }

    const rowHeightPx = opts?.waterfall
      ? Math.max(0, GROUP_HEADER + GROUP_PADDING * 2 + rowsCount * (TRACK_HEIGHT * 0.9 + V_MARGIN))
      : rowsCount * (TRACK_HEIGHT + V_MARGIN);

    const groupBodyHeight = rowsCount > 0 ? rowHeightPx - V_MARGIN : 0;
    const groupHeight = GROUP_HEADER + GROUP_PADDING * 2 + groupBodyHeight;

    return {
        id,
        label,
        people,
        personsLayout: layouts,
        height: groupHeight,
        y: yOffset,
        xOffset: xShift,
    };
}


export function buildTimelineBlocks({ people, periods }: BuildParams): PeriodBlock[] {
  const periodIndex: Record<string, Period> = {};
  periods.forEach((p) => { periodIndex[p.id] = p; });

  // Synthesize combined Amoraim period if not present but partials exist
  if (!periodIndex['amoraim']) {
    const amoraKeys = periods.filter((p) => p.id.toLowerCase().includes('amora')).map((p) => p.id);
    if (amoraKeys.length) {
      const startYear = Math.min(...amoraKeys.map((id) => periodIndex[id].startYear));
      const endYear = Math.max(...amoraKeys.map((id) => periodIndex[id].endYear));
      const base = periodIndex[amoraKeys[0]];
      periodIndex['amoraim'] = {
        ...base,
        id: 'amoraim',
        name_ru: base.name_ru || 'Амораим',
        startYear,
        endYear,
      };
    }
  }

  const PRIMARY_PERIODS = [
    'torah',
    'shoftim',
    'malakhim_united',
    'malakhim_divided',
    'anshei_knesset_hagedolah',
    'zugot',
    'tannaim_temple',
    'tannaim_post_temple',
    'amora_slot', // placeholder for amoraim variants
    'savoraim',
    'geonim',
    'rishonim',
    'achronim',
  ];

  const STACKED: { id: string; anchor: string }[] = [];

  const SECONDARY: string[] = ['hasmonean', 'prophets', 'neviim'];

  const resolvePeriod = (id: string): Period | undefined => {
    if (periodIndex[id]) return periodIndex[id];
    // synonyms fallback
    if (id === 'tannaim_pre_temple' && periodIndex['tannaim_temple']) return periodIndex['tannaim_temple'];
    if (id === 'tannaim_post_temple' && periodIndex['tannaim_post']) return periodIndex['tannaim_post'];
    if (id === 'malakhim_united' && periodIndex['malakhim']) return periodIndex['malakhim'];
    if (id === 'malakhim_divided' && periodIndex['malakhim_divided']) return periodIndex['malakhim_divided'];
    return undefined;
  };

  const peopleByPeriod: Record<string, TimelinePerson[]> = {};
  periods.forEach((p) => { peopleByPeriod[p.id] = []; });
  people.forEach((p) => {
    if (p.period && peopleByPeriod[p.period]) {
      peopleByPeriod[p.period].push(p);
    }
    // redirect Amoraim split periods into synthetic block
    if (p.period && p.period.toLowerCase().includes('amora') && !peopleByPeriod['amoraim']) {
      peopleByPeriod['amoraim'] = [];
    }
    if (p.period && p.period.toLowerCase().includes('amora')) {
      if (!peopleByPeriod['amoraim']) peopleByPeriod['amoraim'] = [];
      peopleByPeriod['amoraim'].push(p);
    }
  });

  const calcWidth = (period: Period, periodPeople: TimelinePerson[]): number => {
    const span = Math.max(1, period.endYear - period.startYear);
    if (period.id === 'torah') {
      const maxGen = periodPeople.reduce((acc, p) => Math.max(acc, resolveGeneration(p, period) ?? 0), 0) || 10;
      const dynamicWidth = TORAH_STEP_PX * (maxGen + 2);
      return Math.max(dynamicWidth, TORAH_COLUMN_WIDTH * 3 + TORAH_STEP_PX * 2);
    }
    if (period.id === 'shoftim') {
      const maxGen = periodPeople.reduce((acc, p) => Math.max(acc, resolveGeneration(p, period) ?? 0), 0) || 13;
      return Math.max(SHOFTIM_STEP_PX * Math.max(1, maxGen) + SHOFTIM_BAR_WIDTH, 600);
    }
    if (period.id.startsWith('tannaim') || period.id.startsWith('amoraim') || period.id === 'zugot') {
      const maxGenPeople = periodPeople.reduce((acc, p) => Math.max(acc, resolveGeneration(p, period) ?? 0), 0);
      const maxGenPeriod =
        period.subPeriods?.reduce((acc, sp) => (sp.generation && sp.generation > acc ? sp.generation : acc), 0) || 0;
      const fallbackGen = period.id === 'zugot' ? 5 : 1;
      const maxGen = Math.max(maxGenPeople || 0, maxGenPeriod || 0, fallbackGen);
      return Math.max(maxGen * GRID_COL_WIDTH + GRID_COL_GAP * 2, 700);
    }
    if (period.id === 'rishonim' || period.id === 'achronim') {
      return 520;
    }
    return Math.max(span * 1.8, 420);
  };

  const buildBlock = (period: Period, x: number, y: number, widthOverride?: number): PeriodBlock => {
    const periodPeople = peopleByPeriod[period.id] ?? [];
    const periodWidth = widthOverride ?? calcWidth(period, periodPeople);
    const localScale = periodWidth / Math.max(1, period.endYear - period.startYear);
    const localYearToX = (year: number) => (year - period.startYear) * localScale;

    let groups: GroupLayout[] = [];
    let groupCursorY = 0;
    const groupGap = period.id === 'shoftim'
      ? 4 // еще компактнее для Шофтим
      : period.id === 'malakhim_divided'
        ? GROUP_GAP
        : GROUP_GAP;

    const isGridPeriod = period.id.startsWith('tannaim') || period.id.startsWith('amoraim') || period.id === 'zugot';
    const maxGenForGrid = isGridPeriod
      ? (() => {
          const fromPeople = periodPeople.reduce((acc, p) => Math.max(acc, resolveGeneration(p, period) ?? 0), 0);
          const fromPeriod =
            period.subPeriods?.reduce((acc, sp) => (sp.generation && sp.generation > acc ? sp.generation : acc), 0) || 0;
          const fallbackGen = period.id === 'zugot' ? 5 : 1;
          return Math.max(fromPeople || 0, fromPeriod || 0, fallbackGen);
        })()
      : 1;
    const gridColWidth = isGridPeriod
      ? Math.max(120, (periodWidth - GRID_COL_GAP * (Math.max(1, maxGenForGrid) - 1)) / Math.max(1, maxGenForGrid))
      : GRID_COL_WIDTH;

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
          const group = createGroupLayout(`${period.id}-${label.toLowerCase()}`, label, groupPeople, groupCursorY, period, localYearToX, periodWidth, 0, { waterfall: true });
          groups.push(group);
          groupCursorY += group.height + GROUP_GAP;
      });

    } else if (period.id === 'torah') {
      const lineageOrder = [
        { id: 'preflood_root', label: 'Линия Адама' },
        { id: 'preflood_cain', label: 'Линия Каина' },
        { id: 'preflood_seth', label: 'Линия Шета' },
        { id: 'postflood_root', label: 'Линия Ноя' },
        { id: 'postflood_line_shem', label: 'Линия Шема' },
        { id: 'postflood_line_ham', label: 'Линия Хама' },
        { id: 'postflood_line_japheth', label: 'Линия Яфета' },
        { id: 'patriarchs', label: 'Эпоха праотцов' },
        { id: 'tribes', label: '12 колен' },
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
          sub.startsWith('patriarchs') ? 'patriarchs' :
          sub.startsWith('tribe_') ? 'tribes' :
          'other';
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(p);
      });

      const columnHeights = [0, 0, 0];

      const columnFor = (id: string) => {
        if (id.startsWith('preflood')) return 0; // Адам + Каин + Шет в одной колонке
        if (id.startsWith('postflood_line_shem') || id.startsWith('postflood_line_ham') || id.startsWith('postflood_line_japheth')) return 1; // Шем/Хам/Яфет в одной колонке
        return 2; // остальные (Ной, праотцы, колена, прочие) в третьей колонке
      };

      lineageOrder.forEach(({id, label}) => {
        const list = buckets[id] || [];
        if (!list.length) return;
        const col = columnFor(id);
        const xOffset = col * TORAH_COLUMN_WIDTH;
        const groupY = columnHeights[col];
        const group = createGroupLayout(
          `${period.id}-${id}`,
          label,
          list,
          groupY,
          period,
          localYearToX,
          periodWidth,
          xOffset,
          { grid: true, cardWidth: GRID_CARD_WIDTH, columnByGeneration: true },
        );
        groups.push(group);
        columnHeights[col] = groupY + group.height + groupGap;
      });

      groupCursorY = Math.max(...columnHeights);
    } else if (period.id === 'rishonim') {
      const regionLabels: Record<string, string> = {
        germany: 'Германия',
        france: 'Франция',
        england: 'Англия',
        provence: 'Прованс',
        sefarad: 'Сфарад',
        italy: 'Италия',
        north_africa: 'Северная Африка',
        kairouan: 'Кайруан',
        yemen: 'Йемен',
        egypt: 'Египет',
        other: 'Прочие',
      };
      const buckets: Record<string, TimelinePerson[]> = {};
      Object.keys(regionLabels).forEach((k) => { buckets[k] = []; });
      periodPeople.forEach((p) => {
        const key = (p.region as string) || 'other';
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(p);
      });
      Object.entries(regionLabels).forEach(([key, label]) => {
        const list = buckets[key] || [];
        if (!list.length) return;
        const group = createGroupLayout(`${period.id}-${key}`, label, list, groupCursorY, period, localYearToX, periodWidth);
        groups.push(group);
        groupCursorY += group.height + groupGap;
      });

    } else if (period.id === 'achronim') {
      const regionLabels: Record<string, string> = {
        early_achronim: 'Ранние ахроним',
        orthodox: 'Ортодоксальные раввины',
        eretz_israel: 'Ахроним Израиля',
        yemen: 'Йеменские ахроним',
        other: 'Прочие',
      };
      const resolveAchronimRegion = (p: TimelinePerson): string => {
        const sub = (p.subPeriod || '').toLowerCase();
        if (sub.startsWith('achronim_early')) return 'early_achronim';
        if (sub.startsWith('achronim_orthodox')) return 'orthodox';
        if (sub.startsWith('achronim_israel')) return 'eretz_israel';
        if (sub.startsWith('achronim_yemen')) return 'yemen';
        return '';
      };
      const buckets: Record<string, TimelinePerson[]> = {};
      Object.keys(regionLabels).forEach((k) => { buckets[k] = []; });
      periodPeople.forEach((p) => {
        // Сначала пытаемся определить группу по subPeriod (эрам Ахроним), затем по region
        const key = resolveAchronimRegion(p) || (p.region as string) || 'other';
        if (!buckets[key]) buckets[key] = [];
        buckets[key].push(p);
      });
      Object.entries(regionLabels).forEach(([key, label]) => {
        const list = buckets[key] || [];
        if (!list.length) return;
        const group = createGroupLayout(`${period.id}-${key}`, label, list, groupCursorY, period, localYearToX, periodWidth);
        groups.push(group);
        groupCursorY += group.height + groupGap;
      });

    } else if (period.id === 'savoraim') {
      const sura = periodPeople.filter((p) => (p.subPeriod || '').toLowerCase().includes('sura'));
      const pumbedita = periodPeople.filter((p) => (p.subPeriod || '').toLowerCase().includes('pumbedita'));
      const other = periodPeople.filter(
        (p) => !(p.subPeriod || '').toLowerCase().includes('sura') && !(p.subPeriod || '').toLowerCase().includes('pumbedita'),
      );
      const savoraGroups: { label: string; people: TimelinePerson[] }[] = [
        { label: 'Сура', people: sura },
        { label: 'Пумбедита', people: pumbedita },
        { label: 'Прочие', people: other },
      ];
      savoraGroups.forEach(({ label, people: list }) => {
        if (!list.length) return;
        const group = createGroupLayout(`${period.id}-${label.toLowerCase()}`, label, list, groupCursorY, period, localYearToX, periodWidth);
        groups.push(group);
          groupCursorY += group.height + groupGap;
      });

    } else if (period.id === 'geonim') {
      const sura = periodPeople.filter((p) => (p.subPeriod || '').toLowerCase().includes('sura'));
      const pumbedita = periodPeople.filter((p) => (p.subPeriod || '').toLowerCase().includes('pumbedita'));
      const israel = periodPeople.filter((p) => (p.subPeriod || '').toLowerCase().includes('israel'));
      const other = periodPeople.filter(
        (p) =>
          !(p.subPeriod || '').toLowerCase().includes('sura') &&
          !(p.subPeriod || '').toLowerCase().includes('pumbedita') &&
          !(p.subPeriod || '').toLowerCase().includes('israel'),
      );
      const gaonGroups: { label: string; people: TimelinePerson[] }[] = [
        { label: 'Сура', people: sura },
        { label: 'Пумбедита', people: pumbedita },
        { label: 'Эрец-Исраэль', people: israel },
        { label: 'Прочие', people: other },
      ];
      gaonGroups.forEach(({ label, people: list }) => {
        if (!list.length) return;
        const group = createGroupLayout(`${period.id}-${label.toLowerCase()}`, label, list, groupCursorY, period, localYearToX, periodWidth);
        groups.push(group);
        groupCursorY += group.height + groupGap;
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

      generationKeys.forEach((key, idx) => {
          const generationPeople = peopleByGeneration[key];
          if (generationPeople.length === 0) return;

          const label = key === 'unknown' ? 'Неизвестное поколение' : `Поколение ${key}`;
          const ladderOffset = period.id === 'shoftim' ? 0 : idx * 8;
          const genNumber = Number(key);
          const xColShift =
            (period.id.startsWith('tannaim') || period.id.startsWith('amoraim') || period.id === 'zugot') && Number.isFinite(genNumber)
              ? (genNumber - 1) * gridColWidth
              : 0;
          const isGrid = period.id.startsWith('tannaim') || period.id.startsWith('amoraim') || period.id === 'zugot';
          const cardWidth = isGrid ? Math.max(100, Math.min(GRID_CARD_WIDTH, gridColWidth - GRID_COL_GAP * 0.5)) : undefined;
          const group = createGroupLayout(`${period.id}-gen-${key}`, label, generationPeople, groupCursorY + ladderOffset, period, localYearToX, periodWidth, xColShift, isGrid ? { grid: true, cardWidth } : undefined);
          groups.push(group);
          groupCursorY = isGrid ? Math.max(groupCursorY, group.height) : groupCursorY + group.height + groupGap;
      });

      if (period.id.startsWith('tannaim') || period.id.startsWith('amoraim') || period.id === 'zugot') {
        const maxH = groups.reduce((m, g) => Math.max(m, g.height), 0);
        groups = groups.map((g) => ({ ...g, y: 0 }));
        groupCursorY = maxH;
      }
    }

    const rowHeight = groupCursorY > 0 ? groupCursorY - groupGap : 0;
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
      y,
      height: blockHeight,
      rows: [row],
    };
    return periodBlock;
  };

  const blocks: PeriodBlock[] = [];
  let cursorX = 0;
  const baseY = BLOCK_TOP;

  PRIMARY_PERIODS.forEach((pid) => {
    if (pid === 'amora_slot') {
      const amoraIsrael = resolvePeriod('amoraim_israel');
      const amoraBav = resolvePeriod('amoraim_babylonia');
      const amoraDefault = resolvePeriod('amoraim');

      const bavBlock = amoraBav ? buildBlock(amoraBav, cursorX, baseY) : null;
      const israelBlock = amoraIsrael ? buildBlock(amoraIsrael, cursorX, baseY) : null;

      // fallback: only one generic block
      if (!bavBlock && !israelBlock && amoraDefault) {
        const b = buildBlock(amoraDefault, cursorX, baseY);
        blocks.push(b);
        cursorX += b.width + HORIZONTAL_GAP;
        return;
      }

      // if we have both, stack vertically: Babylonia on top, Israel below
      if (bavBlock && israelBlock) {
        const maxW = Math.max(bavBlock.width, israelBlock.width);
        bavBlock.width = maxW;
        israelBlock.width = maxW;
        bavBlock.x = cursorX;
        israelBlock.x = cursorX;
        bavBlock.y = baseY;
        israelBlock.y = baseY + bavBlock.height + STACK_GAP;
        blocks.push(bavBlock, israelBlock);
        cursorX += maxW + HORIZONTAL_GAP;
        return;
      }

      if (bavBlock) {
        blocks.push(bavBlock);
        cursorX += bavBlock.width + HORIZONTAL_GAP;
        return;
      }

      if (israelBlock) {
        blocks.push(israelBlock);
        cursorX += israelBlock.width + HORIZONTAL_GAP;
        return;
      }

      return;
    }

    const per = resolvePeriod(pid);
    if (!per) return;
    const block = buildBlock(per, cursorX, baseY);
    blocks.push(block);
    cursorX += block.width + HORIZONTAL_GAP;
  });

  // Stacked (e.g., Amoraim under Tannaim post-temple)
  STACKED.forEach(({ id, anchor }) => {
    const per = resolvePeriod(id);
    const anchorBlock = blocks.find((b) => b.id === anchor);
    if (!per || !anchorBlock) return;
    const stacked = buildBlock(per, anchorBlock.x, anchorBlock.y + anchorBlock.height + STACK_GAP, anchorBlock.width);
    blocks.push(stacked);
  });

  // Secondary track: try to align under the nearest/overlapping primary period
  const primaryBlocks = blocks.filter((b) => PRIMARY_PERIODS.includes(b.id));
  const findAnchor = (per: Period): PeriodBlock | undefined => {
    let best: { block: PeriodBlock; score: number } | undefined;
    primaryBlocks.forEach((b) => {
      const start = Math.max(b.period.startYear, per.startYear);
      const end = Math.min(b.period.endYear, per.endYear);
      const overlap = Math.max(0, end - start);
      const score = overlap || -Math.abs((per.startYear + per.endYear) / 2 - (b.period.startYear + b.period.endYear) / 2);
      if (!best || score > best.score) best = { block: b, score };
    });
    return best?.block;
  };

  let secondaryX = 0;
  SECONDARY.forEach((id) => {
    const per = resolvePeriod(id);
    if (!per) return;
    const anchor = findAnchor(per);
    if (anchor) {
      const block = buildBlock(per, anchor.x, anchor.y + anchor.height + STACK_GAP, anchor.width);
      blocks.push(block);
    } else {
      const block = buildBlock(per, secondaryX, baseY + SECONDARY_TRACK_OFFSET);
      blocks.push(block);
      secondaryX += block.width + HORIZONTAL_GAP;
    }
  });

  return blocks;
}
