import { useEffect, useMemo, useRef, useState } from 'react';
import * as Astronomy from 'astronomy-engine';

type SkyPoint = {
  time: Date;
  alt: number;
  az: number;
};

type Marker = {
  id: 'sunrise' | 'sunset' | 'noon';
  label: string;
  time: Date;
  alt: number;
  az: number;
};

type MoonInfo = {
  alt: number;
  az: number;
  illumination: number;
  waxing: boolean;
};

const GRID_RINGS = [60, 30, 0];
const TWILIGHT_RING = -18;
const AZ_LINES = [0, 45, 90, 135, 180, 225, 270, 315];
const ZENITH = 90;
const MIN_ALT = -20;
const DEG_TO_RAD = Math.PI / 180;

const formatTime = (value: Date) =>
  value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDate = (value: Date) =>
  value.toLocaleDateString([], { year: 'numeric', month: 'short', day: '2-digit' });

const polarProject = (alt: number, az: number, radius: number) => {
  const clampedAlt = Math.max(MIN_ALT, Math.min(ZENITH, alt));
  const rNorm = (ZENITH - clampedAlt) / (ZENITH - MIN_ALT);
  const rPx = rNorm * radius;
  const theta = (az - 90) * DEG_TO_RAD;
  return {
    x: radius + rPx * Math.cos(theta),
    y: radius + rPx * Math.sin(theta),
  };
};

const normalizeAzimuth = (az: number) => {
  let value = az % 360;
  if (value < 0) value += 360;
  return value;
};

const getSunPalette = (alt: number) => {
  if (alt > 6) {
    return { core: '#7dd3fc', edge: '#f8fafc', glow: '#38bdf8' };
  }
  if (alt > 0) {
    return { core: '#fbbf24', edge: '#fde68a', glow: '#f59e0b' };
  }
  if (alt > -18) {
    return { core: '#7c3aed', edge: '#1e1b4b', glow: '#a855f7' };
  }
  return { core: '#0b1020', edge: '#020617', glow: '#1e293b' };
};

const computeIllumination = (phaseAngle: number) => {
  const fraction = (1 - Math.cos(phaseAngle * DEG_TO_RAD)) / 2;
  return Math.round(fraction * 100);
};

const computeMoonInfo = (observer: Astronomy.Observer, time: Date): MoonInfo => {
  const moonEq = Astronomy.Equator('Moon', time, observer, true, true);
  const moonHor = Astronomy.Horizon(time, observer, moonEq.ra, moonEq.dec, 'normal');
  const phaseNow = Astronomy.MoonPhase(time);
  const oneHourLater = new Date(time.getTime() + 60 * 60 * 1000);
  const phaseLater = Astronomy.MoonPhase(oneHourLater);
  const waxing = phaseLater >= phaseNow;
  return {
    alt: moonHor.altitude,
    az: normalizeAzimuth(moonHor.azimuth),
    illumination: computeIllumination(phaseNow),
    waxing,
  };
};

const buildDayPath = (observer: Astronomy.Observer, body: 'Sun' | 'Moon', day: Date) => {
  const points: SkyPoint[] = [];
  const start = new Date(day);
  start.setHours(0, 0, 0, 0);
  for (let minutes = 0; minutes < 1440; minutes += 10) {
    const sample = new Date(start.getTime() + minutes * 60 * 1000);
    const eq = Astronomy.Equator(body, sample, observer, true, true);
    const hor = Astronomy.Horizon(sample, observer, eq.ra, eq.dec, 'normal');
    points.push({
      time: sample,
      alt: hor.altitude,
      az: normalizeAzimuth(hor.azimuth),
    });
  }
  return points;
};

