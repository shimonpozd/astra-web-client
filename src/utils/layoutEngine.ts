import { Period, Region, TimelinePerson } from '@/types/timeline';

export interface PersonLayout {
  slug: string;
  x: number;
  y: number;
  width: number;
  tier: number;
}

export interface GroupLayout {
  id: string;
  label: string;
  people: TimelinePerson[];
  personsLayout: PersonLayout[];
  height: number;
}

export interface RowLayout {
  id: string;
  label: string;
  groups: GroupLayout[];
  height: number;
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
const CARD_HEIGHT = 70;
const MIN_CARD_WIDTH = 60;
const H_MARGIN = 8;
const ROW_GAP = 12;
const GROUP_HEADER = 20;
const GROUP_PADDING = 8;
const GROUP_GAP = 16;
const BLOCK_HEADER = 36;
const BLOCK_PADDING_Y = 12;
const PERIOD_GAP = 28;
const MIN_PERIOD_WIDTH = 140;
const BLOCK_TOP = 100;

function normalizeId(value?: string) {
  return (value || '').toLowerCase();
}

function resolveGeneration(person: TimelinePerson, period?: Period) {
  if (person.generation) return person.generation;
  const subPeriod = period?.subPeriods?.find((sp) => sp.id === person.subPeriod);
  if (subPeriod?.generation) return subPeriod.generation;
  const match = normalizeId(person.subPeriod).match(/gen(\d+)/);
  if (match) return Number(match[1]);
  return undefined;
}

function mapRegion(person: TimelinePerson, period?: Period): Region | 'other' {
  if (person.region) return person.region;
  const subPeriodRegion = period?.subPeriods?.find((sp) => sp.id === person.subPeriod)?.region;
  if (subPeriodRegion) return subPeriodRegion;
  const sp = normalizeId(person.subPeriod);
  if (sp.includes('bav') || sp.includes('bavel') || sp.includes('pumb') || sp.includes('sura')) return Region.BABYLONIA;
  if (sp.includes('israel') || sp.includes('eretz')) return Region.ERETZ_ISRAEL;
  if (period?.region) return period.region;
  return 'other';
}

function getGenCount(pid: string, region?: Region) {
  if (pid.includes('tannaim_temple')) return 7;
  if (pid.includes('tannaim_post')) return 5;
  if (pid === 'amoraim' || pid.includes('amora')) return region === Region.BABYLONIA ? 8 : 6;
  if (pid.includes('savo')) return 5;
  if (pid.includes('geon')) return 8;
  return undefined;
}

function getPersonBounds(person: TimelinePerson, period?: Period): { start: number; end: number } {
  const baseStart = period?.startYear ?? 0;
  const baseEnd = period?.endYear ?? baseStart + 50;

  // Hard data first
  const rawStart = person.birthYear ?? person.lifespan_range?.start ?? person.flouritYear;
  const rawEnd = person.deathYear ?? person.lifespan_range?.end;
  if (rawStart !== undefined && rawEnd !== undefined) {
    return { start: rawStart, end: rawEnd };
  }
  if (rawStart !== undefined && rawEnd === undefined) {
    return { start: rawStart, end: rawStart + 20 };
  }
  if (rawStart === undefined && rawEnd !== undefined) {
    return { start: rawEnd - 20, end: rawEnd };
  }

  // Pseudo based on generation/region
  const pid = normalizeId(period?.id);
  const genCount = getGenCount(pid, person.region ?? period?.region);
  const gen = resolveGeneration(person, period);
  if (genCount && gen && gen >= 1 && gen <= genCount) {
    const span = baseEnd - baseStart;
    const seg = span / genCount;
    const segStart = baseStart + (gen - 1) * seg;
    return { start: segStart, end: segStart + seg };
  }

  // Fallback: center of period with 10% span
  const span = baseEnd - baseStart;
  const width = Math.max(5, span * 0.1);
  const mid = baseStart + span / 2;
  return { start: mid - width / 2, end: mid + width / 2 };
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }) {
  return !(a.end + H_MARGIN < b.start || a.start > b.end + H_MARGIN);
}

