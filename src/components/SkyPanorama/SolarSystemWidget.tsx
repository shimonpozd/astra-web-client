import { useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import * as Astronomy from 'astronomy-engine';
import { PLANET_COLORS } from '../zmanim/constants';

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const PLANET_LABELS: Record<string, string> = {
  Mercury: 'Меркурий',
  Venus: 'Венера',
  Earth: 'Земля',
  Mars: 'Марс',
  Jupiter: 'Юпитер',
  Saturn: 'Сатурн',
  Uranus: 'Уран',
  Neptune: 'Нептун',
  Pluto: 'Плутон',
};

const PLANET_ORDER = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

type PlanetSnapshot = {
  id: string;
  label: string;
  color: string;
  lon: number;
  dist: number;
};

type Snapshot = {
  planets: PlanetSnapshot[];
  moonLon: number;
  subsolar: { lat: number; lon: number };
};

const normalizeDegrees = (value: number) => ((value + 180) % 360 + 360) % 360 - 180;

const degToRad = (deg: number) => (deg * Math.PI) / 180;

const projectOrthographic = (
  lat: number,
  lon: number,
  centerLat: number,
  centerLon: number,
) => {
  const latRad = degToRad(lat);
  const lonRad = degToRad(lon);
  const lat0 = degToRad(centerLat);
  const lon0 = degToRad(centerLon);
  const dLon = lonRad - lon0;
  const cosC = Math.sin(lat0) * Math.sin(latRad) + Math.cos(lat0) * Math.cos(latRad) * Math.cos(dLon);
  const x = Math.cos(latRad) * Math.sin(dLon);
  const y = Math.cos(lat0) * Math.sin(latRad) - Math.sin(lat0) * Math.cos(latRad) * Math.cos(dLon);
  return { x, y, visible: cosC >= 0 };
};

const computeSnapshot = (moment: Date): Snapshot => {
  const planets = PLANET_ORDER.map((name) => {
    if (typeof Astronomy.HelioVector !== 'function') {
      return {
        id: name,
        label: PLANET_LABELS[name] ?? name,
        color: PLANET_COLORS[name] ?? '#94a3b8',
        lon: 0,
        dist: 1,
      };
    }
    const vec = Astronomy.HelioVector(name as Astronomy.Body, moment);
    const lon = Math.atan2(vec.y, vec.x);
    const dist = Math.sqrt(vec.x * vec.x + vec.y * vec.y + vec.z * vec.z);
    return {
      id: name,
      label: PLANET_LABELS[name] ?? name,
      color: name === 'Earth' ? '#60a5fa' : PLANET_COLORS[name] ?? '#94a3b8',
      lon,
      dist,
    };
  });

  const moonLon = (() => {
    if (typeof Astronomy.GeoVector !== 'function') return 0;
    const vec = Astronomy.GeoVector('Moon', moment, true);
    return Math.atan2(vec.y, vec.x);
  })();

  const subsolar = (() => {
    if (typeof Astronomy.Equator !== 'function' || typeof Astronomy.SiderealTime !== 'function') {
      return { lat: 0, lon: 0 };
    }
    const observer = new Astronomy.Observer(0, 0, 0);
    const eq = Astronomy.Equator('Sun', moment, observer, true, true);
    const gstHours = Astronomy.SiderealTime(moment);
    const raDeg = eq.ra * 15;
    const subLon = normalizeDegrees(raDeg - gstHours * 15);
    return { lat: eq.dec, lon: subLon };
  })();

  return { planets, moonLon, subsolar };
};

export function SolarSystemWidget({
  hoverPlanet,
  className,
  animate = false,
  updateIntervalMs = 7 * 60 * 1000,
  observerLat,
  observerLon,
  style,
}: {
  hoverPlanet?: string | null;
  className?: string;
  animate?: boolean;
  updateIntervalMs?: number;
  observerLat?: number;
  observerLon?: number;
  style?: CSSProperties;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState({ width: 0, height: 0 });
  const [hovered, setHovered] = useState<string | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [snapshot, setSnapshot] = useState<Snapshot>(() => computeSnapshot(new Date()));
  const ids = useId().replace(/:/g, '');

  useEffect(() => {
    if (!panelRef.current) return;
    const obs = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setPanelSize({ width, height });
    });
    obs.observe(panelRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (animate) {
      let frame = 0;
      const tick = () => {
        setSnapshot(computeSnapshot(new Date()));
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(frame);
    }

    setSnapshot(computeSnapshot(new Date()));
    const timer = window.setInterval(() => setSnapshot(computeSnapshot(new Date())), updateIntervalMs);
    return () => window.clearInterval(timer);
  }, [animate, updateIntervalMs]);

  const panel = Math.min(panelSize.width || 300, panelSize.height || 300);
  const centerX = (panelSize.width || panel) / 2;
  const centerY = (panelSize.height || panel) / 2;
  const padding = clamp(panel * 0.06, 10, 18);
  const maxOrbit = panel / 2 - padding;
  const minOrbit = panel * 0.1;
  // Изменено: в zoomed показываем внутренние планеты (до Марса включительно) для контекста положения Земли
  const visiblePlanets = zoomed
    ? snapshot.planets.filter((planet) => ['Mercury', 'Venus', 'Earth', 'Mars'].includes(planet.id))
    : snapshot.planets;
  const maxAu = Math.max(...visiblePlanets.map((planet) => planet.dist), 1);
  const maxScaled = Math.pow(maxAu, 0.4);
  const hoverName = hoverPlanet ?? hovered;

  const orbitRadius = (au: number) => {
    const scaled = Math.pow(au, 0.4);
    const radius = (scaled / maxScaled) * maxOrbit;
    return clamp(radius, minOrbit, maxOrbit);
  };

  return (
    <div
      ref={panelRef}
      className={`relative w-full overflow-hidden rounded-2xl border border-slate-800/70 ${className ?? ''}`}
      style={{ aspectRatio: '1 / 1', ...style }}
    >
      <button
        type="button"
        onClick={() => setZoomed((prev) => !prev)}
        className="absolute right-2 top-2 z-10 rounded-full border border-slate-600/70 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-200 shadow-sm transition hover:border-slate-400"
        aria-pressed={zoomed}
      >
        {zoomed ? '-' : '+'}
      </button>
      <svg className="absolute inset-0 h-full w-full">
        <defs>
          <radialGradient id={`${ids}-space`} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#0f172a" stopOpacity="0.2" />
            <stop offset="55%" stopColor="#0b1220" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#030712" stopOpacity="1" />
          </radialGradient>
          <radialGradient id={`${ids}-sun`} cx="50%" cy="50%" r="70%">
            <stop offset="0%" stopColor="#fef9c3" />
            <stop offset="30%" stopColor="#fbbf24" />
            <stop offset="60%" stopColor="#f59e0b" stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id={`${ids}-sun-halo`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(251,191,36,0.35)" />
            <stop offset="45%" stopColor="rgba(251,191,36,0.18)" />
            <stop offset="100%" stopColor="rgba(251,191,36,0)" />
          </radialGradient>
          <radialGradient id={`${ids}-moon`} cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#f8fafc" />
            <stop offset="100%" stopColor="#cbd5f5" />
          </radialGradient>
          {/* Убрали градиент для орбит, теперь используем цвета планет напрямую */}
          <filter id={`${ids}-sun-glow`} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="10" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id={`${ids}-earth-glow`} x="-70%" y="-70%" width="240%" height="240%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${ids}-space)`} />
      </svg>
      <svg className="absolute inset-0 h-full w-full">
        <g transform={`translate(${centerX}, ${centerY})`}>
          {visiblePlanets.map((planet) => (
            <circle
              key={`orbit-${planet.id}`}
              r={orbitRadius(planet.dist)}
              fill="none"
              stroke={planet.color}
              strokeWidth="1"
              opacity={0.2}
              /* Убрали strokeDasharray для сплошной линии */
            />
          ))}
          {(() => {
            const sunRadius = panel * 0.06;
            return (
              <>
                <circle r={panel * 0.5} fill={`url(#${ids}-sun-halo)`} />
                <circle r={sunRadius} fill={`url(#${ids}-sun)`} filter={`url(#${ids}-sun-glow)`} />
                <circle r={sunRadius * 0.5} fill="#fff7ed" opacity={0.75} />
              </>
            );
          })()}
          {visiblePlanets.map((planet) => {
            const radius = orbitRadius(planet.dist);
            const x = Math.cos(planet.lon) * radius;
            const y = Math.sin(planet.lon) * radius;
            const baseSize = planet.id === 'Earth' ? panel * 0.022 : panel * 0.014;
            const sunRadius = panel * 0.06;
            const isHovered = hoverName === planet.id || hoverName === planet.label;
            const size = isHovered ? baseSize * 1.6 : baseSize;
            const labelOffset = panel * 0.03;
            const anchor = Math.cos(planet.lon) >= 0 ? 'start' : 'end';
            const labelX = x + (anchor === 'start' ? labelOffset : -labelOffset);
            const labelY = y + baseSize * 0.4;
            const sunDirLen = Math.hypot(x, y) || 1;
            const sunDirX = -x / sunDirLen;
            const sunDirY = -y / sunDirLen;
            const hasObserver =
              planet.id === 'Earth' &&
              Number.isFinite(observerLat) &&
              Number.isFinite(observerLon);
            const observerPoint = hasObserver
              ? projectOrthographic(
                  observerLat as number,
                  observerLon as number,
                  snapshot.subsolar.lat,
                  snapshot.subsolar.lon,
                )
              : null;

            return (
              <g
                key={`planet-${planet.id}`}
                onMouseEnter={() => setHovered(planet.id)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer', opacity: hoverName && !isHovered ? 0.45 : 1 }}
              >
                <circle
                  cx={x}
                  cy={y}
                  r={size}
                  fill={planet.color}
                  opacity={isHovered ? 1 : 0.85}
                  filter={planet.id === 'Earth' ? `url(#${ids}-earth-glow)` : undefined}
                />
                {planet.id === 'Earth' ? (
                  <>
                    {(() => {
                      const moonOrbitBase = panel * 0.035;
                      const safeOrbit = Math.max(baseSize * 1.5, radius - sunRadius - panel * 0.01);
                      const moonOrbit = Math.min(moonOrbitBase, safeOrbit);
                      return (
                        <>
                          <circle
                            cx={x}
                            cy={y}
                            r={moonOrbit}
                            fill="none"
                            stroke="rgba(226,232,240,0.4)"
                            strokeDasharray="3 3"
                          />
                          <circle
                            cx={x + Math.cos(snapshot.moonLon) * moonOrbit}
                            cy={y + Math.sin(snapshot.moonLon) * moonOrbit}
                            r={panel * 0.012}
                            fill={`url(#${ids}-moon)`}
                          />
                        </>
                      );
                    })()}
                    <circle
                      cx={x}
                      cy={y}
                      r={baseSize * 1.6}
                      fill="none"
                      stroke="rgba(226,232,240,0.25)"
                    />
                    <circle
                      cx={x + sunDirX * (baseSize * 0.9)}
                      cy={y + sunDirY * (baseSize * 0.9)}
                      r={panel * 0.005}
                      fill="#fde68a"
                      opacity={0.85}
                    />
                    {observerPoint ? (
                      <>
                        <circle
                          cx={x + observerPoint.x * baseSize}
                          cy={y + observerPoint.y * baseSize}
                          r={panel * 0.007}
                          fill="#f8fafc"
                          stroke={observerPoint.visible ? '#e2e8f0' : '#64748b'}
                          strokeWidth={panel * 0.0018}
                          opacity={observerPoint.visible ? 0.95 : 0.5}
                        />
                      </>
                    ) : null}
                  </>
                ) : null}
                {isHovered ? (
                  <>
                    {/* Название планеты теперь только на hover */}
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor={anchor}
                      fontSize={panel * 0.035}
                      fill="#f8fafc"
                    >
                      {planet.label}
                    </text>
                    <g transform={`translate(${labelX}, ${labelY - panel * 0.045})`}>
                      <rect
                        x={anchor === 'start' ? 0 : -panel * 0.18}
                        y={-panel * 0.04}
                        width={panel * 0.18}
                        height={panel * 0.05}
                        rx={panel * 0.01}
                        fill="rgba(15,23,42,0.85)"
                      />
                      <text
                        x={anchor === 'start' ? panel * 0.01 : -panel * 0.17}
                        y={-panel * 0.012}
                        textAnchor="start"
                        fontSize={panel * 0.028}
                        fill="#e2e8f0"
                      >
                        {planet.dist.toFixed(2)} AU
                      </text>
                    </g>
                  </>
                ) : null}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