const findMarkers = (sunPath: SkyPoint[]) => {
  const markers: Marker[] = [];
  for (let i = 1; i < sunPath.length; i += 1) {
    const prev = sunPath[i - 1];
    const curr = sunPath[i];
    if (prev.alt < 0 && curr.alt >= 0) {
      markers.push({ id: 'sunrise', label: 'Sunrise', time: curr.time, alt: curr.alt, az: curr.az });
    }
    if (prev.alt >= 0 && curr.alt < 0) {
      markers.push({ id: 'sunset', label: 'Sunset', time: curr.time, alt: curr.alt, az: curr.az });
    }
  }
  const noon = [...sunPath].sort((a, b) => b.alt - a.alt)[0];
  if (noon) {
    markers.push({ id: 'noon', label: 'Chatzos', time: noon.time, alt: noon.alt, az: noon.az });
  }
  return markers;
};

const buildSvgPath = (points: SkyPoint[], radius: number) => {
  return points
    .map((point, idx) => {
      const projected = polarProject(point.alt, point.az, radius);
      return `${idx === 0 ? 'M' : 'L'}${projected.x.toFixed(1)},${projected.y.toFixed(1)}`;
    })
    .join(' ');
};

const nextEventText = (markers: Marker[], now: Date, sunAbove: boolean) => {
  const sunset = markers.find((m) => m.id === 'sunset');
  const sunrise = markers.find((m) => m.id === 'sunrise');
  const target = sunAbove ? sunset : sunrise;
  if (!target) return 'No next event';
  const diff = target.time.getTime() - now.getTime();
  const minutes = Math.max(0, Math.floor(diff / 60000));
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${target.label} in ${hours}h ${mins}m`;
};

export function AstroRadar({
  lat,
  lon,
  elevation,
  timestamp,
  locationLabel,
}: {
  lat: number;
  lon: number;
  elevation: number;
  timestamp: Date;
  locationLabel?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 360, height: 360 });

  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      const width = Math.max(1, el.clientWidth);
      const height = Math.max(1, el.clientHeight);
      setSize({ width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const observer = new Astronomy.Observer(lat, lon, elevation || 0);
    const sunEq = Astronomy.Equator('Sun', timestamp, observer, true, true);
    const sunHor = Astronomy.Horizon(timestamp, observer, sunEq.ra, sunEq.dec, 'normal');
    const sunAlt = sunHor.altitude;
    const sunAz = normalizeAzimuth(sunHor.azimuth);
    const sunPath = buildDayPath(observer, 'Sun', timestamp);
    const moonPath = buildDayPath(observer, 'Moon', timestamp);
    const markers = findMarkers(sunPath);
    const moon = computeMoonInfo(observer, timestamp);
    return {
      sunAlt,
      sunAz,
      sunPath,
      moonPath,
      markers,
      moon,
      observer,
    };
  }, [lat, lon, elevation, timestamp]);

  const radius = Math.min(size.width, size.height) / 2 - 12;
  const center = { x: size.width / 2, y: size.height / 2 };

  if (!data) {
    return (
      <div className="h-full w-full rounded-xl border border-border/40 bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
        No coordinates for sky
      </div>
    );
  }

  const palette = getSunPalette(data.sunAlt);
  const sunPos = polarProject(data.sunAlt, data.sunAz, radius);
  const moonPos = polarProject(data.moon.alt, data.moon.az, radius);
  const nextEvent = nextEventText(data.markers, timestamp, data.sunAlt >= 0);

  return (
    <div ref={containerRef} className="relative h-full w-full">
      <svg viewBox={`0 0 ${size.width} ${size.height}`} className="h-full w-full">
        <defs>
          <radialGradient id="skyGradient" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor={palette.core} stopOpacity="0.65" />
            <stop offset="70%" stopColor={palette.edge} stopOpacity="0.35" />
            <stop offset="100%" stopColor="#0f172a" stopOpacity="0.15" />
          </radialGradient>
          <filter id="sunGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <mask id="moonMask">
            <rect width="100%" height="100%" fill="black" />
            <circle cx={moonPos.x} cy={moonPos.y} r="9" fill="white" />
            <circle
              cx={moonPos.x + (data.moon.waxing ? -4 : 4)}
              cy={moonPos.y}
              r="9"
              fill="black"
            />
          </mask>
        </defs>
        <circle cx={center.x} cy={center.y} r={radius} fill="url(#skyGradient)" />
        <circle cx={center.x} cy={center.y} r={radius} fill="none" stroke="#64748b" strokeOpacity="0.6" />
        {GRID_RINGS.map((alt) => {
          const r = ((ZENITH - alt) / (ZENITH - MIN_ALT)) * radius;
          return (
            <circle
              key={`ring-${alt}`}
              cx={center.x}
              cy={center.y}
              r={r}
              fill="none"
              stroke="#64748b"
              strokeOpacity={alt === 0 ? 0.8 : 0.25}
              strokeWidth={alt === 0 ? 2 : 1}
            />
          );
        })}
        <circle
          cx={center.x}
          cy={center.y}
          r={((ZENITH - TWILIGHT_RING) / (ZENITH - MIN_ALT)) * radius}
          fill="none"
          stroke="#64748b"
          strokeDasharray="5 5"
          strokeOpacity="0.35"
        />
        {AZ_LINES.map((az) => {
          const outer = polarProject(MIN_ALT, az, radius);
          return (
            <line
              key={`az-${az}`}
              x1={center.x}
              y1={center.y}
              x2={outer.x}
              y2={outer.y}
              stroke="#64748b"
              strokeOpacity="0.2"
            />
          );
        })}
        <text x={center.x} y={14} textAnchor="middle" fontSize="11" fill="#38bdf8">
          N
        </text>
        <text x={size.width - 10} y={center.y} textAnchor="end" fontSize="11" fill="#f97316">
          E
        </text>
        <text x={center.x} y={size.height - 8} textAnchor="middle" fontSize="11" fill="#94a3b8">
          S
        </text>
        <text x={12} y={center.y} textAnchor="start" fontSize="11" fill="#94a3b8">
          W
        </text>

        <path
          d={buildSvgPath(data.sunPath, radius)}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="2"
          strokeOpacity="0.85"
        />
        <path
          d={buildSvgPath(data.moonPath, radius)}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="1.5"
          strokeDasharray="5 5"
          strokeOpacity="0.6"
        />

        {data.markers.map((marker) => {
          const pos = polarProject(marker.alt, marker.az, radius);
          return (
            <g key={marker.id}>
              <circle cx={pos.x} cy={pos.y} r={4} fill="#fbbf24" stroke="#0f172a" strokeWidth="1" />
              <title>{`${marker.label}: ${formatTime(marker.time)}`}</title>
            </g>
          );
        })}

        <circle cx={sunPos.x} cy={sunPos.y} r={10} fill="#fbbf24" filter="url(#sunGlow)" />
        <circle cx={moonPos.x} cy={moonPos.y} r={8} fill="#e2e8f0" mask="url(#moonMask)" />
      </svg>

      <div className="absolute left-4 top-4 text-xs font-medium text-slate-700 dark:text-slate-200">
        {formatDate(timestamp)} {formatTime(timestamp)}
      </div>
      <div className="absolute right-4 top-4 text-xs text-slate-600 dark:text-slate-300">
        {locationLabel ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`}
      </div>
      <div className="absolute left-4 bottom-4 text-xs text-slate-700 dark:text-slate-200">
        Sun Alt {data.sunAlt.toFixed(1)}° · Az {data.sunAz.toFixed(0)}° · {nextEvent}
      </div>
      <div className="absolute right-4 bottom-4 text-xs text-slate-600 dark:text-slate-300 text-right">
        Moon Alt {data.moon.alt.toFixed(1)}° · Az {data.moon.az.toFixed(0)}° · {data.moon.illumination}%{' '}
        {data.moon.waxing ? 'Waxing' : 'Waning'}
      </div>
    </div>
  );
}
