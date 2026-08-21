import React from 'react';

/**
 * Deterministic hash and seeded pseudo-random number generator
 * for building unique, consistent SVG seals for each sage/person slug.
 */
export function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function seededRand(seed: number): () => number {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface SealStroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface SealGeometry {
  /** SVG path d attribute on a 100x100 coordinate plane */
  pathD: string;
  /** Center dot radius on 100x100 coordinate plane */
  centerRadius: number;
  /** Inner radiating strokes on 100x100 coordinate plane */
  strokes: SealStroke[];
}

// In-memory cache for computed seal geometries (O(1) lookups during timeline pan/zoom)
const sealGeometryCache = new Map<string, SealGeometry>();

export function getSealGeometry(slug: string): SealGeometry {
  const normalizedSlug = slug || 'default-sage';
  const cached = sealGeometryCache.get(normalizedSlug);
  if (cached) return cached;

  const seed = hashStr(normalizedSlug);
  const rnd = seededRand(seed);

  const cx = 50;
  const cy = 50;
  const points = 6 + Math.floor(rnd() * 3); // 6 to 8 sided polygon base
  const rOuter = 46;
  const rInner = 46 * (0.42 + rnd() * 0.18);

  const pathPoints: [number, number][] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI * 2 * i) / (points * 2) - Math.PI / 2;
    pathPoints.push([
      Math.round((cx + r * Math.cos(a)) * 10) / 10,
      Math.round((cy + r * Math.sin(a)) * 10) / 10,
    ]);
  }

  const pathD =
    pathPoints
      .map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0]},${p[1]}`)
      .join(' ') + ' Z';

  const strokeCount = 2 + Math.floor(rnd() * 3); // 2 to 4 inner strokes
  const strokes: SealStroke[] = [];
  for (let i = 0; i < strokeCount; i++) {
    const a = rnd() * Math.PI * 2;
    const r1 = rInner * 0.15;
    const r2 = rInner * 0.85;
    strokes.push({
      x1: Math.round((cx + r1 * Math.cos(a)) * 10) / 10,
      y1: Math.round((cy + r1 * Math.sin(a)) * 10) / 10,
      x2: Math.round((cx + r2 * Math.cos(a)) * 10) / 10,
      y2: Math.round((cy + r2 * Math.sin(a)) * 10) / 10,
    });
  }

  const geometry: SealGeometry = {
    pathD,
    centerRadius: Math.round(rInner * 0.28 * 10) / 10,
    strokes,
  };

  sealGeometryCache.set(normalizedSlug, geometry);
  return geometry;
}

export interface SealSvgProps {
  slug: string;
  color?: string;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Standalone React SVG component for DOM contexts (modals, tooltips, cards)
 */
export function SealSvg({
  slug,
  color = '#C9A94E',
  size = 32,
  className = '',
  style,
}: SealSvgProps) {
  const geo = getSealGeometry(slug);

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
      aria-hidden="true"
    >
      <path
        d={geo.pathD}
        fill={`${color}22`}
        stroke={color}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <circle cx={50} cy={50} r={geo.centerRadius} fill={color} />
      {geo.strokes.map((st, i) => (
        <line
          key={i}
          x1={st.x1}
          y1={st.y1}
          x2={st.x2}
          y2={st.y2}
          stroke={color}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.9}
        />
      ))}
    </svg>
  );
}