function buildBinPackedLayouts(people: TimelinePerson[], period: Period, yearToX: (year: number) => number): { layouts: PersonLayout[]; rowsCount: number } {
  if (!people.length) return { layouts: [], rowsCount: 0 };

  const baseX = yearToX(period.startYear);
  const periodWidth = Math.max(yearToX(period.endYear) - baseX, MIN_PERIOD_WIDTH);
  const sorted = [...people].sort((a, b) => {
    const aStart = getPersonBounds(a, period).start;
    const bStart = getPersonBounds(b, period).start;
    return aStart - bStart;
  });

  type Row = { cards: { start: number; end: number }[] };
  const rows: Row[] = [];
  const layouts: PersonLayout[] = [];

  sorted.forEach((person) => {
    const { start, end } = getPersonBounds(person, period);
    const xStartRaw = yearToX(start) - baseX;
    const xEndRaw = yearToX(end) - baseX;
    const xStart = Math.max(0, xStartRaw);
    const xEnd = Math.min(periodWidth, xEndRaw);
    const width = Math.max(xEnd - xStart, MIN_CARD_WIDTH);
    const cardRange = { start: xStart, end: xStart + width };

    let rowIndex = rows.findIndex((row) => row.cards.every((c) => !overlaps(cardRange, c)));
    if (rowIndex === -1) {
      rowIndex = rows.length;
      rows.push({ cards: [] });
    }
    rows[rowIndex].cards.push(cardRange);

    layouts.push({
      slug: person.slug,
      x: xStart,
      y: GROUP_PADDING + GROUP_HEADER + rowIndex * (CARD_HEIGHT + ROW_GAP),
      width,
      tier: rowIndex,
    });
  });

  return { layouts, rowsCount: rows.length };
}

function createGroup(id: string, label: string, people: TimelinePerson[], period: Period, yearToX: (year: number) => number): GroupLayout {
  const { layouts, rowsCount } = buildBinPackedLayouts(people, period, yearToX);
  const bodyHeight = rowsCount * (CARD_HEIGHT + ROW_GAP);
  const height = bodyHeight + GROUP_HEADER + GROUP_PADDING * 2;

  return {
    id,
    label,
    people,
    personsLayout: layouts,
    height: Math.max(height, CARD_HEIGHT + GROUP_HEADER + GROUP_PADDING * 2),
  };
}

function buildTannaim(period: Period, people: TimelinePerson[], yearToX: (year: number) => number): GroupLayout[] {
  // Если период — храмовый (tannaim_temple) → 7 поколений; пост‑храмовый (tannaim_post_temple) → 5 поколений
  const id = normalizeId(period.id);
  const isTemple = id.includes('tannaim_temple');
  const genCount = isTemple ? 7 : 5;
  const groups: GroupLayout[] = [];
  const buckets: TimelinePerson[][] = Array.from({ length: genCount }, () => []);
  const others: TimelinePerson[] = [];
  const genFromPerson = (person: TimelinePerson) => resolveGeneration(person, period);

  people.forEach((person) => {
    const gen = genFromPerson(person);
    if (gen && gen >= 1 && gen <= genCount) {
      buckets[gen - 1].push(person);
    } else {
      others.push(person);
    }
  });

  buckets.forEach((arr, idx) => {
    const label = isTemple ? `Поколение ${idx + 1} (Храм)` : `Поколение ${idx + 1} (после 70)`;
    groups.push(createGroup(`${period.id}-gen${idx + 1}`, label, arr, period, yearToX));
  });
  if (others.length) {
    groups.push(createGroup(`${period.id}-other`, 'Прочие Таннаим', others, period, yearToX));
  }
  return groups;
}

function buildAmoraim(period: Period, people: TimelinePerson[], yearToX: (year: number) => number): GroupLayout[] {
  const israel: TimelinePerson[][] = Array.from({ length: 6 }, () => []);
  const babylon: TimelinePerson[][] = Array.from({ length: 8 }, () => []);
  const other: TimelinePerson[] = [];

  people.forEach((person) => {
    const region = mapRegion(person, period);
    const gen = resolveGeneration(person, period);
    if (region === Region.ERETZ_ISRAEL) {
      if (gen && gen >= 1 && gen <= 6) israel[gen - 1].push(person);
      else other.push(person);
    } else if (region === Region.BABYLONIA) {
      if (gen && gen >= 1 && gen <= 8) babylon[gen - 1].push(person);
      else other.push(person);
    } else {
      other.push(person);
    }
  });

  const groups: GroupLayout[] = [];
  israel.forEach((arr, idx) => groups.push(createGroup(`amoraim-israel-gen${idx + 1}`, `Израиль — поколение ${idx + 1}`, arr, period, yearToX)));
  babylon.forEach((arr, idx) => groups.push(createGroup(`amoraim-bav-gen${idx + 1}`, `Вавилон — поколение ${idx + 1}`, arr, period, yearToX)));
  if (other.length) groups.push(createGroup('amoraim-other', 'Прочие Амораим', other, period, yearToX));
  return groups;
}

