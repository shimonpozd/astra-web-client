import { useMemo, useRef } from 'react';
import * as Astronomy from 'astronomy-engine';
import {
  BRIGHT_STARS,
  DEG_TO_RAD,
  MoonPoint,
  PLANET_COLORS,
  PLANET_LIST,
  PlanetPoint,
  Point,
  StarPoint,
} from '../zmanim/constants';
import { buildPathPoints, getSkyGradient, normalizeAzimuth, phaseName } from '../zmanim/astro-utils';
import {
  MoonPhase,
  OrbitData,
  RiseSet,
  SkyData,
  SkyObject,
  SystemPlanet,
  YearExtremes,
} from './types';

const AU_TO_MKM = 149.5978707;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const translatePhase = (label: string) => {
  const map: Record<string, string> = {
    'New Moon': 'Новолуние',
    'Waxing Crescent': 'Растущий серп',
    'Waning Crescent': 'Убывающий серп',
    'First Quarter': 'Первая четверть',
    'Last Quarter': 'Последняя четверть',
    'Waxing Gibbous': 'Растущая луна',
    'Waning Gibbous': 'Убывающая луна',
    'Full Moon': 'Полнолуние',
  };
  return map[label] ?? label;
};

export function useSkyData({
  lat,
  lon,
  elevation = 0,
  timestamp,
}: {
  lat: number;
  lon: number;
  elevation?: number;
  timestamp: Date;
}): SkyData {
  const yearlyCacheRef = useRef(new Map<string, YearExtremes>());

  const observer = useMemo(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return new Astronomy.Observer(lat, lon, elevation);
  }, [lat, lon, elevation]);

  const sun = useMemo<SkyObject | null>(() => {
    if (!observer) return null;
    const eq = Astronomy.Equator('Sun', timestamp, observer, true, true);
    const hor = Astronomy.Horizon(timestamp, observer, eq.ra, eq.dec, 'normal');
    return { alt: hor.altitude, az: normalizeAzimuth(hor.azimuth) };
  }, [observer, timestamp]);

  const moon = useMemo<SkyObject | null>(() => {
    if (!observer) return null;
    const eq = Astronomy.Equator('Moon', timestamp, observer, true, true);
    const hor = Astronomy.Horizon(timestamp, observer, eq.ra, eq.dec, 'normal');
    return { alt: hor.altitude, az: normalizeAzimuth(hor.azimuth) };
  }, [observer, timestamp]);

  const moonPhase = useMemo<MoonPhase | null>(() => {
    if (!observer) return null;
    const illum = Astronomy.Illumination('Moon', timestamp);
    const later = new Date(timestamp.getTime() + 60 * 60 * 1000);
    const moonLater = Astronomy.Illumination('Moon', later);
    const phaseFraction =
      illum.phase_fraction ??
      Math.min(1, Math.max(0, (1 - Math.cos(illum.phase_angle * DEG_TO_RAD)) / 2));
    const waxing = moonLater.phase_angle >= illum.phase_angle;
    const label = translatePhase(phaseName(phaseFraction, waxing));
    return { fraction: phaseFraction, angle: illum.phase_angle, waxing, label };
  }, [observer, timestamp]);

  const paths = useMemo(() => {
    if (!observer) return null;
    return {
      sunPath: buildPathPoints(observer, 'Sun', timestamp) as Point[],
      moonPath: buildPathPoints(observer, 'Moon', timestamp, true) as MoonPoint[],
    };
  }, [observer, timestamp]);

  const planets = useMemo(() => {
    if (!observer) return [] as PlanetPoint[];
    return PLANET_LIST.map((name) => {
      const eq = Astronomy.Equator(name, timestamp, observer, true, true);
      const hor = Astronomy.Horizon(timestamp, observer, eq.ra, eq.dec, 'normal');
      const illum = name === 'Pluto' ? null : Astronomy.Illumination(name, timestamp);
      const mag = illum?.mag ?? 99;
      return {
        name,
        az: normalizeAzimuth(hor.azimuth),
        alt: hor.altitude,
        color: PLANET_COLORS[name] ?? '#94a3b8',
        mag,
      };
    }).filter((planet) => planet.alt > -5 && (planet.mag ?? 99) < 5);
  }, [observer, timestamp]);

  const stars = useMemo(() => {
    if (!observer) return [] as StarPoint[];
    return BRIGHT_STARS.map((star) => {
      const hor = Astronomy.Horizon(timestamp, observer, star.ra, star.dec, 'normal');
      return {
        name: star.name,
        az: normalizeAzimuth(hor.azimuth),
        alt: hor.altitude,
        mag: star.mag,
        color: star.color,
      };
    }).filter((star) => star.alt > -5);
  }, [observer, timestamp]);

  const libration = useMemo(() => {
    if (!observer || typeof Astronomy.Libration !== 'function') return null;
    return Astronomy.Libration(timestamp);
  }, [observer, timestamp]);

  const moonRiseSet = useMemo<RiseSet | null>(() => {
    if (!observer || typeof Astronomy.SearchRiseSet !== 'function') return null;
    const base = new Date(timestamp);
    base.setHours(0, 0, 0, 0);
    const rise = Astronomy.SearchRiseSet('Moon', observer, +1, base, 300);
    const set = Astronomy.SearchRiseSet('Moon', observer, -1, base, 300);
    return { rise: rise?.date ?? null, set: set?.date ?? null };
  }, [observer, timestamp]);

  const solarNoon = useMemo(() => {
    if (!observer || typeof Astronomy.SearchHourAngle !== 'function') return null;
    const base = new Date(timestamp);
    base.setHours(0, 0, 0, 0);
    const result = Astronomy.SearchHourAngle('Sun', observer, 0, base);
    return result?.date ?? null;
  }, [observer, timestamp]);

  const yearExtremes = useMemo(() => {
    if (!observer) return null;
    const year = timestamp.getFullYear();
    const key = `${year}-${lat.toFixed(4)}-${lon.toFixed(4)}`;
    const cached = yearlyCacheRef.current.get(key);
    if (cached) return cached;
    const extremes: YearExtremes = {
      maxAlt: -90,
      minAlt: 90,
      minDayLen: Number.POSITIVE_INFINITY,
      maxDayLen: 0,
      minDist: Number.POSITIVE_INFINITY,
      maxDist: 0,
    };
    for (let month = 0; month < 12; month += 1) {
      const date = new Date(Date.UTC(year, month, 15, 12, 0, 0));
      const eq = Astronomy.Equator('Sun', date, observer, true, true);
      const hor = Astronomy.Horizon(date, observer, eq.ra, eq.dec, 'normal');
      extremes.maxAlt = Math.max(extremes.maxAlt, hor.altitude);
      extremes.minAlt = Math.min(extremes.minAlt, hor.altitude);
      if (typeof Astronomy.SearchRiseSet === 'function') {
        const sunrise = Astronomy.SearchRiseSet('Sun', observer, +1, date, 300);
        const sunset = Astronomy.SearchRiseSet('Sun', observer, -1, date, 300);
        if (sunrise?.date && sunset?.date) {
          const len = sunset.date.getTime() - sunrise.date.getTime();
          if (len > 0) {
            extremes.minDayLen = Math.min(extremes.minDayLen, len);
            extremes.maxDayLen = Math.max(extremes.maxDayLen, len);
          }
        }
      }
      if (typeof Astronomy.HelioVector === 'function') {
        const vec = Astronomy.HelioVector('Earth', date);
        const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
        extremes.minDist = Math.min(extremes.minDist, dist);
        extremes.maxDist = Math.max(extremes.maxDist, dist);
      }
    }
    yearlyCacheRef.current.set(key, extremes);
    return extremes;
  }, [observer, timestamp, lat, lon]);

  const sunRiseSet = useMemo<RiseSet | null>(() => {
    if (!observer || typeof Astronomy.SearchRiseSet !== 'function') return null;
    const base = new Date(timestamp);
    base.setHours(0, 0, 0, 0);
    const rise = Astronomy.SearchRiseSet('Sun', observer, +1, base, 300);
    const set = Astronomy.SearchRiseSet('Sun', observer, -1, base, 300);
    return { rise: rise?.date ?? null, set: set?.date ?? null };
  }, [observer, timestamp]);

  const ready = Boolean(observer && sun && moon && moonPhase && paths);
  const sunSafe: SkyObject = sun ?? { alt: 0, az: 0 };
  const moonSafe: SkyObject = moon ?? { alt: 0, az: 0 };
  const moonPhaseSafe: MoonPhase =
    moonPhase ??
    ({
      fraction: 0,
      angle: 0,
      waxing: true,
      label: 'Новолуние',
    } as MoonPhase);
  const pathsSafe = paths ?? { sunPath: [] as Point[], moonPath: [] as MoonPoint[] };

  const gradient = getSkyGradient(sunSafe.alt);
  const starAlpha = Math.min(1, Math.max(0, (-12 - sunSafe.alt) / 6));
  const moonGlow = sunSafe.alt < -6 ? 0.35 : 0.05;
  const moonShift = (moonPhaseSafe.fraction - 0.5) * 16 * (moonPhaseSafe.waxing ? -1 : 1);
  const moonTilt = libration ? libration.elon : 0;

  const equationOfTime =
    typeof Astronomy.EquationOfTime === 'function' ? Astronomy.EquationOfTime(timestamp) : 0;
  const equationOfTimeLabel = (() => {
    const totalSeconds = Math.round(equationOfTime * 60);
    const sign = totalSeconds >= 0 ? '+' : '-';
    const abs = Math.abs(totalSeconds);
    const minutes = Math.floor(abs / 60);
    const seconds = abs % 60;
    return `${sign}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  })();

  const airMass = (() => {
    if (sunSafe.alt <= 0) return null;
    const zenith = 90 - sunSafe.alt;
    const mass = 1 / Math.cos(zenith * DEG_TO_RAD);
    return clamp(mass, 1, 38);
  })();

  const insolation = (() => {
    const factor = Math.max(0, Math.sin(sunSafe.alt * DEG_TO_RAD));
    const watts = 1361 * factor * 0.7;
    return { watts, fraction: clamp(factor, 0, 1) };
  })();

  const dayArc = (() => {
    if (!yearExtremes || !sunRiseSet?.rise || !sunRiseSet?.set) return null;
    const len = Math.max(0, sunRiseSet.set.getTime() - sunRiseSet.rise.getTime());
    const range = yearExtremes.maxDayLen - yearExtremes.minDayLen;
    return range > 0 ? clamp((len - yearExtremes.minDayLen) / range, 0, 1) : null;
  })();

  const yearHeight = (() => {
    if (!yearExtremes) return null;
    const range = yearExtremes.maxAlt - yearExtremes.minAlt;
    return range > 0 ? clamp((sunSafe.alt - yearExtremes.minAlt) / range, 0, 1) : null;
  })();

  const dayClimb = (() => {
    if (!pathsSafe.sunPath.length) return null;
    const altMax = Math.max(...pathsSafe.sunPath.map((p) => p.alt));
    const altMin = Math.min(...pathsSafe.sunPath.map((p) => p.alt));
    const range = altMax - altMin;
    return range > 0 ? clamp((sunSafe.alt - altMin) / range, 0, 1) : null;
  })();

  const earthOrbit: OrbitData | null = (() => {
    if (!yearExtremes || typeof Astronomy.HelioVector !== 'function') return null;
    const vec = Astronomy.HelioVector('Earth', timestamp);
    const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    const range = yearExtremes.maxDist - yearExtremes.minDist;
    const percent = range > 0 ? clamp((dist - yearExtremes.minDist) / range, 0, 1) : null;
    return {
      percent,
      distanceMkm: dist * AU_TO_MKM,
    };
  })();

  const moonOrbit = (() => {
    if (typeof Astronomy.GeoVector !== 'function') return null;
    const vec = Astronomy.GeoVector('Moon', timestamp, true);
    const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    const km = dist * AU_TO_MKM * 1_000_000;
    const minKm = 363300;
    const maxKm = 405500;
    const percent = clamp((km - minKm) / (maxKm - minKm), 0, 1);
    return { percent, km };
  })();

  const sunSystemAngle = (sunSafe.az - 90) * DEG_TO_RAD;
  const moonOrbitAngle = (() => {
    if (typeof Astronomy.Elongation === 'function') {
      const elong = Astronomy.Elongation('Moon', timestamp);
      return sunSystemAngle + elong.elongation * DEG_TO_RAD;
    }
    return sunSystemAngle + moonPhaseSafe.angle * DEG_TO_RAD;
  })();

  const systemPlanets: SystemPlanet[] = (() => {
    const items = [...PLANET_LIST, 'Earth'];
    return items.map((name) => {
      const vec =
        name === 'Earth'
          ? typeof Astronomy.HelioVector === 'function'
            ? Astronomy.HelioVector('Earth', timestamp)
            : null
          : typeof Astronomy.HelioVector === 'function'
            ? Astronomy.HelioVector(name, timestamp)
            : null;
      if (!vec) {
        return { name, lon: 0, dist: 1, color: PLANET_COLORS[name] ?? '#94a3b8' };
      }
      const lon = Math.atan2(vec.y, vec.x);
      const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
      return { name, lon, dist, color: PLANET_COLORS[name] ?? '#94a3b8' };
    });
  })();

  const earthSystem = systemPlanets.find((planet) => planet.name === 'Earth');

  const sunColor = sunSafe.alt > 6 ? '#fbbf24' : sunSafe.alt > 0 ? '#fb923c' : '#ef4444';
  const sunGlow = sunSafe.alt > 6 ? '#fbbf24' : sunSafe.alt > 0 ? '#fb7185' : '#f97316';

  return {
    ready,
    sun: sunSafe,
    moon: moonSafe,
    moonPhase: moonPhaseSafe,
    paths: pathsSafe,
    planets,
    stars,
    gradient,
    starAlpha,
    sunColor,
    sunGlow,
    moonGlow,
    moonShift,
    moonTilt,
    moonPhaseLabel: moonPhaseSafe.label,
    equationOfTimeLabel,
    airMass,
    insolation,
    dayClimb,
    yearHeight,
    dayArc,
    earthOrbit,
    moonOrbit,
    sunRiseSet,
    moonRiseSet,
    solarNoon,
    systemPlanets,
    earthSystemLon: earthSystem?.lon ?? null,
    sunSystemAngle,
    moonOrbitAngle,
  };
}
