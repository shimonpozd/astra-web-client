export enum Region {
  ERETZ_ISRAEL = 'eretz_israel',
  BABYLONIA = 'babylonia',
  GERMANY = 'germany',
  FRANCE = 'france',
  ENGLAND = 'england',
  PROVENCE = 'provence',
  SEPHARAD = 'sepharad',
  ITALY = 'italy',
  NORTH_AFRICA = 'north_africa',
  KAIROUAN = 'kairouan',
  YEMEN = 'yemen',
  EGYPT = 'egypt',
  EARLY_ACHRONIM = 'early_achronim',
  ORTHODOX = 'orthodox',
  ADMORIM = 'admorim',
  RELIGIOUS_ZIONISM = 'religious_zionism',
}

export interface SubPeriod {
  id: string;
  name_en?: string;
  name_he?: string;
  name_ru: string;
  generation?: number;
  startYear?: number;
  endYear?: number;
  region?: Region;
}

export interface Period {
  id: string;
  name_en?: string;
  name_he?: string;
  name_ru: string;
  startYear: number;
  endYear: number;
  color: string;
  region?: Region;
  subPeriods?: SubPeriod[];
}

export interface LifespanRange {
  start: number;
  end: number;
  estimated: boolean;
}

export interface TimelinePerson {
  slug: string;
  name_en: string;
  name_he: string;
  name_ru?: string;
  birthYear?: number;
  deathYear?: number;
  flouritYear?: number;
  lifespan?: string;
  lifespan_range?: LifespanRange;
  period: string;
  subPeriod?: string;
  generation?: number;
  region?: Region;
  summary_html?: string;
  images?: string[];
  categories?: string[];
  displayOrder?: number;
  color?: string;
  is_verified?: boolean;
}

export type TimelineViewMode = 'horizontal' | 'vertical' | 'spiral';

export interface FilterState {
  periods: Set<string>;
  regions: Set<Region>;
  generations: Set<number>;
  searchQuery: string;
  dateRange?: [number, number];
}

export interface TimelineStats {
  totalPeople: number;
  byPeriod: Record<string, number>;
  byRegion: Record<Region, number>;
}

export interface TimelineApiResponse {
  people: TimelinePerson[];
  periods: Period[];
  stats: TimelineStats;
}