function buildSavoraim(period: Period, people: TimelinePerson[], yearToX: (year: number) => number): GroupLayout[] {
  const sura: TimelinePerson[][] = Array.from({ length: 5 }, () => []);
  const pumbedita: TimelinePerson[][] = Array.from({ length: 5 }, () => []);
  const other: TimelinePerson[] = [];

  people.forEach((person) => {
    const gen = resolveGeneration(person, period);
    const subId = normalizeId(person.subPeriod);
    if (subId.includes('sura')) {
      if (gen && gen >= 1 && gen <= 5) sura[gen - 1].push(person);
      else other.push(person);
    } else if (subId.includes('pumb')) {
      if (gen && gen >= 1 && gen <= 5) pumbedita[gen - 1].push(person);
      else other.push(person);
    } else {
      const region = mapRegion(person, period);
      if (region === Region.BABYLONIA) {
        if (gen && gen >= 1 && gen <= 5) pumbedita[gen - 1].push(person);
        else other.push(person);
      } else {
        other.push(person);
      }
    }
  });

  const groups: GroupLayout[] = [];
  sura.forEach((arr, idx) => groups.push(createGroup(`saboraim-sura-gen${idx + 1}`, `Сура — поколение ${idx + 1}`, arr, period, yearToX)));
  pumbedita.forEach((arr, idx) => groups.push(createGroup(`saboraim-pumbedita-gen${idx + 1}`, `Пумбедита — поколение ${idx + 1}`, arr, period, yearToX)));
  if (other.length) groups.push(createGroup('saboraim-other', 'Прочие Савораим', other, period, yearToX));
  return groups;
}

function buildGeonim(period: Period, people: TimelinePerson[], yearToX: (year: number) => number): GroupLayout[] {
  const sura: TimelinePerson[][] = Array.from({ length: 8 }, () => []);
  const pumbedita: TimelinePerson[][] = Array.from({ length: 8 }, () => []);
  const israel: TimelinePerson[][] = Array.from({ length: 8 }, () => []);
  const other: TimelinePerson[] = [];

  people.forEach((person) => {
    const gen = resolveGeneration(person, period);
    const region = mapRegion(person, period);
    const subId = normalizeId(person.subPeriod);
    const pushGen = (arr: TimelinePerson[][]) => {
      if (gen && gen >= 1 && gen <= 8) arr[gen - 1].push(person);
      else other.push(person);
    };
    if (region === Region.BABYLONIA && subId.includes('pumb')) {
      pushGen(pumbedita);
    } else if (region === Region.BABYLONIA || subId.includes('sura')) {
      pushGen(sura);
    } else if (region === Region.ERETZ_ISRAEL) {
      pushGen(israel);
    } else {
      other.push(person);
    }
  });

  const groups: GroupLayout[] = [];
  sura.forEach((arr, idx) => groups.push(createGroup(`geonim-sura-gen${idx + 1}`, `Сура — поколение ${idx + 1}`, arr, period, yearToX)));
  pumbedita.forEach((arr, idx) => groups.push(createGroup(`geonim-pumbedita-gen${idx + 1}`, `Пумбедита — поколение ${idx + 1}`, arr, period, yearToX)));
  israel.forEach((arr, idx) => groups.push(createGroup(`geonim-israel-gen${idx + 1}`, `Эрец-Исраэль — поколение ${idx + 1}`, arr, period, yearToX)));
  if (other.length) groups.push(createGroup('geonim-other', 'Прочие Гаоним', other, period, yearToX));
  return groups;
}

