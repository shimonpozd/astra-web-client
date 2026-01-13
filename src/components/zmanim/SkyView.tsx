import { useEffect, useMemo, useRef, useState } from 'react';
import * as Astronomy from 'astronomy-engine';

const TWILIGHT_LINES = [
  { label: '-6°', altitude: -6 },
  { label: '-12°', altitude: -12 },
  { label: '-18°', altitude: -18 },
  { label: '-16.1°', altitude: -16.1 },
  { label: '-19.8°', altitude: -19.8 },
  { label: '0°', altitude: 0 },
];

const ALT_GRID = [90, 60, 45, 30, 15, 0, -15, -30, -45, -60, -75, -90];
const AZ_TICKS = [0, 45, 90, 135, 180, 225, 270, 315];
const DEG_TO_RAD = Math.PI / 180;

const toPhasePercent = (phaseAngle: number) => {
  const radians = phaseAngle * DEG_TO_RAD;
  const fraction = (1 - Math.cos(radians)) / 2;
  return Math.round(fraction * 100);
};

const normalizeAzimuth = (az: number) => {
  let value = az % 360;
  if (value < 0) value += 360;
  return value;
};

type SkyData = {
  sunAlt: number;
  sunAz: number;
  moonAlt: number;
  moonAz: number;
  moonPhase: number;
  moonIllumination: number;
  sunPath: Array<{ az: number; alt: number }>;
  moonPath: Array<{ az: number; alt: number }>;
};

