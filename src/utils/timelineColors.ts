import { Period, Region, TimelinePerson } from '@/types/timeline';

export interface ColorSystem {
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

export const PERIOD_BASE_COLORS: Record<string, string> = {
  torah: '#B08A5A', // Antique Gold
  shoftim: '#8C6A46', // Bronze
  neviim: '#A0704A', // Burnt Copper
  great_assembly: '#6E7078', // Pewter / Tin
  malakhim_united: '#C9A64A', // Bright Gold
  malakhim_divided: '#A4783F', // Royal Brass
  hasmonean: '#2D5A78', // Deep Steel Blue
  zugot: '#4A7D8C', // Oxidized Silver / Patina
  tannaim_temple: '#6A8A34', // Verdigris Bronze
  tannaim_post_temple: '#4F6D2C', // Aged Brass Verdigris
  amoraim_israel: '#2B6F59', // Emerald
  amoraim_babylonia: '#3B8F61', // Light Emerald
  savoraim: '#1F7E79', // Deep Turquoise
  geonim: '#4B3A7A', // Amethyst
  rishonim: '#7A2F8C', // Royal Purple
  achronim: '#8D45C9', // Modern Violet
};

function clampChannel(value: number) {
  return Math.max(0, Math.min(255, value));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace('#', '');
  const int = parseInt(normalized, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255,
  };
}

function mixColor(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const ratio = Math.max(-1, Math.min(1, factor));
  const target = ratio >= 0 ? 255 : 0;
  const mix = Math.abs(ratio);
  const blend = (channel: number) => clampChannel(Math.round(channel + (target - channel) * mix));
  return `#${[blend(r), blend(g), blend(b)]
    .map((c) => c.toString(16).padStart(2, '0'))
    .join('')}`;
}

function withAlpha(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getContrastColor(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? '#000000' : '#FFFFFF';
}

export function generateColorSystem(periodId: string): ColorSystem {
  const base = PERIOD_BASE_COLORS[periodId] ?? '#4A7D8C';
  return {
    periodBase: base,
    periodBackground: mixColor(base, 0.8),
    periodBorder: mixColor(base, 0.4),
    personBar: {
      normal: withAlpha(base, 0.85),
      verified: withAlpha(base, 1),
      estimated: withAlpha(mixColor(base, 0.1), 0.55),
      hover: mixColor(base, 0.12),
      selected: mixColor(base, -0.12),
    },
    text: {
      onPeriod: getContrastColor(base),
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
  [Region.GERMANY]: '#2E7F4F',
  [Region.FRANCE]: '#C38A1F',
  [Region.SEPHARAD]: '#B0262A',
  [Region.ITALY]: '#9C4CC9',
  [Region.NORTH_AFRICA]: '#D16920',
  [Region.YEMEN]: '#A24312',
  [Region.EGYPT]: '#CC9F2E',
  [Region.ENGLAND]: '#2F66A8',
  [Region.PROVENCE]: '#C5416B',
  [Region.KAIROUAN]: '#5560C9',
};

const ACHRONIM_SUB_COLORS: Record<string, string> = {
  early: '#A1C4FF',
  orthodox: '#24324F',
  israel: '#2A5EBF',
  yemen: '#C47A24',
  admorim: '#8E5BA6',
  religious_zionism: '#2C9F7F',
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
    if (person.region === Region.ADMORIM || sub.includes('achronim_admorim')) return ACHRONIM_SUB_COLORS.admorim;
    if (person.region === Region.RELIGIOUS_ZIONISM || sub.includes('achronim_religious_zionism')) return ACHRONIM_SUB_COLORS.religious_zionism;
    return getPeriodColor([period], period.id);
  }
  return getPeriodColor([period], period.id);
}