const RISHONIM_REGIONS: { id: string; label: string; regions: Region[] }[] = [
  { id: 'germany', label: 'Германия (Ашкеназ)', regions: [Region.GERMANY] },
  { id: 'france', label: 'Франция', regions: [Region.FRANCE] },
  { id: 'england', label: 'Англия', regions: [Region.ENGLAND] },
  { id: 'provence', label: 'Прованс', regions: [Region.PROVENCE] },
  { id: 'sefarad', label: 'Сфарад (Испания)', regions: [Region.SEPHARAD] },
  { id: 'italy', label: 'Италия', regions: [Region.ITALY] },
  { id: 'north-africa', label: 'Северная Африка', regions: [Region.NORTH_AFRICA] },
  { id: 'yemen', label: 'Йемен', regions: [Region.YEMEN] },
  { id: 'egypt', label: 'Египет', regions: [Region.EGYPT] },
];

function buildRishonim(period: Period, people: TimelinePerson[], yearToX: (year: number) => number): GroupLayout[] {
  const buckets: Record<string, TimelinePerson[]> = {};
  RISHONIM_REGIONS.forEach((reg) => {
    buckets[reg.id] = [];
  });
  buckets.other = [];

  people.forEach((person) => {
    const region = mapRegion(person, period);
    const bucketKey = RISHONIM_REGIONS.find((r) => r.regions.includes(region as Region))?.id;
    if (bucketKey) {
      buckets[bucketKey].push(person);
    } else {
      buckets.other.push(person);
    }
  });

  const groups: GroupLayout[] = RISHONIM_REGIONS.map((reg) => createGroup(`rishonim-${reg.id}`, reg.label, buckets[reg.id], period, yearToX));
  if (buckets.other.length) groups.push(createGroup('rishonim-other', 'Прочие Ришоним', buckets.other, period, yearToX));
  return groups;
}

function buildDefault(period: Period, people: TimelinePerson[], yearToX: (year: number) => number): GroupLayout[] {
  return [createGroup(`${period.id}-main`, 'Персоналии', people, period, yearToX)];
}

function buildMalakhimDivided(period: Period, people: TimelinePerson[], yearToX: (year: number) => number): GroupLayout[] {
  const israel = people.filter((p) => normalizeId(p.subPeriod).includes('israel'));
  const judah = people.filter((p) => normalizeId(p.subPeriod).includes('judah'));
  const other = people.filter((p) => !normalizeId(p.subPeriod).includes('israel') && !normalizeId(p.subPeriod).includes('judah'));
  const groups: GroupLayout[] = [
    createGroup(`${period.id}-israel`, 'Царство Израиль', israel, period, yearToX),
    createGroup(`${period.id}-judah`, 'Царство Иуда', judah, period, yearToX),
  ];
  if (other.length) groups.push(createGroup(`${period.id}-other`, 'Прочие правители', other, period, yearToX));
  return groups;
}

function calcRowHeight(groups: GroupLayout[]) {
  if (!groups.length) return CARD_HEIGHT + GROUP_HEADER + GROUP_PADDING * 2;
  const groupsHeight = groups.reduce((acc, g) => acc + g.height + GROUP_GAP, -GROUP_GAP);
  return Math.max(groupsHeight, CARD_HEIGHT + GROUP_HEADER + GROUP_PADDING * 2);
}

function calcBlockHeight(rows: RowLayout[]) {
  if (!rows.length) return BLOCK_HEADER + CARD_HEIGHT + GROUP_GAP + BLOCK_PADDING_Y * 2;
  const rowsHeight = rows.reduce((acc, r) => acc + r.height + ROW_GAP, -ROW_GAP);
  return BLOCK_HEADER + rowsHeight + BLOCK_PADDING_Y * 2;
}

