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
  [Region.GERMANY]: '#2f9e44', // green
  [Region.FRANCE]: '#f59f00', // orange
  [Region.SEPHARAD]: '#228be6', // blue
  [Region.ITALY]: '#cc5de8', // purple
  [Region.NORTH_AFRICA]: '#e8590c', // burnt orange
  [Region.YEMEN]: '#d9480f', // deep red-orange
  [Region.EGYPT]: '#e67700', // amber
  [Region.ENGLAND]: '#15aabf', // teal
  [Region.PROVENCE]: '#e64980', // pink
  other: '#8892b0', // muted slate
};

function resolveRishonimRegion(person: TimelinePerson): string {
  if (person.region) return person.region;
  const sub = person.subPeriod?.toLowerCase() ?? '';
  if (sub.includes('german')) return Region.GERMANY;
  if (sub.includes('france')) return Region.FRANCE;
  if (sub.includes('sefar') || sub.includes('sefard') || sub.includes('spain')) return Region.SEPHARAD;
  if (sub.includes('provence')) return Region.PROVENCE;
  if (sub.includes('england')) return Region.ENGLAND;
  if (sub.includes('italy')) return Region.ITALY;
  if (sub.includes('africa')) return Region.NORTH_AFRICA;
  if (sub.includes('yemen')) return Region.YEMEN;
  if (sub.includes('egypt')) return Region.EGYPT;
  return 'other';
}

export function getPersonColor(person: TimelinePerson, period: Period): string {
  const pid = period.id.toLowerCase();
  if (pid.includes('rishonim')) {
    const regionKey = resolveRishonimRegion(person);
    return RISHONIM_REGION_COLORS[regionKey] ?? RISHONIM_REGION_COLORS.other;
  }
  return getPeriodColor([period], period.id);
}
