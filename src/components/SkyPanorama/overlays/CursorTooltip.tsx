import { CursorCoords } from '../types';

const getTwilightLabel = (alt: number, showTwilightHint: boolean) => {
  if (!showTwilightHint) return null;
  if (alt < -6 && alt >= -19.8) return 'Сумеречная зона';
  if (alt < -18) return 'Астрономические';
  if (alt < -12) return 'Навигационные';
  if (alt < 0) return 'Гражданские';
  return null;
};

export function CursorTooltip({
  coords,
  showTwilightHint = true,
  maxWidth,
  maxHeight,
}: {
  coords: CursorCoords | null;
  showTwilightHint?: boolean;
  maxWidth: number;
  maxHeight: number;
}) {
  if (!coords) return null;
  const twilightLabel = getTwilightLabel(coords.alt, showTwilightHint);
  const safeWidth = maxWidth || 0;
  const safeHeight = maxHeight || 0;
  return (
    <div
      className="absolute z-20 rounded-md border border-white/10 bg-slate-950/80 px-2 py-1 text-[11px] text-white/80 pointer-events-none"
      style={{
        left: Math.min(coords.x + 12, Math.max(0, safeWidth - 120)),
        top: Math.max(Math.min(coords.y + 12, Math.max(0, safeHeight - 60)), 8),
      }}
    >
      <div>
        Аз {coords.az.toFixed(1)} deg ({coords.label})
      </div>
      <div>Высота {coords.alt.toFixed(1)} deg</div>
      {twilightLabel ? <div>Сумерки: {twilightLabel}</div> : null}
    </div>
  );
}