export function buildTimelineBlocks({ people, periods, yearToX }: BuildParams): PeriodBlock[] {
  // Merge Amoraim periods into a single synthetic block to show one header with two lanes
  const amoraimPeriods = periods.filter((p) => normalizeId(p.id).includes('amor'));
  // Merge Savoraim (без Пумбедита) в единый блок
  const savoraimPeriods = periods.filter((p) => {
    const pid = normalizeId(p.id);
    return pid.includes('savo') || pid.includes('sabora');
  });
  const pumbeditaPeriods = periods.filter((p) => normalizeId(p.id).includes('pumbedita'));
  const geonimPeriods = periods.filter((p) => normalizeId(p.id).includes('geon'));

  const remainingPeriods = periods.filter((p) => {
    const pid = normalizeId(p.id);
    const isAmor = pid.includes('amor');
    const isSavo = pid.includes('savo') || pid.includes('sabora');
    const isPumbedita = pid.includes('pumbedita');
    const isGeonim = pid.includes('geon');
    return !isAmor && !isSavo && !isPumbedita && !isGeonim;
  });

  const synthetic: { period: Period; people: TimelinePerson[] }[] = [];

  if (amoraimPeriods.length) {
    const startYear = Math.min(...amoraimPeriods.map((p) => p.startYear));
    const endYear = Math.max(...amoraimPeriods.map((p) => p.endYear));
    const base = amoraimPeriods[0];
    synthetic.push({
      period: {
        ...base,
        id: 'amoraim',
        name_ru: 'Амораим',
        startYear,
        endYear,
      },
      people: people.filter((p) => amoraimPeriods.some((per) => per.id === p.period)),
    });
  }

  if (geonimPeriods.length) {
    const startYear = Math.min(...[...geonimPeriods, ...pumbeditaPeriods].map((p) => p.startYear));
    const endYear = Math.max(...[...geonimPeriods, ...pumbeditaPeriods].map((p) => p.endYear));
    const base = geonimPeriods[0];
    synthetic.push({
      period: {
        ...base,
        id: 'geonim',
        name_ru: base.name_ru ?? 'Гаоним',
        startYear,
        endYear,
      },
      people: people.filter((p) => geonimPeriods.some((per) => per.id === p.period) || pumbeditaPeriods.some((per) => per.id === p.period)),
    });
  }

  if (savoraimPeriods.length) {
    const startYear = Math.min(...savoraimPeriods.map((p) => p.startYear));
    const endYear = Math.max(...savoraimPeriods.map((p) => p.endYear));
    const base = savoraimPeriods[0];
    synthetic.push({
      period: {
        ...base,
        id: 'savoraim',
        name_ru: 'Савораим',
        startYear,
        endYear,
      },
      people: people.filter((p) => savoraimPeriods.some((per) => per.id === p.period)),
    });
  }

  remainingPeriods.forEach((period) => {
    synthetic.push({ period, people: people.filter((p) => p.period === period.id) });
  });

  // Build raw blocks first (without y) so we can place them on vertical tracks
  const unslotted: PeriodBlock[] = synthetic.map<PeriodBlock>((entry) => {
    const { period, people: periodPeople } = entry;
    const periodPeopleNormalized = periodPeople.map((p) => ({
      ...p,
      name_en: p.name_en || (p as any).title_en || p.slug,
      name_ru: p.name_ru || (p as any).title_ru || (p as any).display?.name_ru,
    }));
    const pid = normalizeId(period.id);
    let groups: GroupLayout[];

    if (pid.includes('tann')) {
      groups = buildTannaim(period, periodPeopleNormalized, yearToX);
    } else if (pid === 'amoraim') {
      groups = buildAmoraim(period, periodPeopleNormalized, yearToX);
    } else if (pid.includes('savo') || pid.includes('sabora')) {
      groups = buildSavoraim(period, periodPeopleNormalized, yearToX);
    } else if (pid.includes('geon')) {
      groups = buildGeonim(period, periodPeopleNormalized, yearToX);
    } else if (pid.includes('rish')) {
      groups = buildRishonim(period, periodPeopleNormalized, yearToX);
    } else if (pid.includes('malakhim') && pid.includes('divided')) {
      groups = buildMalakhimDivided(period, periodPeopleNormalized, yearToX);
    } else {
      groups = buildDefault(period, periodPeopleNormalized, yearToX);
    }

    const row: RowLayout = {
      id: `${period.id}-structure`,
      
      groups,
      height: calcRowHeight(groups),
    };

    const rows: RowLayout[] = [row];
    const blockHeight = calcBlockHeight(rows);
    const x = yearToX(period.startYear);
    const width = Math.max(yearToX(period.endYear) - x, MIN_PERIOD_WIDTH);

    return {
      id: period.id,
      period,
      x,
      width,
      y: 0, // will be assigned after track placement
      height: blockHeight,
      rows,
    };
  });

  // Все блоки на одной горизонтали (единая линия), без вертикального разведения
  unslotted.forEach((block) => {
    block.y = BLOCK_TOP;
  });

  return unslotted;
}
