import { Period } from '@/types/timeline';
import { generateColorSystem } from '@/utils/timelineColors';

interface PeriodBackgroundProps {
  period: Period;
  yearToX: (year: number) => number;
  height: number;
  active?: boolean;
}

export function PeriodBackground({ period, yearToX, height, active }: PeriodBackgroundProps) {
  const colors = generateColorSystem(period.id);
  const x = yearToX(period.startYear);
  const width = yearToX(period.endYear) - x;

  return (
    <g className="period-background pointer-events-none">
      <rect
        x={x}
        y={0}
        width={width}
        height={height}
        fill={`url(#pattern-${period.id})`}
        opacity={active ? 0.4 : 0.28}
      />
      <line
        x1={x}
        x2={x}
        y1={0}
        y2={height}
        stroke={colors.periodBorder}
        strokeWidth={3}
        opacity={0.8}
      />
      <line
        x1={x + width}
        x2={x + width}
        y1={0}
        y2={height}
        stroke={colors.periodBorder}
        strokeWidth={2}
        opacity={0.5}
      />
      <text
        x={x + 12}
        y={16}
        fill={colors.text.onBackground}
        className="text-[11px] font-semibold"
      >
        {period.name_ru}
      </text>
    </g>
  );
}
