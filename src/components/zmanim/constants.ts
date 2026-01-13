export const DEG_TO_RAD = Math.PI / 180;

export type Point = { az: number; alt: number };
export type MoonPoint = Point & { phase: number };
export type EventMarker = { label: string; az: number; alt: number; time: Date };
export type PlanetPoint = { name: string; az: number; alt: number; color: string; mag?: number };
export type StarPoint = { name: string; az: number; alt: number; mag: number; color: string };

export const PLANET_COLORS: Record<string, string> = {
  Mercury: '#cbd5f5',
  Venus: '#f8fafc',
  Mars: '#fb7185',
  Jupiter: '#fde68a',
  Saturn: '#fcd34d',
  Uranus: '#5eead4',
  Neptune: '#60a5fa',
  Pluto: '#94a3b8',
};

export const PLANET_LIST = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];

export const BRIGHT_STARS = [
  { name: 'Sirius', ra: 6.7525, dec: -16.7161, mag: -1.46, color: '#bfdbff' },
  { name: 'Canopus', ra: 6.3992, dec: -52.6957, mag: -0.74, color: '#dbeafe' },
  { name: 'Arcturus', ra: 14.261, dec: 19.1825, mag: -0.05, color: '#fed7aa' },
  { name: 'Vega', ra: 18.6156, dec: 38.7837, mag: 0.03, color: '#bfdbff' },
  { name: 'Capella', ra: 5.2782, dec: 45.998, mag: 0.08, color: '#fef3c7' },
  { name: 'Rigel', ra: 5.2423, dec: -8.2016, mag: 0.18, color: '#bfdbff' },
  { name: 'Procyon', ra: 7.655, dec: 5.225, mag: 0.34, color: '#e2e8f0' },
  { name: 'Betelgeuse', ra: 5.9195, dec: 7.4071, mag: 0.42, color: '#fecaca' },
  { name: 'Achernar', ra: 1.6286, dec: -57.2367, mag: 0.46, color: '#bfdbff' },
  { name: 'Hadar', ra: 14.0637, dec: -60.373, mag: 0.61, color: '#dbeafe' },
  { name: 'Altair', ra: 19.8464, dec: 8.8683, mag: 0.77, color: '#bfdbff' },
  { name: 'Acrux', ra: 12.4433, dec: -63.0991, mag: 0.77, color: '#bfdbff' },
  { name: 'Aldebaran', ra: 4.5987, dec: 16.5092, mag: 0.85, color: '#fdba74' },
  { name: 'Antares', ra: 16.4901, dec: -26.432, mag: 1.06, color: '#fb7185' },
  { name: 'Spica', ra: 13.4199, dec: -11.1614, mag: 0.98, color: '#bfdbff' },
  { name: 'Pollux', ra: 7.7553, dec: 28.0262, mag: 1.14, color: '#fde68a' },
  { name: 'Fomalhaut', ra: 22.9608, dec: -29.6222, mag: 1.16, color: '#bfdbff' },
  { name: 'Deneb', ra: 20.6905, dec: 45.2803, mag: 1.25, color: '#bfdbff' },
  { name: 'Regulus', ra: 10.1395, dec: 11.9672, mag: 1.35, color: '#fde68a' },
  { name: 'Adhara', ra: 6.9771, dec: -28.9721, mag: 1.5, color: '#bfdbff' },
  { name: 'Shaula', ra: 17.5601, dec: -37.1038, mag: 1.62, color: '#fecaca' },
  { name: 'Castor', ra: 7.5767, dec: 31.8883, mag: 1.58, color: '#bfdbff' },
  { name: 'Gacrux', ra: 12.5194, dec: -57.1132, mag: 1.63, color: '#fed7aa' },
  { name: 'Bellatrix', ra: 5.4189, dec: 6.3497, mag: 1.64, color: '#bfdbff' },
  { name: 'Elnath', ra: 5.4382, dec: 28.6075, mag: 1.65, color: '#fde68a' },
  { name: 'Miaplacidus', ra: 9.2204, dec: -69.7172, mag: 1.67, color: '#bfdbff' },
  { name: 'Alnilam', ra: 5.6036, dec: -1.2019, mag: 1.69, color: '#bfdbff' },
  { name: 'Alnair', ra: 22.1372, dec: -46.9609, mag: 1.74, color: '#bfdbff' },
  { name: 'Alioth', ra: 12.9004, dec: 55.9598, mag: 1.76, color: '#fde68a' },
  { name: 'Mirfak', ra: 3.4054, dec: 49.8611, mag: 1.79, color: '#bfdbff' },
  { name: 'Polaris', ra: 2.5303, dec: 89.2641, mag: 1.97, color: '#ffffff' },
];
