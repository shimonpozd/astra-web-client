import { TimelinePerson } from '@/types/timeline';
import { generateColorSystem } from '@/utils/timelineColors';

interface PersonBarProps {
  person: TimelinePerson;
  x: number;
  y: number;
  width: number;
  height: number;
  onSelect: (person: TimelinePerson) => void;
  onHover: (person: TimelinePerson | null) => void;
  isSelected?: boolean;
  isDimmed?: boolean;
  showLabel?: boolean;
  isHovered?: boolean;
}

export function PersonBar({
  person,
  x,
  y,
  width,
  height,
  onSelect,
  onHover,
  isSelected,
  isDimmed,
  showLabel,
  isHovered,
}: PersonBarProps) {
  const colors = generateColorSystem(person.period);
  const estimated = person.lifespan_range?.estimated || !person.deathYear;
  const isVerified = Boolean(person.is_verified);
  const displayName = person.name_ru || (person as any).display?.name_ru || person.name_en || person.slug;

  return (
    <g
      data-interactive="true"
      onMouseEnter={() => onHover(person)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(person)}
      role="button"
      tabIndex={0}
      aria-label={`Автор на шкале ${person.name_ru}`}
      className="transition-all duration-150"
    >
      <defs>
        <linearGradient id={`gradient-${person.slug}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.personBar.normal} stopOpacity={0.6} />
          <stop offset="15%" stopColor={colors.personBar.normal} stopOpacity={0.95} />
          <stop offset="85%" stopColor={colors.personBar.normal} stopOpacity={0.95} />
          <stop offset="100%" stopColor={colors.personBar.normal} stopOpacity={0.6} />
        </linearGradient>
        <linearGradient id={`shine-${person.slug}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity={0.35} />
          <stop offset="50%" stopColor="white" stopOpacity={0.12} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </linearGradient>
      </defs>

      <rect
        x={x}
        y={y + 3}
        width={width}
        height={height - 4}
        rx={10}
        fill="black"
        opacity={0.08}
        style={{ filter: 'blur(6px)' }}
      />

      <rect
        x={x}
        y={y}
        width={width}
        height={height - 6}
        rx={10}
        fill={`url(#gradient-${person.slug})`}
        stroke={colors.periodBase}
        strokeWidth={isSelected ? 2.5 : 1.5}
        strokeDasharray={estimated ? '6 4' : undefined}
        className="cursor-pointer"
        style={{
          opacity: isDimmed ? 0.35 : 0.95,
          transition: 'all 140ms ease',
        }}
      />

      <rect
        x={x}
        y={y}
        width={width}
        height={(height - 6) * 0.45}
        rx={10}
        fill={`url(#shine-${person.slug})`}
        opacity={isHovered ? 0.9 : 0}
        style={{ transition: 'opacity 140ms ease' }}
      />

      <g className="life-markers">
        <circle
          cx={x + 6}
          cy={y + (height - 6) / 2}
          r={5}
          fill={colors.periodBase}
          stroke="white"
          strokeWidth={2}
          opacity={isDimmed ? 0.5 : 1}
        />
        <circle
          cx={x + width - 6}
          cy={y + (height - 6) / 2}
          r={5}
          fill={colors.periodBase}
          stroke="white"
          strokeWidth={2}
          opacity={estimated || isDimmed ? 0.5 : 1}
        />
      </g>

      {showLabel && width > 80 && (
        <text
          x={x + width / 2}
          y={y + (height - 6) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-[11px] font-semibold select-none"
          fill={colors.text.onPeriod}
          opacity={isDimmed ? 0.35 : 0.95}
        >
          {displayName}
          {isVerified ? ' ✓' : ''}
        </text>
      )}
    </g>
  );
}
