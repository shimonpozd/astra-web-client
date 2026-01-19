import { useEffect, useMemo, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import TopBar from '../components/layout/TopBar';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Switch } from '../components/ui/Switch';
import { api } from '../services/api';
import { OpinionsPanel } from '../components/zmanim/OpinionsPanel';
import { SkyPanorama } from '../components/SkyPanorama';
import { AstroEventsDialog } from '../components/zmanim/AstroEventsDialog';

type ZmanimMethod = {
  id: string;
  type: 'time' | 'duration_ms' | 'number';
  menu_ru?: string | null;
  title_ru?: string | null;
  category?: string | null;
  what_is_it_ru?: string | null;
  how_calculated_ru?: string | null;
  bounds_ru?: {
    start_ru?: string | null;
    end_ru?: string | null;
  } | null;
  returns?: {
    type?: 'time' | 'duration_ms' | 'number' | string | null;
    unit_ru?: string | null;
    meaning_ru?: string | null;
    error_value?: string | null;
    error_ru?: string | null;
  } | null;
  deprecated?: boolean | null;
  deprecated_ru?: string | null;
  attribution?: string | null;
  authors?: string[] | null;
  author_primary?: string | null;
  tags?: string[] | null;
};

type ZmanimResults = Record<string, string | number | null>;
type ZmanimErrors = Record<string, string>;

const CORE_METHODS = [
  'getAlos16Point1Degrees',
  'getMisheyakir11Degrees',
  'getSunrise',
  'getChatzos',
  'getMinchaGedola',
  'getMinchaKetana',
  'getPlagHamincha',
  'getSunset',
  'getTzaisGeonim7Point083Degrees',
];

type GeoResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

const buildZonedDate = (dateValue: string, timeValue: string, timeZone: string) => {
  const [year, month, day] = dateValue.split('-').map(Number);
  const [hour, minute] = timeValue.split(':').map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return new Date();
  }

  const buildPartsDate = (date: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  };

  let utc = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 2; i += 1) {
    const tzTime = buildPartsDate(new Date(utc));
    const diff = Date.UTC(year, month - 1, day, hour, minute, 0) - tzTime;
    utc += diff;
  }
  return new Date(utc);
};

