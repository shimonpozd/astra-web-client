import { RiseSet } from '../types';

const formatTime24 = (value: Date) =>
  value.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

export function MoonHud({
  phaseFraction,
  phaseLabel,
  moonOrbitPercent,
  moonOrbitKm,
  moonRiseSet,
}: {
  phaseFraction: number;
  phaseLabel: string;
  moonOrbitPercent: number | null;
  moonOrbitKm: number | null;
  moonRiseSet: RiseSet | null;
}) {
  return (
    <div className="absolute bottom-2 left-2 right-auto max-w-[75%] px-2 py-1 text-[10px] text-white/80 backdrop-blur-[1px] bg-slate-900/10 rounded-md hidden md:flex pointer-events-none">
      <div className="flex flex-wrap items-center gap-2 overflow-hidden">
        <div className="flex items-center gap-2 shrink-0">
          <div className="h-2 w-2 rounded-full bg-slate-200 shadow-[0_0_8px_rgba(226,232,240,0.7)]" />
          <span>
            Возраст {(phaseFraction * 29.53).toFixed(1)}д ({Math.round(phaseFraction * 100)}%)
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>Орбита {moonOrbitPercent != null ? `${Math.round(moonOrbitPercent * 100)}%` : '--'}</span>
          <span>{moonOrbitKm != null ? `${Math.round(moonOrbitKm).toLocaleString()} км` : '--'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>Восход {moonRiseSet?.rise ? formatTime24(moonRiseSet.rise) : '-'}</span>
          <span>Закат {moonRiseSet?.set ? formatTime24(moonRiseSet.set) : '-'}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span>{phaseLabel}</span>
        </div>
      </div>
    </div>
  );
}
