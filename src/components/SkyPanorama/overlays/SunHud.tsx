import { RiseSet } from '../types';

const formatTime24 = (value: Date) =>
  value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function SunHud({
  dayClimb,
  solarNoon,
  sunRiseSet,
  sunAlt,
  yearHeight,
  dayArc,
  earthOrbitPercent,
  earthDistanceMkm,
  airMass,
  equationOfTimeLabel,
  insolation,
}: {
  dayClimb: number | null;
  solarNoon: Date | null;
  sunRiseSet: RiseSet | null;
  sunAlt: number;
  yearHeight: number | null;
  dayArc: number | null;
  earthOrbitPercent: number | null;
  earthDistanceMkm: number | null;
  airMass: number | null;
  equationOfTimeLabel: string;
  insolation: { watts: number; fraction: number };
}) {
  const polarFallback =
    sunRiseSet?.rise || sunRiseSet?.set ? '--' : sunAlt > 0 ? 'Полярный день' : 'Полярная ночь';

  const isDay = sunAlt > 0;
  const dayClimbLabel = isDay && dayClimb != null ? `${Math.round(dayClimb * 100)}%` : '--';
  const dayArcLabel = isDay && dayArc != null ? `${Math.round(dayArc * 100)}%` : '--';
  const airMassLabel = isDay && airMass != null ? airMass.toFixed(1) : '--';

  return (
    <div className="absolute top-2 left-2 right-auto max-w-[75%] px-2 py-1 text-[10px] text-white/80 backdrop-blur-[1px] bg-slate-900/10 rounded-md hidden md:flex pointer-events-none">
      <div className="flex flex-wrap items-center gap-2 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(251,191,36,0.8)]" />
          <span>Подъем {dayClimbLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>Полдень {solarNoon ? formatTime24(solarNoon) : polarFallback}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>Год {yearHeight != null ? `${Math.round(yearHeight * 100)}%` : '--'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>Дуга {dayArcLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>Орбита {earthOrbitPercent != null ? `${Math.round(earthOrbitPercent * 100)}%` : '--'}</span>
          <span>{earthDistanceMkm != null ? `${earthDistanceMkm.toFixed(1)} млн км` : '--'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>Воздух {airMassLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>EqTime {equationOfTimeLabel}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-white/60">Инсол.</span>
          <div className="h-1 w-20 bg-white/20">
            <span
              className="block h-full bg-amber-300"
              style={{ width: `${Math.round(insolation.fraction * 100)}%` }}
            />
          </div>
          <span>{Math.round(insolation.watts)} W/m2</span>
        </div>
      </div>
    </div>
  );
}
