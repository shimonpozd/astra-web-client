import * as Astronomy from 'astronomy-engine';
import { DEG_TO_RAD, EventMarker, MoonPoint, Point } from './constants';

export const normalizeAzimuth = (az: number) => {
  let value = az % 360;
  if (value < 0) value += 360;
  return value;
};

export const getSkyGradient = (sunAlt: number) => {
  if (sunAlt > 10) return { top: '#38bdf8', mid: '#0ea5e9', bottom: '#bae6fd' };
  if (sunAlt > 0) return { top: '#f97316', mid: '#fdba74', bottom: '#bae6fd' };
  if (sunAlt > -12) return { top: '#4338ca', mid: '#6366f1', bottom: '#f472b6' };
  return { top: '#0f172a', mid: '#1e1b4b', bottom: '#312e81' };
};

export const buildPathPoints = (
  observer: Astronomy.Observer,
  body: string,
  base: Date,
  withPhase = false,
) => {
  const points: (Point | MoonPoint)[] = [];
  const start = new Date(base);
  start.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 24 * 6; i += 1) {
    const t = new Date(start.getTime() + i * 10 * 60000);
    const eq = Astronomy.Equator(body, t, observer, true, true);
    const hor = Astronomy.Horizon(t, observer, eq.ra, eq.dec, 'normal');
    const point: Partial<MoonPoint> = { az: normalizeAzimuth(hor.azimuth), alt: hor.altitude };
    if (withPhase) {
      const illum = Astronomy.Illumination(body, t);
      point.phase =
        illum.phase_fraction ??
        Math.min(1, Math.max(0, (1 - Math.cos(illum.phase_angle * DEG_TO_RAD)) / 2));
    }
    points.push(point as Point | MoonPoint);
  }
  return points;
};

export const createSafePath = (points: Point[], width: number, height: number) => {
  if (!points.length) return '';
  const mapX = (az: number) => (az / 360) * width;
  const mapY = (alt: number) => height / 2 - (alt / 90) * (height / 2);
  let d = '';
  let isFirst = true;
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const x = mapX(p.az);
    const y = mapY(p.alt);
    if (isFirst) {
      d += `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      isFirst = false;
      continue;
    }

    const prev = points[i - 1];
    const delta = p.az - prev.az;
    if (Math.abs(delta) > 300) {
      const wrapSpan = delta > 0 ? 360 - p.az + prev.az : 360 - prev.az + p.az;
      const toEdge = delta > 0 ? 360 - p.az : 360 - prev.az;
      const t = wrapSpan === 0 ? 0 : toEdge / wrapSpan;
      const edgeAlt = prev.alt + (p.alt - prev.alt) * t;

      const edgeX = delta > 0 ? 0 : width;
      const edgeAltY = mapY(edgeAlt);
      d += ` L ${edgeX.toFixed(1)} ${edgeAltY.toFixed(1)}`;

      const startX = delta > 0 ? width : 0;
      d += ` M ${startX.toFixed(1)} ${edgeAltY.toFixed(1)} L ${x.toFixed(1)} ${y.toFixed(1)}`;
    } else {
      d += ` L ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
  }
  return d;
};

export const segmentPaths = (points: Point[], width: number, height: number) => {
  const segments: { zone: 'day' | 'twilight' | 'night'; d: string }[] = [];
  let current: Point[] = [];
  let currentZone: 'day' | 'twilight' | 'night' | null = null;

  const zoneForAlt = (alt: number) => {
    if (alt >= 0) return 'day';
    if (alt >= -12) return 'twilight';
    return 'night';
  };

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const zone = zoneForAlt(p.alt);
    if (currentZone === null) {
      currentZone = zone;
      current = [p];
      continue;
    }
    const prev = points[i - 1];
    const wrap = Math.abs(p.az - prev.az) > 300;
    if (zone !== currentZone || wrap) {
      if (current.length) {
        segments.push({ zone: currentZone, d: createSafePath(current, width, height) });
      }
      currentZone = zone;
      current = [p];
      continue;
    }
    current.push(p);
  }
  if (current.length && currentZone) {
    segments.push({ zone: currentZone, d: createSafePath(current, width, height) });
  }
  return segments;
};

export const segmentMoonPaths = (points: MoonPoint[], width: number, height: number) => {
  const segments: { d: string; phase: number }[] = [];
  let current: MoonPoint[] = [];
  let phaseSum = 0;
  let count = 0;

  const flush = () => {
    if (!current.length) return;
    segments.push({ d: createSafePath(current, width, height), phase: phaseSum / Math.max(1, count) });
    current = [];
    phaseSum = 0;
    count = 0;
  };

  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    current.push(p);
    phaseSum += p.phase;
    count += 1;
  }
  flush();
  return segments;
};

export const findRiseSetMarkers = (
  observer: Astronomy.Observer,
  body: string,
  base: Date,
  riseLabel: string,
  setLabel: string,
) => {
  const events: EventMarker[] = [];
  const rise = Astronomy.SearchRiseSet(body, observer, +1, base, 300);
  const set = Astronomy.SearchRiseSet(body, observer, -1, base, 300);
  if (rise) {
    const eq = Astronomy.Equator(body, rise.date, observer, true, true);
    const h = Astronomy.Horizon(rise.date, observer, eq.ra, eq.dec, 'normal');
    events.push({ label: riseLabel, az: normalizeAzimuth(h.azimuth), alt: 0, time: rise.date });
  }
  if (set) {
    const eq = Astronomy.Equator(body, set.date, observer, true, true);
    const h = Astronomy.Horizon(set.date, observer, eq.ra, eq.dec, 'normal');
    events.push({ label: setLabel, az: normalizeAzimuth(h.azimuth), alt: 0, time: set.date });
  }
  return events;
};

export const phaseName = (fraction: number, waxing: boolean) => {
  if (fraction < 0.03) return 'New Moon';
  if (fraction < 0.25) return waxing ? 'Waxing Crescent' : 'Waning Crescent';
  if (fraction < 0.35) return waxing ? 'First Quarter' : 'Last Quarter';
  if (fraction < 0.5) return waxing ? 'Waxing Gibbous' : 'Waning Gibbous';
  if (fraction < 0.53) return 'Full Moon';
  return waxing ? 'Waxing Gibbous' : 'Waning Gibbous';
};

export const formatTime = (value: Date) =>
  value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const formatDate = (value: Date) =>
  value.toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' });

export const formatDuration = (ms: number) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}h ${minutes}m ${seconds}s`;
};
