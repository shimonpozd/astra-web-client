import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Clock, 
  Languages, 
  Map, 
  Milestone, 
  Search, 
  ChevronDown, 
  BookOpen, 
  Sparkles 
} from 'lucide-react';

import { ThemeToggle } from '../ThemeToggle';
import { useAuth } from '../../contexts/AuthContext';
import { useGamification } from '../../contexts/GamificationContext';
import { UserMenu } from './UserMenu';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu';
import { config } from '../../config';

export const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const gamification = useGamification();
  const [searchQuery, setSearchQuery] = useState('');

  const levelProgress = gamification ? {
    level: gamification.level,
    xpIntoLevel: gamification.xpIntoLevel,
    xpForLevel: gamification.xpForLevel,
    xpToNext: gamification.xpToNext,
    progress: gamification.progress,
  } : {
    level: 1,
    xpIntoLevel: 0,
    xpForLevel: 300,
    xpToNext: 300,
    progress: 0,
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/study/${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="h-16 border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 flex-shrink-0 bg-background/95 backdrop-blur-sm z-30">
      {/* Left: Logo & Search */}
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <button
          onClick={() => navigate('/')}
          className="flex items-center gap-2 hover:opacity-80 transition-opacity flex-shrink-0"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-lg">
            A
          </div>
          <span className="text-lg font-extrabold tracking-tight hidden sm:inline">Astra</span>
        </button>

        {/* Global Search Bar */}
        <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Поиск по источникам Sefaria (например, Berakhot 2a)..."
            className="pl-9 pr-3 h-9 text-xs bg-muted/30 border-border/60 focus:bg-background transition-colors w-full rounded-full"
          />
        </form>
      </div>

      {/* Right: Tools Menu, Theme, Profile */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        {/* Tools Dropdown Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 px-3 gap-1.5 font-semibold text-xs border-border/60">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Инструменты</span>
              <ChevronDown className="w-3.5 h-3.5 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onClick={() => navigate('/study')} className="gap-2 cursor-pointer text-xs">
              <BookOpen className="w-4 h-4 text-amber-500" />
              <span>Astra Reader</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/clock')} className="gap-2 cursor-pointer text-xs">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>Часы Зманим</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/timeline')} className="gap-2 cursor-pointer text-xs">
              <Milestone className="w-4 h-4 text-emerald-500" />
              <span>Таймлайн Мудрецов</span>
            </DropdownMenuItem>
            {config.features.yiddishMode && (
              <DropdownMenuItem onClick={() => navigate('/lab/yiddish')} className="gap-2 cursor-pointer text-xs">
                <Languages className="w-4 h-4 text-purple-500" />
                <span>Идиш-Лаборатория</span>
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/lab/map')} className="gap-2 cursor-pointer text-xs">
              <Map className="w-4 h-4 text-indigo-500" />
              <span>Седер Иштальшелус</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ThemeToggle />

        <UserMenu
          user={user}
          levelProgress={levelProgress}
          logout={logout}
          navigate={navigate}
        />
      </div>
    </header>
  );
};

export default TopBar;
