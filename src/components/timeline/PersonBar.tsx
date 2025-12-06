import { motion } from 'framer-motion';
import { TimelinePerson } from '@/types/timeline';
import { ColorSystem, generateColorSystem } from '@/utils/timelineColors';
import { PersonLayout } from '@/utils/layoutEngine';

interface PersonBarProps {
  person: TimelinePerson;
  layout: PersonLayout;
  trackHeight: number;
  onSelect: (person: TimelinePerson) => void;
  onHover: (person: TimelinePerson | null) => void;
  isSelected?: boolean;
  isDimmed?: boolean;
  isHovered?: boolean;
  showLabel?: boolean;
  colorSystem?: ColorSystem;
}

export function PersonBar({
  person,
  layout,
  trackHeight,
  onSelect,
  onHover,
  isSelected,
  isDimmed,
  isHovered,
  showLabel,
  colorSystem,
}: PersonBarProps) {
  const colors = colorSystem ?? generateColorSystem(person.period);
  const estimated = person.lifespan_range?.estimated || !person.deathYear;
  const isVerified = Boolean(person.is_verified);
  const displayName = person.name_ru || (person as any).display?.name_ru || person.name_en || person.slug;

  return (
    <motion.g
      initial={{ opacity: 0, scaleX: 0.85 }}
      animate={{ opacity: isDimmed ? 0.35 : 1, scaleX: 1 }}
      transition={{ type: 'spring', stiffness: 140, damping: 18 }}
      onHoverStart={() => onHover(person)}
      onHoverEnd={() => onHover(null)}
      onClick={() => onSelect(person)}
      role="button"
      tabIndex={0}
      aria-label={`Автор на шкале ${person.name_ru}`}
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
        x={layout.x}
        y={layout.y + 3}
        width={layout.width}
        height={trackHeight - 4}
        rx={10}
        fill="black"
        opacity={0.08}
        style={{ filter: 'blur(6px)' }}
      />

      <motion.rect
        x={layout.x}
        y={layout.y}
        width={layout.width}
        height={trackHeight - 6}
        rx={10}
        fill={`url(#gradient-${person.slug})`}
        stroke={colors.periodBase}
        strokeWidth={isSelected ? 2.5 : 1.5}
        strokeDasharray={estimated ? '6 4' : undefined}
        className="cursor-pointer backdrop-blur-sm"
        variants={{
          normal: {
            opacity: 0.9,
            scale: 1,
            y: layout.y,
            filter: 'drop-shadow(0 1px 4px rgba(0,0,0,0.12))',
          },
          hover: {
            opacity: 1,
            scale: 1.01,
            y: layout.y - 4,
            filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.2))',
          },
          selected: {
            opacity: 1,
            scale: 1.02,
            y: layout.y - 6,
            filter: 'drop-shadow(0 12px 26px rgba(0,0,0,0.28))',
          },
        }}
        initial="normal"
        whileHover="hover"
        animate={isSelected ? 'selected' : 'normal'}
      />

      {isHovered && (
        <motion.rect
          x={layout.x}
          y={layout.y}
          width={layout.width}
          height={(trackHeight - 6) * 0.45}
          rx={10}
          fill={`url(#shine-${person.slug})`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }}
        />
      )}

      <g className="life-markers">
        <circle
          cx={layout.x + 6}
          cy={layout.y + (trackHeight - 6) / 2}
          r={5}
          fill={colors.periodBase}
          stroke="white"
          strokeWidth={2}
          opacity={isDimmed ? 0.5 : 1}
        />
        <circle
          cx={layout.x + layout.width - 6}
          cy={layout.y + (trackHeight - 6) / 2}
          r={5}
          fill={colors.periodBase}
          stroke="white"
          strokeWidth={2}
          opacity={estimated || isDimmed ? 0.5 : 1}
        />
      </g>

      {(showLabel && layout.width > 80) && (
        <text
          x={layout.x + layout.width / 2}
          y={layout.y + (trackHeight - 6) / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          className="text-xs font-semibold select-none"
          fill={colors.text.onPeriod}
          opacity={isDimmed ? 0.35 : 0.95}
        >
          {displayName}
          {isVerified ? ' ✓' : ''}
        </text>
      )}
    </motion.g>
  );
}
