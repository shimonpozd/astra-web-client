import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { Persona } from '../types/chat';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface PersonaSelectorProps {
  currentPersona?: Persona;
  personas?: Persona[];
  onSelect?: (persona: Persona) => void;
  disabled?: boolean;
}

export default function PersonaSelector({
  currentPersona,
  personas = [],
  onSelect,
  disabled,
}: PersonaSelectorProps) {
  const [open, setOpen] = useState(false);

  const activePersona = currentPersona || personas[0];

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 px-2 rounded-lg hover:bg-muted/60 flex items-center gap-1.5 text-sm"
        >
          <span className="text-muted-foreground">
            {activePersona?.name || 'Выбрать персону'}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top" className="w-56">
        {personas.map((persona) => (
          <DropdownMenuItem
            key={persona.id}
            onClick={() => {
              onSelect?.(persona);
              setOpen(false);
            }}
            className="cursor-pointer"
          >
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">{persona.name}</span>
              {persona.description && (
                <span className="text-xs text-muted-foreground line-clamp-1">
                  {persona.description}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {personas.length === 0 && (
          <DropdownMenuItem disabled>Нет доступных персон</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
