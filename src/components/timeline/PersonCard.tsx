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
        'border shadow-sm',
        tier === 'star'
          ? 'bg-card border-[#C9A94E] shadow-[0_4px_20px_rgba(201,169,78,0.22)]'
          : tier === 'notable'
          ? 'bg-card hover:bg-muted/70 border-[#C9A94E]/40'
          : 'bg-card hover:bg-muted/70 border-border',
        isSelected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
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
              'leading-tight text-foreground line-clamp-2',
              tier === 'regular' ? 'text-xs font-medium' : 'text-sm font-semibold font-serif font-display'
            )}
          >
            {displayName}
          </div>

          {secondaryName && tier !== 'regular' && (
            <div className="text-[10.5px] text-muted-foreground truncate mt-0.5 font-sans">
              {secondaryName}
            </div>
          )}

          {lifespanLabel && (tier !== 'regular' || isHovered) && (
            <div
              className={cn(
                'text-[10.5px] mt-1 font-sans tabular-nums',
                tier === 'star' ? 'text-[#C9A94E] font-medium' : 'text-muted-foreground'
              )}
            >
              {lifespanLabel}
            </div>
          )}

          {hook && (tier !== 'regular' || isHovered) && (
            <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground italic border-l-2 pl-2 border-[#C9A94E]/50 font-sans">
              {hook}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
