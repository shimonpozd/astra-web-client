import { useEffect, useMemo, useRef, useState } from 'react';
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
} from './constants';
import {
  buildPathPoints,
  getSkyGradient,
  normalizeAzimuth,
  phaseName,
  segmentMoonPaths,
  segmentPaths,
} from './astro-utils';

export function SkyPanorama({
  lat,
  lon,
  elevation = 0,
  timestamp,
}: {
  lat: number;
  lon: number;
  elevation?: number;
  timestamp: Date;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [hoverInfo, setHoverInfo] = useState<{
    name: string;
    kind: 'sun' | 'moon' | 'planet' | 'star';
    alt: number;
    az: number;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setViewport({ width, height });
    });
    obs.observe(containerRef.current);
    return () => obs.disconnect();
  }, []);

  const observer = useMemo(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return new Astronomy.Observer(lat, lon, elevation);
  }, [lat, lon, elevation]);

  const sun = useMemo(() => {
    if (!observer) return null;
    const eq = Astronomy.Equator('Sun', timestamp, observer, true, true);
    const hor = Astronomy.Horizon(timestamp, observer, eq.ra, eq.dec, 'normal');
    return { alt: hor.altitude, az: normalizeAzimuth(hor.azimuth) };
  }, [observer, timestamp]);

  const moon = useMemo(() => {
    if (!observer) return null;
    const eq = Astronomy.Equator('Moon', timestamp, observer, true, true);
    const hor = Astronomy.Horizon(timestamp, observer, eq.ra, eq.dec, 'normal');
    return { alt: hor.altitude, az: normalizeAzimuth(hor.azimuth) };
  }, [observer, timestamp]);

  const moonPhase = useMemo(() => {
    if (!observer) return null;
    const illum = Astronomy.Illumination('Moon', timestamp);
    const later = new Date(timestamp.getTime() + 60 * 60 * 1000);
    const moonLater = Astronomy.Illumination('Moon', later);
    const phaseFraction =
      illum.phase_fraction ??
      Math.min(1, Math.max(0, (1 - Math.cos(illum.phase_angle * DEG_TO_RAD)) / 2));
    const waxing = moonLater.phase_angle >= illum.phase_angle;
    return { phaseFraction, phaseAngle: illum.phase_angle, moonMag: illum.mag, waxing };
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

  const mapX = (az: number) => (az / 360) * viewport.width;
  const mapY = (alt: number) => viewport.height / 2 - (alt / 90) * (viewport.height / 2);

  if (!viewport.width || !observer || !sun || !moon || !moonPhase || !paths) {
    return <div ref={containerRef} className="w-full h-full rounded-xl bg-slate-900/40" />;
  }

  const gradient = getSkyGradient(sun.alt);
  const pathSegments = segmentPaths(paths.sunPath, viewport.width, viewport.height);
  const moonSegments = segmentMoonPaths(paths.moonPath, viewport.width, viewport.height);
  const starAlpha = Math.min(1, Math.max(0, (-12 - sun.alt) / 6));
  const moonGlow = sun.alt < -6 ? 0.35 : 0.05;
  const moonShift = (moonPhase.phaseFraction - 0.5) * 16 * (moonPhase.waxing ? -1 : 1);
  const moonTilt = libration ? libration.elon : 0;
  const moonPhaseLabel = phaseName(moonPhase.phaseFraction, moonPhase.waxing);
  const equationOfTime =
    typeof Astronomy.EquationOfTime === 'function' ? Astronomy.EquationOfTime(timestamp) : 0;

  const formatTime24 = (value: Date) =>
    value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full rounded-xl overflow-hidden border border-slate-700/40 shadow-2xl"
      onMouseLeave={() => setHoverInfo(null)}
    >
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={gradient.top} />
            <stop offset="55%" stopColor={gradient.mid} />
            <stop offset="100%" stopColor={gradient.bottom} />
          </linearGradient>
          <filter id="moonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="url(#skyGradient)" />
      </svg>

      <svg className="absolute inset-0 w-full h-full">
        <rect
          x="0"
          y={viewport.height / 2}
          width={viewport.width}
          height={viewport.height / 2}
          fill="rgba(2,6,23,0.35)"
        />
        <line
          x1="0"
          y1={viewport.height / 2}
          x2={viewport.width}
          y2={viewport.height / 2}
          stroke="white"
          strokeWidth={2}
          strokeOpacity={0.3}
        />
        <line
          x1="0"
          y1={mapY(-18)}
          x2={viewport.width}
          y2={mapY(-18)}
          stroke="white"
          strokeWidth="1"
          strokeOpacity="0.15"
          strokeDasharray="4 4"
        />
        <text x="8" y={mapY(-18) - 6} fill="white" fillOpacity="0.35" fontSize="10">
          Twilight (-18)
        </text>

        {[0, 90, 180, 270, 360].map((deg) => {
          const x = mapX(deg % 360);
          const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' } as Record<number, string>;
          return (
            <g key={`dir-${deg}`}>
              <line x1={x} y1={0} x2={x} y2={viewport.height} stroke="white" strokeOpacity="0.12" />
              <text
                x={x + 5}
                y={18}
                fill={deg === 90 ? '#fbbf24' : 'white'}
                fontWeight="bold"
                fontSize="12"
                fillOpacity={deg === 90 ? 1 : 0.6}
              >
                {label[deg]}
              </text>
            </g>
          );
        })}

        {hoverInfo ? (
          <>
            <line
              x1={hoverInfo.x}
              y1={0}
              x2={hoverInfo.x}
              y2={viewport.height}
              stroke="white"
              strokeOpacity={0.18}
              strokeWidth="1"
            />
            <line
              x1={0}
              y1={hoverInfo.y}
              x2={viewport.width}
              y2={hoverInfo.y}
              stroke="white"
              strokeOpacity={0.18}
              strokeWidth="1"
            />
          </>
        ) : null}

        {stars.map((s) => {
          const size = Math.max(1, 3.5 - Math.max(0, s.mag));
          const opacity = Math.min(1, Math.max(0.2, 1 - Math.max(0, s.mag) / 5)) * starAlpha;
          const x = mapX(s.az);
          const y = mapY(s.alt);
          return (
            <circle
              key={`star-${s.name}`}
              cx={x}
              cy={y}
              r={size}
              fill={s.color}
              opacity={opacity}
              onMouseEnter={() => setHoverInfo({ name: s.name, kind: 'star', alt: s.alt, az: s.az, x, y })}
            />
          );
        })}

        {pathSegments.map((segment, idx) => {
          const color = segment.zone === 'day' ? '#fbbf24' : segment.zone === 'twilight' ? '#fb7185' : '#38bdf8';
          const opacity = segment.zone === 'day' ? 0.8 : segment.zone === 'twilight' ? 0.55 : 0.35;
          return (
            <path
              key={`sun-path-${idx}`}
              d={segment.d}
              fill="none"
              stroke={color}
              strokeWidth="3"
              strokeOpacity={opacity}
            />
          );
        })}
        {moonSegments.map((segment, idx) => {
          const opacity = 0.25 + segment.phase * 0.75;
          return (
            <path
              key={`moon-path-${idx}`}
              d={segment.d}
              fill="none"
              stroke="#e2e8f0"
              strokeDasharray="4 4"
              strokeWidth="2"
              strokeOpacity={opacity}
            />
          );
        })}

        <g
          transform={`translate(${mapX(sun.az)}, ${mapY(sun.alt)})`}
          onMouseEnter={() =>
            setHoverInfo({
              name: 'Sun',
              kind: 'sun',
              alt: sun.alt,
              az: sun.az,
              x: mapX(sun.az),
              y: mapY(sun.alt),
            })
          }
        >
          <circle r="20" fill="#fbbf24" fillOpacity="0.2">
            <animate attributeName="r" values="18;24;18" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle r="8" fill="#fff8dc" stroke="#fbbf24" strokeWidth="2" />
        </g>

        <g
          transform={`translate(${mapX(moon.az)}, ${mapY(moon.alt)}) rotate(${moonTilt})`}
          onMouseEnter={() =>
            setHoverInfo({
              name: 'Moon',
              kind: 'moon',
              alt: moon.alt,
              az: moon.az,
              x: mapX(moon.az),
              y: mapY(moon.alt),
            })
          }
        >
          <circle r="12" fill="#e2e8f0" fillOpacity="0.12" filter="url(#moonGlow)" opacity={moonGlow} />
          <mask id="moonPhaseMask">
            <rect x="-20" y="-20" width="40" height="40" fill="black" />
            <circle cx="0" cy="0" r="8" fill="white" />
            <ellipse cx={moonShift} cy="0" rx="8" ry="8" fill="black" />
          </mask>
          <circle r="8" fill="#f8fafc" mask="url(#moonPhaseMask)" />
          <circle r="8" fill="none" stroke="#e2e8f0" strokeWidth="1.5" opacity="0.85" />
        </g>
        {planets
          .filter((p) => p.alt > -5)
          .map((planet) => {
            const x = mapX(planet.az);
            const y = mapY(planet.alt);
            return (
              <rect
                key={planet.name}
                x={x - 3}
                y={y - 3}
                width="6"
                height="6"
                fill={planet.color}
                opacity={Math.min(1, Math.max(0.25, 1 - (planet.mag ?? 5) / 5))}
                transform={`rotate(45 ${x} ${y})`}
                onMouseEnter={() =>
                  setHoverInfo({
                    name: planet.name,
                    kind: 'planet',
                    alt: planet.alt,
                    az: planet.az,
                    x,
                    y,
                  })
                }
              />
            );
          })}
      </svg>

      {hoverInfo ? (
        <div
          className="absolute z-10 rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-xs text-white"
          style={{
            left: Math.min(hoverInfo.x + 12, viewport.width - 140),
            top: Math.max(hoverInfo.y - 28, 8),
          }}
        >
          <div className="font-semibold">{hoverInfo.name}</div>
          <div className="text-white/70">
            {hoverInfo.kind === 'sun' ? 'Sun' : hoverInfo.kind === 'moon' ? 'Moon' : hoverInfo.kind === 'planet' ? 'Planet' : 'Star'}
          </div>
          <div>Alt {hoverInfo.alt.toFixed(1)} deg</div>
          <div>Az {hoverInfo.az.toFixed(1)} deg</div>
          <div>Time {formatTime24(timestamp)}</div>
        </div>
      ) : null}

      <div className="absolute top-4 right-4 text-right text-white/90 font-mono">
        <div className="text-lg tracking-widest">{timestamp.toLocaleTimeString()}</div>
        <div className="text-xs text-white/60">{timestamp.toLocaleDateString()}</div>
        <div className="text-xs text-white/60">
          ALT {sun.alt.toFixed(1)} deg AZ {sun.az.toFixed(1)} deg
        </div>
      </div>
      <div className="absolute top-4 left-4 text-white/80 text-xs">
        {lat.toFixed(3)}, {lon.toFixed(3)}
      </div>
      <div className="absolute bottom-4 left-4 text-white/80 text-xs">
        Moon {moon.alt.toFixed(1)} deg {moon.az.toFixed(1)} deg {Math.round(moonPhase.phaseFraction * 100)}% {moonPhaseLabel}
      </div>
      <div className="absolute bottom-4 right-4 text-white/80 text-xs text-right">
        <div>EoT {equationOfTime.toFixed(2)} min</div>
      </div>
    </div>
  );
}