const fetchTimeZoneForCoords = async (latValue: number, lonValue: number) => {
  const params = new URLSearchParams({
    latitude: latValue.toString(),
    longitude: lonValue.toString(),
    current: 'temperature',
    timezone: 'auto',
  });
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`);
  if (!response.ok) {
    throw new Error('Timezone lookup failed');
  }
  const data = await response.json();
  return data.timezone as string | undefined;
};

const normalizeLon = (lonValue: number) => {
  const wrapped = ((lonValue + 180) % 360 + 360) % 360 - 180;
  return wrapped;
};

const clampLat = (latValue: number) => Math.max(-90, Math.min(90, latValue));

const formatDuration = (value: number) => {
  const totalSeconds = Math.floor(value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const parts = [
    hours ? `${hours}h` : null,
    `${minutes}m`,
    `${seconds}s`,
  ].filter(Boolean);
  return parts.join(' ');
};

const formatClockTime = (value: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(value);
  } catch {
    return value.toLocaleTimeString();
  }
};

const formatClockDate = (value: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(value);
  } catch {
    return value.toLocaleDateString();
  }
};

const formatReadableDateTime = (value: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat(undefined, {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(value);
  } catch {
    return value.toLocaleString();
  }
};

const formatDateWithZone = (value: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone,
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      timeZoneName: 'short',
    }).format(value);
  } catch {
    return value.toLocaleDateString();
  }
};

const formatDateValue = (value: Date, timeZone: string) => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(value);
  } catch {
    return value.toISOString().slice(0, 10);
  }
};

const formatHebrewDate = (value: Date, timeZone: string) => {
  try {
    const formatter = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      timeZone,
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const parts = formatter.formatToParts(value);
    const day = parts.find((part) => part.type === 'day')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const year = parts.find((part) => part.type === 'year')?.value;
    if (day && month && year) {
      return `${day} ${month} ${year}`;
    }
    return formatter.format(value);
  } catch {
    return '';
  }
};

const formatZmanimValue = (value: string, timeZone: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatReadableDateTime(parsed, timeZone);
};

const buildCountdown = (value: string | null, now: Date) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  const diff = parsed.getTime() - now.getTime();
  if (diff < 0) return { text: 'прошло', diff, passed: true };
  return { text: `осталось ${formatDuration(diff)}`, diff, passed: false };
};

type HalachicMode = 'gra' | 'mga' | 'bht';

type HalachicConfig = {
  label: string;
  start: string;
  end: string;
  nightStart: string;
  nightEnd: string;
  dateChange: string;
};

const HALACHIC_MODES: Record<HalachicMode, HalachicConfig> = {
  gra: {
    label: 'ГРА',
    start: 'getSeaLevelSunrise',
    end: 'getSunset',
    nightStart: 'getSunset',
    nightEnd: 'getSeaLevelSunrise',
    dateChange: 'getTzaisGeonim7Point083Degrees',
  },
  mga: {
    label: 'МГА',
    start: 'getAlos72',
    end: 'getTzais72',
    nightStart: 'getTzais72',
    nightEnd: 'getAlos72',
    dateChange: 'getTzais72',
  },
  bht: {
    label: 'Баал а-Тания',
    start: 'getSunriseBaalHatanya',
    end: 'getSunsetBaalHatanya',
    nightStart: 'getSunsetBaalHatanya',
    nightEnd: 'getSunriseBaalHatanya',
    dateChange: 'getSunsetBaalHatanya',
  },
};

type HalachicAnchorSet = {
  start: Date | null;
  end: Date | null;
  nightStart: Date | null;
  nightEnd: Date | null;
  dateChange: Date | null;
  error?: string;
};

const buildHalachicLabel = (start: Date, end: Date, now: Date) => {
  let span = end.getTime() - start.getTime();
  if (span <= 0) span += 24 * 60 * 60 * 1000;
  const raw = now.getTime() - start.getTime();
  const t = ((raw % span) + span) % span;
  const shaahMs = span / 12;
  const hourIndex = Math.floor(t / shaahMs);
  const remainderHour = t % shaahMs;
  const minuteMs = shaahMs / 60;
  const partMs = minuteMs / 18;
  const minutes = Math.floor(remainderHour / minuteMs);
  const remainderMinute = remainderHour % minuteMs;
  const parts = Math.floor(remainderMinute / partMs);
  const partsTotal = minutes * 18 + parts;
  return {
    label: `${String(hourIndex).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(parts).padStart(2, '0')}`,
    partsTotal,
    shaahMs,
  };
};

const formatHalachicTime = (
  dayStart: Date,
  dayEnd: Date,
  nightStart: Date,
  nightEnd: Date,
  now: Date,
) => {
  const dayMs = 24 * 60 * 60 * 1000;
  const nowMs = now.getTime();

  const buildInterval = (startMs: number, endMs: number) => {
    let s = startMs;
    let e = endMs;
    if (e <= s) e += dayMs;
    return { start: s, end: e };
  };

  const findInterval = (startMs: number, endMs: number) => {
    const base = buildInterval(startMs, endMs);
    const candidates = [
      base,
      { start: base.start - dayMs, end: base.end - dayMs },
      { start: base.start + dayMs, end: base.end + dayMs },
    ];
    return candidates.find((c) => nowMs >= c.start && nowMs <= c.end) ?? base;
  };

  const dayInterval = findInterval(dayStart.getTime(), dayEnd.getTime());
  if (nowMs >= dayInterval.start && nowMs <= dayInterval.end) {
    return {
      period: 'День',
      ...buildHalachicLabel(new Date(dayInterval.start), new Date(dayInterval.end), now),
    };
  }

  const nightInterval = findInterval(nightStart.getTime(), nightEnd.getTime());
  return {
    period: 'Ночь',
    ...buildHalachicLabel(new Date(nightInterval.start), new Date(nightInterval.end), now),
  };
};

const PRESETS = [
  {
    id: 'bht',
    label: 'Баал а-Тания',
    methods: [
      'getAlosBaalHatanya',
      'getSunriseBaalHatanya',
      'getSunsetBaalHatanya',
      'getTzaisBaalHatanya',
      'getShaahZmanisBaalHatanya',
      'getSofZmanShmaBaalHatanya',
      'getSofZmanTfilaBaalHatanya',
      'getSofZmanAchilasChametzBaalHatanya',
      'getSofZmanBiurChametzBaalHatanya',
      'getMinchaGedolaBaalHatanya',
      'getMinchaGedolaBaalHatanyaGreaterThan30',
      'getMinchaKetanaBaalHatanya',
      'getPlagHaminchaBaalHatanya',
      'getChatzosHayomBaalHatanya',
      'getChatzosHalailahBaalHatanya',
    ],
  },
];

const humanizeMethod = (id: string) => {
  return id
    .replace(/^get/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/\s+/g, ' ')
    .trim();
};

const getGroupName = (id: string) => {
  if (id.startsWith('getAlos')) return 'Alos';
  if (id.startsWith('getMisheyakir')) return 'Misheyakir';
  if (id.startsWith('getSunrise') || id.startsWith('getSeaLevelSunrise')) return 'Sunrise';
  if (id.startsWith('getSunset') || id.startsWith('getSeaLevelSunset')) return 'Sunset';
  if (id.startsWith('getChatzos')) return 'Chatzos';
  if (id.startsWith('getMinchaGedola')) return 'Mincha Gedola';
  if (id.startsWith('getMinchaKetana')) return 'Mincha Ketana';
  if (id.startsWith('getPlagHamincha')) return 'Plag Hamincha';
  if (id.startsWith('getTzais')) return 'Tzais';
  if (id.startsWith('getBainHashmashos') || id.startsWith('getBainHasmashos')) return 'Bain Hashmashos';
  if (id.startsWith('getSofZman')) return 'Sof Zman';
  if (id.startsWith('getShaahZmanis')) return 'Shaah Zmanis';
  if (id.startsWith('getTchilasZmanKidushLevana')) return 'Kiddush Levana (Start)';
  if (id.startsWith('getSofZmanKidushLevana')) return 'Kiddush Levana (End)';
  return 'Other';
};

const STORAGE_KEYS = {
  location: 'astra.zmanim.location',
  selection: 'astra.zmanim.methods',
};


const setDefaultLeafletIcon = () => {
  const iconRetinaUrl = new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).toString();
  const iconUrl = new URL('leaflet/dist/images/marker-icon.png', import.meta.url).toString();
  const shadowUrl = new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).toString();
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconRetinaUrl,
    iconUrl,
    shadowUrl,
  });
};

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center);
  }, [map, center]);
  return null;
}

function MapClicker({ onSelect }: { onSelect: (lat: number, lon: number) => void }) {
  useMapEvents({
    click(event) {
      onSelect(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export default function ZmanimClock() {
  const [methods, setMethods] = useState<ZmanimMethod[]>([]);
  const [methodDetails, setMethodDetails] = useState<Record<string, Partial<ZmanimMethod>>>({});
  const [selected, setSelected] = useState<string[]>([]);
  const [clockAnchors, setClockAnchors] = useState<Record<HalachicMode, HalachicAnchorSet>>({
    gra: {
      start: null,
      end: null,
      nightStart: null,
      nightEnd: null,
      dateChange: null,
    },
    mga: {
      start: null,
      end: null,
      nightStart: null,
      nightEnd: null,
      dateChange: null,
    },
    bht: {
      start: null,
      end: null,
      nightStart: null,
      nightEnd: null,
      dateChange: null,
    },
  });
  const [clockLoading, setClockLoading] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [timeValue, setTimeValue] = useState(() => new Date().toISOString().slice(11, 16));
  const [useLiveTime, setUseLiveTime] = useState(true);
  const [timezone, setTimezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [locationName, setLocationName] = useState('Jerusalem');
  const [lat, setLat] = useState('31.778');
  const [lon, setLon] = useState('35.235');
  const [elevation, setElevation] = useState('800');
  const [useElevation, setUseElevation] = useState(true);
  const [autoElevation, setAutoElevation] = useState(true);
  const [elevationLoading, setElevationLoading] = useState(false);
  const [elevationError, setElevationError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [results, setResults] = useState<ZmanimResults>({});
  const [errors, setErrors] = useState<ZmanimErrors>({});
  const [now, setNow] = useState(() => new Date());
  const displayTimestamp = useMemo(() => {
    return useLiveTime ? now : buildZonedDate(date, timeValue, timezone);
  }, [useLiveTime, now, date, timeValue, timezone]);
  const effectiveDate = useMemo(() => {
    return useLiveTime ? formatDateValue(displayTimestamp, timezone) : date;
  }, [useLiveTime, displayTimestamp, timezone, date]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.location);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        name?: string;
        lat?: string;
        lon?: string;
        elevation?: string;
        useElevation?: boolean;
        autoElevation?: boolean;
      };
      if (saved?.name) setLocationName(saved.name);
      if (saved?.lat) setLat(saved.lat);
      if (saved?.lon) setLon(saved.lon);
      if (saved?.elevation) setElevation(saved.elevation);
      if (typeof saved?.useElevation === 'boolean') setUseElevation(saved.useElevation);
      if (typeof saved?.autoElevation === 'boolean') setAutoElevation(saved.autoElevation);
    } catch (err) {
      console.warn('Failed to load saved location', err);
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.selection);
      if (!raw) return;
      const saved = JSON.parse(raw) as string[];
      if (Array.isArray(saved) && saved.length) {
        setSelected(saved);
      }
    } catch (err) {
      console.warn('Failed to load saved methods', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/zmanim.json')
      .then((response) => (response.ok ? response.json() : Promise.reject(response.statusText)))
      .then((data) => {
        if (!active || !Array.isArray(data)) return;
        const nextDetails: Record<string, Partial<ZmanimMethod>> = {};
        data.forEach((entry) => {
          if (entry?.id) {
            nextDetails[entry.id] = entry;
          }
        });
        setMethodDetails(nextDetails);
      })
      .catch((err) => {
        console.warn('Failed to load zmanim.json details', err);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setDefaultLeafletIcon();
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    api.getZmanimMethods()
      .then((data) => {
        if (!active) return;
        const list = data.methods || [];
        setMethods(list);
        if (selected.length === 0) {
          const available = new Set(list.map((m: ZmanimMethod) => m.id));
          setSelected(CORE_METHODS.filter((id) => available.has(id)));
        } else {
          const available = new Set(list.map((m: ZmanimMethod) => m.id));
          setSelected((prev) => prev.filter((id) => available.has(id)));
        }
      })
      .catch((err) => console.error('Failed to load zmanim methods', err));
    return () => {
      active = false;
    };
  }, [selected.length]);

  const mergedMethods = useMemo(() => {
    if (!methods.length) return methods;
    if (!Object.keys(methodDetails).length) return methods;
    return methods.map((method) => {
      const detail = methodDetails[method.id];
      return detail ? { ...detail, ...method } : method;
    });
  }, [methods, methodDetails]);

  useEffect(() => {
    let active = true;
    if (!lat || !lon) return () => {};
    const allMethods = Array.from(
      new Set(Object.values(HALACHIC_MODES).flatMap((mode) => [
        mode.start,
        mode.end,
        mode.nightStart,
        mode.nightEnd,
        mode.dateChange,
      ])),
    );
    const payload = {
      date: effectiveDate,
      timezone,
      location: {
        name: locationName.trim() || 'Custom',
        lat: Number(lat),
        lon: Number(lon),
        elevation_m: elevation ? Number(elevation) : null,
      },
      methods: allMethods,
      use_elevation: useElevation,
    };
    const parseDate = (value: unknown) => {
      if (typeof value !== 'string') return null;
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    };
    setClockLoading(true);
    api.calculateZmanim(payload)
      .then((data) => {
        if (!active) return;
        const nextAnchors = {} as Record<HalachicMode, HalachicAnchorSet>;
        (Object.keys(HALACHIC_MODES) as HalachicMode[]).forEach((modeKey) => {
          const mode = HALACHIC_MODES[modeKey];
          const error =
            data.errors?.[mode.start] ||
            data.errors?.[mode.end] ||
            data.errors?.[mode.nightStart] ||
            data.errors?.[mode.nightEnd] ||
            data.errors?.[mode.dateChange];
          nextAnchors[modeKey] = {
            start: parseDate(data.results?.[mode.start]),
            end: parseDate(data.results?.[mode.end]),
            nightStart: parseDate(data.results?.[mode.nightStart]),
            nightEnd: parseDate(data.results?.[mode.nightEnd]),
            dateChange: parseDate(data.results?.[mode.dateChange]),
            error: error ? String(error) : undefined,
          };
        });
        setClockAnchors(nextAnchors);
      })
      .catch((err) => {
        if (!active) return;
        const nextAnchors = {} as Record<HalachicMode, HalachicAnchorSet>;
        (Object.keys(HALACHIC_MODES) as HalachicMode[]).forEach((modeKey) => {
          nextAnchors[modeKey] = {
            start: null,
            end: null,
            nightStart: null,
            nightEnd: null,
            dateChange: null,
            error: String(err),
          };
        });
        setClockAnchors(nextAnchors);
      })
      .finally(() => {
        if (active) setClockLoading(false);
      });
    return () => {
      active = false;
    };
  }, [effectiveDate, timezone, lat, lon, elevation, useElevation, locationName]);

  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  const mapCenter: [number, number] = [
    Number.isFinite(parsedLat) ? parsedLat : 31.778,
    Number.isFinite(parsedLon) ? parsedLon : 35.235,
  ];

  useEffect(() => {
    if (!methods.length) return;
    try {
      localStorage.setItem(STORAGE_KEYS.selection, JSON.stringify(selected));
    } catch (err) {
      console.warn('Failed to save selected methods', err);
    }
  }, [selected, methods.length]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEYS.location,
        JSON.stringify({
          name: locationName,
          lat,
          lon,
          elevation,
          useElevation,
          autoElevation,
        }),
      );
    } catch (err) {
      console.warn('Failed to save location', err);
    }
  }, [locationName, lat, lon, elevation, useElevation, autoElevation]);

  const handleCalculate = async () => {
    setErrors({});
    try {
      const payload = {
        date: effectiveDate,
        timezone,
        location: {
          name: locationName.trim() || 'Custom',
          lat: Number(lat),
          lon: Number(lon),
          elevation_m: elevation ? Number(elevation) : null,
        },
        methods: selected,
        use_elevation: useElevation,
      };
      const data = await api.calculateZmanim(payload);
      setResults(data.results || {});
      setErrors(data.errors || {});
    } catch (err) {
      console.error('Failed to calculate zmanim', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchLoading(true);
    try {
      const params = new URLSearchParams({
        q: searchQuery,
        format: 'jsonv2',
        limit: '6',
      });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'astra-zmanim-client',
        },
      });
      if (!response.ok) {
        throw new Error('Search failed');
      }
      const data = (await response.json()) as GeoResult[];
      setSearchResults(data);
    } catch (err) {
      console.error('Failed to search location', err);
    } finally {
      setSearchLoading(false);
    }
  };

  const fetchElevation = async (latValue: number, lonValue: number) => {
    if (!Number.isFinite(latValue) || !Number.isFinite(lonValue)) {
      return;
    }
    setElevationLoading(true);
    setElevationError(null);
    try {
      const data = await api.getElevation(latValue, lonValue);
      if (typeof data.elevation_m === 'number') {
        setElevation(Math.round(data.elevation_m).toString());
      } else {
        setElevation('');
      }
    } catch (err) {
      console.error('Failed to fetch elevation', err);
      setElevationError('Failed to fetch elevation');
    } finally {
      setElevationLoading(false);
    }
  };

  const updateCoordinates = (latValue: number, lonValue: number, name?: string) => {
    const normalizedLat = clampLat(latValue);
    const normalizedLon = normalizeLon(lonValue);
    setLat(normalizedLat.toFixed(6));
    setLon(normalizedLon.toFixed(6));
    if (name) setLocationName(name);
    if (autoElevation) {
      void fetchElevation(normalizedLat, normalizedLon);
    }
    fetchTimeZoneForCoords(normalizedLat, normalizedLon)
      .then((tz) => {
        if (tz) setTimezone(tz);
      })
      .catch((err) => console.warn('Timezone lookup failed', err));
  };

  const handleSelectResult = (item: GeoResult) => {
    updateCoordinates(Number(item.lat), Number(item.lon), item.display_name);
    setSearchResults([]);
  };

  const handleGeoLocate = () => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateCoordinates(pos.coords.latitude, pos.coords.longitude, 'Current location');
      },
      (err) => {
        console.error('Geolocation error', err);
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  };

  const selectedKey = useMemo(() => selected.slice().sort().join('|'), [selected]);

  useEffect(() => {
    if (!selected.length) return;
    const timer = window.setTimeout(() => {
      void handleCalculate();
    }, 350);
    return () => window.clearTimeout(timer);
  }, [
    selectedKey,
    effectiveDate,
    timezone,
    lat,
    lon,
    elevation,
    useElevation,
    locationName,
  ]);

  const sortedSelected = useMemo(() => {
    const methodMap = new Map(methods.map((method) => [method.id, method]));
    const sortable = selected.map((id) => {
      const meta = methodMap.get(id);
      const raw = results[id];
      let timeValue = Number.POSITIVE_INFINITY;
      if (meta?.type === 'time' && typeof raw === 'string') {
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
          timeValue = parsed.getTime();
        }
      }
      return { id, timeValue };
    });
    sortable.sort((a, b) => {
      if (a.timeValue !== b.timeValue) return a.timeValue - b.timeValue;
      return a.id.localeCompare(b.id);
    });
    return sortable.map((item) => item.id);
  }, [selected, results, methods]);

  return (
    <div className="h-screen w-full flex flex-col overflow-hidden">
      <TopBar />
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full grid gap-4 grid-cols-1 lg:grid-cols-[320px,minmax(0,1.6fr),340px]">
          <div className="space-y-4 min-h-0 overflow-y-auto pr-1">
            <Card className="self-start">
              <CardHeader>
                <CardTitle>Настройки часов</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Дата</label>
                    <Input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      disabled={useLiveTime}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Время</label>
                    <Input
                      type="time"
                      value={timeValue}
                      onChange={(e) => setTimeValue(e.target.value)}
                      disabled={useLiveTime}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 px-3 py-2">
                    <div className="text-sm">Реальное время</div>
                    <Switch
                      checked={useLiveTime}
                      onChange={(e) => setUseLiveTime(e.target.checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Часовой пояс</label>
                    <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Локация</label>
                  <Input value={locationName} onChange={(e) => setLocationName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Широта</label>
                    <Input value={lat} onChange={(e) => setLat(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Долгота</label>
                    <Input value={lon} onChange={(e) => setLon(e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-[1fr,auto] items-center gap-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Высота (м)</label>
                    <Input
                      value={elevation}
                      onChange={(e) => setElevation(e.target.value)}
                      disabled={autoElevation}
                    />
                    {elevationError ? (
                      <div className="text-xs text-destructive">{elevationError}</div>
                    ) : null}
                  </div>
                  <div className="mt-6">
                    <Switch checked={useElevation} onChange={(e) => setUseElevation(e.target.checked)} />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm">Автовысота</div>
                  <Switch
                    checked={autoElevation}
                    onChange={(e) => {
                      const next = e.target.checked;
                      setAutoElevation(next);
                      if (next) {
                        const latValue = Number(lat);
                        const lonValue = Number(lon);
                        void fetchElevation(latValue, lonValue);
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const latValue = Number(lat);
                    const lonValue = Number(lon);
                    void fetchElevation(latValue, lonValue);
                  }}
                  disabled={elevationLoading}
                >
                  {elevationLoading ? 'Обновляем высоту...' : 'Обновить высоту'}
                </Button>
                <div className="text-xs text-muted-foreground">
                  Пересчет выполняется автоматически при изменении параметров.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Карта и поиск</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Поиск адреса (Nominatim)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Button type="button" variant="secondary" onClick={handleSearch} disabled={searchLoading}>
                    {searchLoading ? '...' : 'Найти'}
                  </Button>
                </div>
                {searchResults.length > 0 ? (
                  <div className="max-h-40 overflow-y-auto border border-border/40 rounded-lg">
                    {searchResults.map((item) => (
                      <button
                        key={item.place_id}
                        type="button"
                        onClick={() => handleSelectResult(item)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/40"
                      >
                        {item.display_name}
                      </button>
                    ))}
                  </div>
                ) : null}
                <Button type="button" variant="outline" onClick={handleGeoLocate}>
                  Моя геолокация
                </Button>
                <div className="h-56 overflow-hidden rounded-xl border border-border/40">
                  <MapContainer center={mapCenter} zoom={11} className="h-full w-full">
                    <TileLayer
                      attribution="(c) OpenStreetMap contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={mapCenter} />
                    <MapUpdater center={mapCenter} />
                    <MapClicker onSelect={(latValue, lonValue) => {
                      updateCoordinates(latValue, lonValue);
                    }} />
                  </MapContainer>
                </div>
                <div className="text-xs text-muted-foreground">
                  Кликните по карте, чтобы обновить координаты.
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
            <Card className="min-h-[260px]">
              <CardHeader>
                <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <span>Небо</span>
                  <AstroEventsDialog
                    lat={Number(lat)}
                    lon={Number(lon)}
                    elevation={Number(elevation)}
                    timestamp={displayTimestamp}
                    timeZone={timezone}
                  />
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 h-[220px] md:h-[240px] lg:h-[260px]">
                <SkyPanorama
                  lat={Number(lat)}
                  lon={Number(lon)}
                  elevation={Number(elevation)}
                  timestamp={displayTimestamp}
                />
              </CardContent>
            </Card>
            <Card className="min-h-[200px]">
              <CardHeader>
                <CardTitle className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <span>Часы</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl border border-border/40 bg-muted/30 p-3">
                    <div className="text-sm text-muted-foreground">Гражданское время</div>
                    <div className="mt-1 text-2xl font-semibold tracking-tight font-mono">
                      {formatClockTime(displayTimestamp, timezone)}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDateWithZone(displayTimestamp, timezone)}
                    </div>
                  </div>
                  {(Object.keys(HALACHIC_MODES) as HalachicMode[]).map((modeKey) => {
                    const config = HALACHIC_MODES[modeKey];
                    const anchors = clockAnchors[modeKey];
                    const label = anchors.start && anchors.end && anchors.nightStart && anchors.nightEnd
                      ? (() => {
                        const halachic = formatHalachicTime(
                          anchors.start,
                          anchors.end,
                          anchors.nightStart,
                          anchors.nightEnd,
                          displayTimestamp,
                        );
                        return `${halachic.label} (${String(halachic.partsTotal ?? 0).padStart(4, '0')}) ${halachic.period}`;
                      })()
                      : clockLoading
                        ? 'Загрузка...'
                        : '---';
                    const hebrewDate = (() => {
                      if (!anchors.dateChange) {
                        return formatHebrewDate(displayTimestamp, timezone);
                      }
                      const nextDay = displayTimestamp.getTime() >= anchors.dateChange.getTime();
                      const displayDate = new Date(displayTimestamp.getTime() + (nextDay ? 24 * 60 * 60 * 1000 : 0));
                      return formatHebrewDate(displayDate, timezone);
                    })();
                    return (
                      <div key={modeKey} className="rounded-xl border border-border/40 bg-muted/30 p-3">
                        <div className="text-sm text-muted-foreground">{config.label}</div>
                        <div className="mt-1 text-2xl font-semibold tracking-tight font-mono">
                          {anchors.error ? 'Недоступно' : label}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground" dir="rtl">
                          {hebrewDate}
                        </div>
                        {anchors.error ? (
                          <div className="mt-2 text-xs text-destructive">
                            {anchors.error}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            <Card className="flex-1 min-h-0 flex flex-col">
              <CardHeader>
                <CardTitle>Результаты</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 flex-1 min-h-0 overflow-y-auto pr-2">
                {sortedSelected.length === 0 ? (
                  <div className="text-sm text-muted-foreground">Выберите мнения справа.</div>
                ) : (
                  sortedSelected.map((id) => {
                    const value = results[id];
                    const error = errors[id];
                    const details = methodDetails[id];
                    const label = details?.menu_ru || details?.title_ru || humanizeMethod(id);
                    let display = value;
                    const countdown = typeof value === 'string' ? buildCountdown(value, displayTimestamp) : null;
                    let countdownClass = 'text-emerald-500';
                    if (countdown) {
                      if (countdown.passed) {
                        countdownClass = 'text-muted-foreground';
                      } else if (countdown.diff <= 30 * 60 * 1000) {
                        countdownClass = 'text-red-500';
                      } else if (countdown.diff <= 2 * 60 * 60 * 1000) {
                        countdownClass = 'text-amber-400';
                      } else if (countdown.diff <= 6 * 60 * 60 * 1000) {
                        countdownClass = 'text-yellow-400';
                      }
                    }
                    if (typeof value === 'number') {
                      display = formatDuration(value);
                    } else if (typeof value === 'string') {
                      display = formatZmanimValue(value, timezone);
                    }
                    return (
                      <div
                        key={id}
                        className={`flex items-start justify-between gap-2 border-b border-border/20 py-1 ${
                          countdown?.passed ? 'opacity-60' : ''
                        }`}
                      >
                        <div className="text-xs font-medium">{label}</div>
                        <div className="text-xs text-right">
                          {error ? (
                            <span className="text-destructive">{error}</span>
                          ) : (
                            <div className="text-right">
                              <div className="font-mono">{display ?? '-'}</div>
                              {countdown ? (
                                <div className={`text-[11px] ${countdownClass}`}>{countdown.text}</div>
                              ) : null}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>
          </div>

          <div className="h-full min-h-0">
            <OpinionsPanel
              methods={mergedMethods}
              selected={selected}
              onChangeSelected={setSelected}
              presets={PRESETS}
              defaultSet={CORE_METHODS}
              humanizeMethod={humanizeMethod}
              getGroupName={getGroupName}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
