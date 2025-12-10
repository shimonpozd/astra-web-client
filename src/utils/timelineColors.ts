import { Period, Region, TimelinePerson } from '@/types/timeline';

export interface ColorSystem {
  hue?: number;
  periodBase: string;
  periodBackground: string;
  periodBorder: string;
  personBar: {
    normal: string;
    verified: string;
    estimated: string;
    hover: string;
    selected: string;
  };
  text: {
    onPeriod: string;
    onBackground: string;
    dimmed: string;
  };
}

export const PERIOD_HUES: Record<string, number> = {
  shoftim: 30,
  malakhim_united: 45,
  malakhim_divided: 35,
  hasmonean: 210,
  zugot: 190,
  tannaim_temple: 80,
  tannaim_post_temple: 95,
  amoraim_israel: 140,
  amoraim_babylonia: 150,
  savoraim: 170,
  pumbedita: 220,
  geonim: 260,
  rishonim: 290,
  achronim: 310,
};

function getContrastColor(hue: number): string {
  const lightHues = [30, 45, 50, 60, 170, 180, 190];
  return lightHues.some((h) => Math.abs(h - hue) < 20) ? '#000000' : '#FFFFFF';
}

export function generateColorSystem(periodId: string): ColorSystem {
  const hue = PERIOD_HUES[periodId] ?? 200;

  return {
    hue,
    periodBase: `hsl(${hue}, 70%, 50%)`,
    periodBackground: `hsl(${hue}, 40%, 95%)`,
    periodBorder: `hsl(${hue}, 50%, 70%)`,
    personBar: {
      normal: `hsla(${hue}, 70%, 50%, 0.8)`,
      verified: `hsla(${hue}, 70%, 50%, 1)`,
      estimated: `hsla(${hue}, 70%, 50%, 0.5)`,
      hover: `hsl(${hue}, 70%, 60%)`,
      selected: `hsl(${hue}, 90%, 50%)`,
    },
    text: {
      onPeriod: getContrastColor(hue),
      onBackground: '#333333',
      dimmed: '#999999',
    },
  };
}

export function getPeriodColor(periods: Period[], periodId: string) {
  return periods.find((p) => p.id === periodId)?.color ?? generateColorSystem(periodId).periodBase;
}

// --- Region palette for Rishonim ---
const RISHONIM_REGION_COLORS: Record<string, string> = {
  [Region.GERMANY]: '#2f9e44',
  [Region.FRANCE]: '#f59f00',
  [Region.SEPHARAD]: '#228be6',
  [Region.ITALY]: '#cc5de8',
  [Region.NORTH_AFRICA]: '#e8590c',
  [Region.YEMEN]: '#d9480f',
  [Region.EGYPT]: '#e67700',
  [Region.ENGLAND]: '#15aabf',
  [Region.PROVENCE]: '#e64980',
  [Region.KAIROUAN]: '#6366f1',
};

const ACHRONIM_SUB_COLORS: Record<string, string> = {
  early: '#2563eb',
  orthodox: '#dc2626',
  israel: '#059669',
  yemen: '#d97706',
};

function resolveRishonimRegion(person: TimelinePerson): string | undefined {
  if (person.region) return person.region;
  const sub = person.subPeriod?.toLowerCase() ?? '';
  if (sub.includes('rishonim_germany')) return Region.GERMANY;
  if (sub.includes('rishonim_france')) return Region.FRANCE;
  if (sub.includes('rishonim_england')) return Region.ENGLAND;
  if (sub.includes('rishonim_provence')) return Region.PROVENCE;
  if (sub.includes('rishonim_sepharad')) return Region.SEPHARAD;
  if (sub.includes('rishonim_italy')) return Region.ITALY;
  if (sub.includes('rishonim_north_africa')) return Region.NORTH_AFRICA;
  if (sub.includes('rishonim_kairouan')) return Region.KAIROUAN;
  if (sub.includes('rishonim_yemen')) return Region.YEMEN;
  if (sub.includes('rishonim_egypt')) return Region.EGYPT;
  return undefined;
}

export function getPersonColor(person: TimelinePerson, period: Period): string {
  const pid = period.id.toLowerCase();
  const pname = period.name_ru?.toLowerCase() ?? '';
  if (pid.includes('rishonim')) {
    const regionKey = resolveRishonimRegion(person);
    if (regionKey && RISHONIM_REGION_COLORS[regionKey]) {
      return RISHONIM_REGION_COLORS[regionKey];
    }
    return getPeriodColor([period], period.id);
  }
  if (pid.includes('achronim')) {
    const sub = person.subPeriod?.toLowerCase() ?? '';
    if (person.region === Region.EARLY_ACHRONIM || sub.includes('achronim_early') || pname.includes('ранние')) return ACHRONIM_SUB_COLORS.early;
    if (person.region === Region.ORTHODOX || sub.includes('achronim_orthodox') || pname.includes('ортодокс')) return ACHRONIM_SUB_COLORS.orthodox;
    if (person.region === Region.ERETZ_ISRAEL || sub.includes('achronim_israel') || pname.includes('израил')) return ACHRONIM_SUB_COLORS.israel;
    if (person.region === Region.YEMEN || sub.includes('achronim_yemen') || pname.includes('йемен')) return ACHRONIM_SUB_COLORS.yemen;
    return getPeriodColor([period], period.id);
  }
  return getPeriodColor([period], period.id);
}
