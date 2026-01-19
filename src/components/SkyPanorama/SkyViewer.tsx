import { useEffect, useMemo, useRef, useState } from 'react';
import { CursorTooltip } from './overlays/CursorTooltip';
import { MoonHud } from './overlays/MoonHud';
import { SunHud } from './overlays/SunHud';
import { segmentMoonPaths, segmentPaths } from '../zmanim/astro-utils';
import { CursorCoords, HoverInfo, SkyData } from './types';

const COMPASS_16 = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];

const PLANET_LABELS_RU: Record<string, string> = {
  Mercury: 'Меркурий',
  Venus: 'Венера',
  Mars: 'Марс',
  Jupiter: 'Юпитер',
  Saturn: 'Сатурн',
  Uranus: 'Уран',
  Neptune: 'Нептун',
  Pluto: 'Плутон',
};

const getCompassLabel = (az: number) => {
  const idx = Math.round(az / 22.5) % 16;
  return COMPASS_16[idx];
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function SkyViewer({
  data,
  hoverInfo,
  onHoverChange,
  showTwilightHint = true,
}: {
  data: SkyData;
  hoverInfo: HoverInfo | null;
  onHoverChange: (next: HoverInfo | null) => void;
  showTwilightHint?: boolean;
}) {
  const skyRef = useRef<HTMLDivElement | null>(null);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [cursorCoords, setCursorCoords] = useState<CursorCoords | null>(null);

  useEffect(() => {
    if (!skyRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setViewport({ width, height });
    });
    obs.observe(skyRef.current);
    return () => obs.disconnect();
  }, []);

  const mapX = (az: number) => (az / 360) * viewport.width;
  const mapY = (alt: number) => viewport.height / 2 - (alt / 90) * (viewport.height / 2);
  const compassLabelY = mapY(6);

  const pathSegments = useMemo(() => {
    if (!viewport.width) return [];
    return segmentPaths(data.paths.sunPath, viewport.width, viewport.height);
  }, [data.paths.sunPath, viewport.width, viewport.height]);

  const moonSegments = useMemo(() => {
    if (!viewport.width) return [];
    return segmentMoonPaths(data.paths.moonPath, viewport.width, viewport.height);
  }, [data.paths.moonPath, viewport.width, viewport.height]);

  const onSkyMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = skyRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const az = (x / rect.width) * 360;
    const alt = clamp(((rect.height / 2 - y) / (rect.height / 2)) * 90, -90, 90);
    setCursorCoords({
      az,
      alt,
      label: getCompassLabel(az),
      x,
      y,
    });
  };

  if (!data.ready) {
    return <div ref={skyRef} className="w-full h-full rounded-xl bg-slate-900/40" />;
  }

  const hoverLabel = (() => {
    if (!hoverInfo) return '';
    if (hoverInfo.kind === 'sun') return 'Солнце';
    if (hoverInfo.kind === 'moon') return 'Луна';
    if (hoverInfo.kind === 'planet') return PLANET_LABELS_RU[hoverInfo.name] ?? hoverInfo.name;
    return hoverInfo.name;
  })();

  return (
    <div
      ref={skyRef}
      className="relative w-full h-full rounded-xl overflow-hidden border border-slate-700/40 shadow-2xl"
      onMouseMove={onSkyMove}
      onMouseLeave={() => {
        onHoverChange(null);
        setCursorCoords(null);
      }}
    >
      <svg className="absolute inset-0 w-full h-full">
        <defs>
          <linearGradient id="skyGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={data.gradient.top} />
            <stop offset="55%" stopColor={data.gradient.mid} />
            <stop offset="100%" stopColor={data.gradient.bottom} />
          </linearGradient>
          <filter id="moonGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <radialGradient id="moonTexture" cx="35%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="60%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5f5" />
          </radialGradient>
          <radialGradient id="milkyWay" cx="20%" cy="40%" r="80%">
            <stop offset="0%" stopColor="rgba(148,163,184,0.22)" />
            <stop offset="60%" stopColor="rgba(79,70,229,0.08)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0)" />
          </radialGradient>
        </defs>
        <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="url(#skyGradient)" />
        {data.sun.alt < -18 ? (
          <rect x="0" y="0" width={viewport.width} height={viewport.height} fill="url(#milkyWay)" opacity={0.35} />
        ) : null}
      </svg>

      <div className="absolute left-0 right-0 bottom-0 h-1/2 bg-slate-950/40 backdrop-blur-[2px]" />

      <svg className="absolute inset-0 w-full h-full">
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
          Сумерки (-18)
        </text>

        {[0, 90, 180, 270, 360].map((deg) => {
          const x = mapX(deg % 360);
          const label = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 360: 'N' } as Record<number, string>;
          return (
            <g key={`dir-${deg}`}>
              <line x1={x} y1={0} x2={x} y2={viewport.height} stroke="white" strokeOpacity={0.12} />
              <text
                x={x + 5}
                y={compassLabelY}
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

        {data.stars.map((s) => {
          const size = Math.max(1, 3.5 - Math.max(0, s.mag));
          const opacity = Math.min(1, Math.max(0.2, 1 - Math.max(0, s.mag) / 5)) * data.starAlpha;
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
              onMouseEnter={() =>
                onHoverChange({ name: s.name, kind: 'star', alt: s.alt, az: s.az, x, y })
              }
            />
          );
        })}

        {pathSegments.map((segment, idx) => {
          const color = segment.zone === 'day' ? '#fbbf24' : segment.zone === 'twilight' ? '#fb7185' : '#38bdf8';
          const opacity = segment.zone === 'day' ? 0.8 : segment.zone === 'twilight' ? 0.55 : 0.35;
          return (
            <path key={`sun-path-${idx}`} d={segment.d} fill="none" stroke={color} strokeWidth="3" strokeOpacity={opacity} />
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
          transform={`translate(${mapX(data.sun.az)}, ${mapY(data.sun.alt)})`}
          onMouseEnter={() =>
            onHoverChange({
              name: 'Sun',
              kind: 'sun',
              alt: data.sun.alt,
              az: data.sun.az,
              x: mapX(data.sun.az),
              y: mapY(data.sun.alt),
            })
          }
        >
          <circle r="20" fill={data.sunGlow} fillOpacity="0.25">
            <animate attributeName="r" values="18;24;18" dur="3s" repeatCount="indefinite" />
          </circle>
          <circle r="8" fill={data.sunColor} stroke={data.sunGlow} strokeWidth="2" />
        </g>

        <g
          transform={`translate(${mapX(data.moon.az)}, ${mapY(data.moon.alt)}) rotate(${data.moonTilt})`}
          onMouseEnter={() =>
            onHoverChange({
              name: 'Moon',
              kind: 'moon',
              alt: data.moon.alt,
              az: data.moon.az,
              x: mapX(data.moon.az),
              y: mapY(data.moon.alt),
            })
          }
        >
          <circle r="12" fill="#e2e8f0" fillOpacity="0.12" filter="url(#moonGlow)" opacity={data.moonGlow} />
          <mask id="moonPhaseMask">
            <rect x="-20" y="-20" width="40" height="40" fill="black" />
            <circle cx="0" cy="0" r="8" fill="white" />
            <ellipse cx={data.moonShift} cy="0" rx="8" ry="8" fill="black" />
          </mask>
          <circle r="8" fill="url(#moonTexture)" mask="url(#moonPhaseMask)" />
          <circle r="8" fill="none" stroke="#e2e8f0" strokeWidth="1.5" opacity={0.85} />
        </g>
        {data.planets
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
                  onHoverChange({
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
          <div className="font-semibold">{hoverLabel}</div>
          <div className="text-white/70">
            {hoverInfo.kind === 'sun'
              ? 'Солнце'
              : hoverInfo.kind === 'moon'
                ? 'Луна'
                : hoverInfo.kind === 'planet'
                  ? 'Планета'
                  : 'Звезда'}
          </div>
          <div>Высота {hoverInfo.alt.toFixed(1)} deg</div>
          <div>Азимут {hoverInfo.az.toFixed(1)} deg</div>
        </div>
      ) : null}

      <SunHud
        dayClimb={data.dayClimb}
        solarNoon={data.solarNoon}
        sunRiseSet={data.sunRiseSet}
        sunAlt={data.sun.alt}
        yearHeight={data.yearHeight}
        dayArc={data.dayArc}
        earthOrbitPercent={data.earthOrbit?.percent ?? null}
        earthDistanceMkm={data.earthOrbit?.distanceMkm ?? null}
        airMass={data.airMass}
        equationOfTimeLabel={data.equationOfTimeLabel}
        insolation={data.insolation}
      />
      <MoonHud
        phaseFraction={data.moonPhase.fraction}
        phaseLabel={data.moonPhase.label}
        moonOrbitPercent={data.moonOrbit?.percent ?? null}
        moonOrbitKm={data.moonOrbit?.km ?? null}
        moonRiseSet={data.moonRiseSet}
      />
      <CursorTooltip
        coords={cursorCoords}
        showTwilightHint={showTwilightHint}
        maxWidth={viewport.width}
        maxHeight={viewport.height}
      />
    </div>
  );
}
