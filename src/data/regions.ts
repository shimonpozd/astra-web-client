import { Region } from '@/types/timeline';

export const REGION_LABELS: Record<Region, { name_ru: string; name_en: string }> = {
  [Region.ERETZ_ISRAEL]: { name_ru: 'Земля Израиля', name_en: 'Eretz Israel' },
  [Region.BABYLONIA]: { name_ru: 'Вавилония', name_en: 'Babylonia' },
  [Region.GERMANY]: { name_ru: 'Германия', name_en: 'Germany' },
  [Region.FRANCE]: { name_ru: 'Франция', name_en: 'France' },
  [Region.ENGLAND]: { name_ru: 'Англия', name_en: 'England' },
  [Region.PROVENCE]: { name_ru: 'Прованс', name_en: 'Provence' },
  [Region.SEPHARAD]: { name_ru: 'Сфарад', name_en: 'Sepharad' },
  [Region.ITALY]: { name_ru: 'Италия', name_en: 'Italy' },
  [Region.NORTH_AFRICA]: { name_ru: 'Северная Африка', name_en: 'North Africa' },
  [Region.YEMEN]: { name_ru: 'Йемен', name_en: 'Yemen' },
  [Region.EGYPT]: { name_ru: 'Египет', name_en: 'Egypt' },
};

export const REGIONS: Region[] = Object.keys(REGION_LABELS) as Region[];
