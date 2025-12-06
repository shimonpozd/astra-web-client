import { ChevronDown, LogOut, Settings, TrendingUp, User, Milestone } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface UserMenuProps {
  user: { username?: string; xp_total?: number } | null;
  levelProgress: { level: number };
  logout: () => void;
  navigate: (path: string) => void;
}

function formatXp(value: number) {
  return new Intl.NumberFormat('ru-RU').format(Math.max(0, Math.round(value)));
}

export function UserMenu({ user, levelProgress, logout, navigate }: UserMenuProps) {
  const username = user?.username || 'Пользователь';
  const firstLetter = username[0]?.toUpperCase() || 'U';
  const totalXp = user?.xp_total ?? 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 h-9 px-3 rounded-lg border border-border/60 bg-card/70 hover:bg-card transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-xs font-bold text-white shadow-sm">
            {firstLetter}
          </div>
          <span className="text-sm font-medium max-w-[120px] truncate">{username}</span>
          <ChevronDown className="w-3 h-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <div className="px-3 py-2.5 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-amber-500 flex items-center justify-center text-sm font-bold text-white shadow-md">
              {firstLetter}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{username}</div>
              <div className="text-xs text-muted-foreground">
                Уровень {levelProgress.level} • {formatXp(totalXp)} XP
              </div>
            </div>
          </div>
        </div>

        <DropdownMenuItem onClick={() => navigate('/progress')} className="cursor-pointer">
          <TrendingUp className="w-4 h-4 mr-2" />
          Мой прогресс
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate('/timeline')} className="cursor-pointer">
          <Milestone className="w-4 h-4 mr-2" />
          Таймлайн
        </DropdownMenuItem>

        <DropdownMenuItem onClick={() => navigate('/profile')} className="cursor-pointer">
          <User className="w-4 h-4 mr-2" />
          Профиль
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => navigate('/admin')} className="cursor-pointer">
          <Settings className="w-4 h-4 mr-2" />
          Админ-панель
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-destructive cursor-pointer"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
