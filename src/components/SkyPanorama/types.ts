import type { MoonPoint, PlanetPoint, Point, StarPoint } from '../zmanim/constants';

export type { MoonPoint, PlanetPoint, Point, StarPoint };

export interface SkyObject {
  alt: number;
  az: number;
}

export interface MoonPhase {
  fraction: number;
  angle: number;
  waxing: boolean;
  label: string;
}

export interface RiseSet {
  rise: Date | null;
  set: Date | null;
}

export interface YearExtremes {
  maxAlt: number;
  minAlt: number;
  minDayLen: number;
  maxDayLen: number;
  minDist: number;
  maxDist: number;
}

export interface OrbitData {
  percent: number | null;
  distanceMkm: number | null;
}

export interface MoonOrbitData {
  percent: number | null;
  km: number | null;
}

export interface SystemPlanet {
  name: string;
  lon: number;
  dist: number;
  color: string;
}

export interface HoverInfo {
  name: string;
  kind: 'sun' | 'moon' | 'planet' | 'star';
  alt: number;
  az: number;
  x: number;
  y: number;
}

export interface CursorCoords {
  az: number;
  alt: number;
  label: string;
  x: number;
  y: number;
}

export interface SkyPaths {
  sunPath: Point[];
  moonPath: MoonPoint[];
}

export interface SkyData {
  ready: boolean;
  sun: SkyObject;
  moon: SkyObject;
  moonPhase: MoonPhase;
  paths: SkyPaths;
  planets: PlanetPoint[];
  stars: StarPoint[];
  gradient: { top: string; mid: string; bottom: string };
  starAlpha: number;
  sunColor: string;
  sunGlow: string;
  moonGlow: number;
  moonShift: number;
  moonTilt: number;
  moonPhaseLabel: string;
  equationOfTimeLabel: string;
  airMass: number | null;
  insolation: { watts: number; fraction: number };
  dayClimb: number | null;
  yearHeight: number | null;
  dayArc: number | null;
  earthOrbit: OrbitData | null;
  moonOrbit: MoonOrbitData | null;
  sunRiseSet: RiseSet | null;
  moonRiseSet: RiseSet | null;
  solarNoon: Date | null;
  systemPlanets: SystemPlanet[];
  earthSystemLon: number | null;
  sunSystemAngle: number;
  moonOrbitAngle: number;
}
