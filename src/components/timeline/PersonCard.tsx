import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { Period, TimelinePerson } from '@/types/timeline';
import { PersonLayout } from '@/utils/layoutEngine';
import { SealSvg } from '@/utils/sealGenerator';
import { getPersonTier, getPersonHook, getPersonSealColor, getPersonLifespanLabel } from '@/utils/personVisuals';

interface PersonCardProps {
  person: TimelinePerson;
  layout?: Partial<PersonLayout>;
  onSelect: (p: TimelinePerson) => void;
  isSelected?: boolean;
  periodColor?: string;
  period?: Period;
  className?: string;
}

export function PersonCard({
  person,
  layout,
  onSelect,
  isSelected = false,
  period,
  className,
}: PersonCardProps) {
  const [isHovered, setIsHovered] = useState(false);

  const tier = getPersonTier(person);
  const sealColor = getPersonSealColor(person, period);
  const nameRu = person.name_ru || (person as any).display?.name_ru;
  const nameEn = person.name_en || (person as any).title_en || person.slug;
  const displayName = nameRu || nameEn;
  const secondaryName = nameRu && nameEn ? nameEn : null;
  const lifespanLabel = getPersonLifespanLabel(person);
  const hook = getPersonHook(person, 100);

  const sealSize = tier === 'star' ? 36 : tier === 'notable' ? 28 : 20;

  return (
    <div
      className={cn(
        'relative rounded-xl text-left cursor-pointer transition-all duration-200 select-none overflow-hidden',
        'border',
        tier === 'star'
          ? 'bg-gradient-to-br from-[#242A5C] to-[#1E2350] border-[#C9A94E] shadow-[0_4px_20px_rgba(201,169,78,0.18)]'
          : tier === 'notable'
          ? 'bg-[#1E2350] hover:bg-[#242A5C] border-[#C9A94E]/25 shadow-sm'
          : 'bg-[#1E2350] hover:bg-[#242A5C] border-white/5',
        isSelected && 'ring-2 ring-[#C9A94E] ring-offset-2 ring-offset-[#14183B]',
        className
      )}
      style={{
        width: layout?.width ? Math.max(layout.width, 180) : 220,
      }}
      onClick={() => onSelect(person)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="button"
      tabIndex={0}
    >
      {/* Star badge */}
      {tier === 'star' && (
        <div className="absolute top-2 right-2.5 text-[#C9A94E] text-xs font-bold select-none">
          ★
        </div>
      )}

      <div className="p-3 flex items-start gap-2.5">
        <div className="flex-shrink-0 pt-0.5">
          <SealSvg slug={person.slug} color={sealColor} size={sealSize} />
        </div>

        <div className="min-w-0 flex-1">
          <div
            className={cn(
              'leading-tight text-white line-clamp-2',
              tier === 'regular' ? 'text-xs font-medium text-[#C7CAE6]' : 'text-sm font-semibold font-serif font-display'
            )}
          >
            {displayName}
          </div>

          {secondaryName && tier !== 'regular' && (
            <div className="text-[10px] text-[#9AA0C4] truncate mt-0.5 font-sans">
              {secondaryName}
            </div>
          )}

          {lifespanLabel && (tier !== 'regular' || isHovered) && (
            <div
              className={cn(
                'text-[10.5px] mt-1 font-sans tabular-nums',
                tier === 'star' ? 'text-[#C9A94E] font-medium' : 'text-[#9AA0C4]'
              )}
            >
              {lifespanLabel}
            </div>
          )}

          {hook && (tier !== 'regular' || isHovered) && (
            <div className="mt-2 text-[11px] leading-relaxed text-[#9AA0C4] italic border-l-2 pl-2 border-[#C9A94E]/40 font-sans">
              {hook}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
