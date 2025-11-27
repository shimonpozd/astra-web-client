import { Check, ChevronDown, LayoutDashboard, PanelRight } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { StudyLayoutMode } from '@/contexts/LayoutContext';

interface LayoutSelectorProps {
  mode: StudyLayoutMode;
  setMode: (mode: StudyLayoutMode) => void;
}

const layoutOptions: Array<{
  value: StudyLayoutMode;
  icon: typeof LayoutDashboard;
  label: string;
}> = [
  {
    value: 'talmud_default',
    icon: LayoutDashboard,
    label: 'Две панели',
  },
  {
    value: 'vertical_three',
    icon: PanelRight,
    label: 'Три панели',
  },
];

export function LayoutSelector({ mode, setMode }: LayoutSelectorProps) {
  const currentLayout = layoutOptions.find((option) => option.value === mode) ?? layoutOptions[0];
  const CurrentIcon = currentLayout.icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-card/70 hover:bg-card transition-colors text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <CurrentIcon className="w-4 h-4" />
          <span className="hidden md:inline">{currentLayout.label}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Раскладка</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {layoutOptions.map((option) => {
          const OptionIcon = option.icon;
          const isActive = option.value === mode;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setMode(option.value)}
              className="cursor-pointer"
            >
              <OptionIcon className="w-4 h-4 mr-2" />
              {option.label}
              {isActive ? <Check className="w-4 h-4 ml-auto text-primary" /> : null}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