export function SkyView({
  lat,
  lon,
  elevation,
  timestamp,
}: {
  lat: number;
  lon: number;
  elevation: number;
  timestamp: Date;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 720, height: 320 });
  const data = useMemo<SkyData | null>(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    const observer = new Astronomy.Observer(lat, lon, elevation || 0);
    const sunEq = Astronomy.Equator('Sun', timestamp, observer, true, true);
    const sunHor = Astronomy.Horizon(timestamp, observer, sunEq.ra, sunEq.dec, 'normal');
    const moonEq = Astronomy.Equator('Moon', timestamp, observer, true, true);
    const moonHor = Astronomy.Horizon(timestamp, observer, moonEq.ra, moonEq.dec, 'normal');
    const phase = Astronomy.MoonPhase(timestamp);
    const moonIllumination = toPhasePercent(phase);
    const baseDay = new Date(timestamp);
    const buildPath = (body: 'Sun' | 'Moon') => {
      const points: Array<{ az: number; alt: number }> = [];
      for (let hour = 0; hour < 24; hour += 1) {
        const sample = new Date(baseDay);
        sample.setHours(hour, 0, 0, 0);
        const eq = Astronomy.Equator(body, sample, observer, true, true);
        const hor = Astronomy.Horizon(sample, observer, eq.ra, eq.dec, 'normal');
        points.push({ az: normalizeAzimuth(hor.azimuth), alt: hor.altitude });
      }
      return points;
    };
    return {
      sunAlt: sunHor.altitude,
      sunAz: normalizeAzimuth(sunHor.azimuth),
      moonAlt: moonHor.altitude,
      moonAz: normalizeAzimuth(moonHor.azimuth),
      moonPhase: phase,
      moonIllumination,
      sunPath: buildPath('Sun'),
      moonPath: buildPath('Moon'),
    };
  }, [lat, lon, elevation, timestamp]);

  useEffect(() => {
    if (!containerRef.current) return;
    const element = containerRef.current;
    const updateSize = () => {
      const width = Math.max(1, element.clientWidth);
      const height = Math.max(1, element.clientHeight);
      setViewport({ width, height });
    };
    updateSize();
    const observer = new ResizeObserver(() => updateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const mapY = (altitude: number) => ((90 - altitude) / 180) * viewport.height;
  const mapX = (azimuth: number) => (azimuth / 360) * viewport.width;
  const buildSvgPath = (points: Array<{ az: number; alt: number }>) => {
    return points
      .map((point, idx) => {
        const x = mapX(point.az);
        const y = mapY(point.alt);
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  if (!data) {
    return (
      <div className="h-full rounded-xl border border-border/40 bg-muted/30 flex items-center justify-center text-sm text-muted-foreground">
        No coordinates for sky
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full rounded-xl border border-border/40 bg-gradient-to-b from-sky-100/60 to-slate-200/40 dark:from-slate-900/70 dark:to-slate-950/80 flex items-center justify-center"
    >
      <svg
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full block"
      >
        <defs>
          <linearGradient id="skyGlow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
            <stop offset="65%" stopColor="hsl(var(--muted))" stopOpacity="0.2" />
            <stop offset="100%" stopColor="hsl(var(--background))" stopOpacity="0.15" />
          </linearGradient>
          <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#fbbf24" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="url(#skyGlow)" />
        {AZ_TICKS.map((tick) => {
          const x = mapX(tick);
          return (
            <g key={`az-${tick}`}>
              <line x1={x} x2={x} y1="0" y2={viewport.height} stroke="#64748b" strokeOpacity="0.15" />
              <text x={x + 4} y={14} fill="#64748b" fontSize="10" opacity={0.7}>
                {tick}°
              </text>
            </g>
          );
        })}
        {ALT_GRID.map((alt) => {
          const y = mapY(alt);
          return (
            <g key={`alt-${alt}`}>
              <line x1="0" x2={viewport.width} y1={y} y2={y} stroke="#64748b" strokeOpacity="0.12" />
              <text x={viewport.width - 40} y={y - 4} fill="#64748b" fontSize="10" opacity={0.7}>
                {alt}°
              </text>
            </g>
          );
        })}
        {TWILIGHT_LINES.map((line) => {
          const y = mapY(line.altitude);
          const isHorizon = line.altitude === 0;
          return (
            <g key={line.label}>
              <line
                x1="0"
                x2={viewport.width}
                y1={y}
                y2={y}
                stroke={isHorizon ? '#0f172a' : '#94a3b8'}
                strokeOpacity={isHorizon ? 0.8 : 0.35}
                strokeDasharray={isHorizon ? '0' : '6 6'}
              />
              <text
                x={8}
                y={y - 4}
                fill="#64748b"
                fontSize="10"
                opacity={0.7}
              >
                {line.label}
              </text>
            </g>
          );
        })}
        <path
          d={buildSvgPath(data.sunPath)}
          fill="none"
          stroke="#f59e0b"
          strokeOpacity="0.45"
          strokeWidth="2"
        />
        <path
          d={buildSvgPath(data.moonPath)}
          fill="none"
          stroke="#e2e8f0"
          strokeOpacity="0.4"
          strokeWidth="2"
          strokeDasharray="6 6"
        />
        <circle
          cx={mapX(data.sunAz)}
          cy={mapY(data.sunAlt)}
          r="22"
          fill="url(#sunGlow)"
        />
        <circle
          cx={mapX(data.sunAz)}
          cy={mapY(data.sunAlt)}
          r="10"
          fill="#fbbf24"
          stroke="#f59e0b"
          strokeWidth="2"
          opacity={0.95}
        />
        <circle
          cx={mapX(data.moonAz)}
          cy={mapY(data.moonAlt)}
          r="8"
          fill="#e5e7eb"
          stroke="#cbd5f5"
          strokeWidth="2"
          opacity={0.9}
        />
        <text x={12} y={22} fill="#0f172a" fontSize="12" opacity={0.7}>
          Sun {data.sunAlt.toFixed(1)}° / {data.sunAz.toFixed(0)}°
        </text>
        <text x={12} y={38} fill="#0f172a" fontSize="12" opacity={0.7}>
          Moon {data.moonAlt.toFixed(1)}° / {data.moonAz.toFixed(0)}° · {data.moonIllumination}%
        </text>
        <text x={viewport.width - 70} y={22} fill="#0f172a" fontSize="12" opacity={0.7}>
          N 0°
        </text>
        <text x={viewport.width / 2 - 16} y={22} fill="#0f172a" fontSize="12" opacity={0.7}>
          S 180°
        </text>
        <text x={viewport.width - 70} y={viewport.height - 10} fill="#0f172a" fontSize="12" opacity={0.7}>
          E 90°
        </text>
        <text x={10} y={viewport.height - 10} fill="#0f172a" fontSize="12" opacity={0.7}>
          W 270°
        </text>
      </svg>
    </div>
  );
}
