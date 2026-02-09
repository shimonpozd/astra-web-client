import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import { Clock, Languages, Map, Milestone } from 'lucide-react';

import { ThemeToggle } from '../ThemeToggle';
import { useLayout } from '../../contexts/LayoutContext';
import { useAuth } from '../../contexts/AuthContext';
import { useGamification } from '../../contexts/GamificationContext';
import { LayoutSelector } from './LayoutSelector';
import { LevelProgressBar } from './LevelProgressBar';
import { UserMenu } from './UserMenu';
import { Button } from '../ui/button';
import { config } from '../../config';

const BASE_LEVEL_XP = 300;
const LEVEL_GROWTH = 1.18;

function calculateLevelProgress(totalXp: number) {
  let level = 1;
  let remainingXp = Math.max(0, totalXp);
  let xpForLevel = BASE_LEVEL_XP;

  while (remainingXp >= xpForLevel) {
    remainingXp -= xpForLevel;
    level += 1;
    xpForLevel = Math.round(BASE_LEVEL_XP * LEVEL_GROWTH ** (level - 1));
  }

  const progress = xpForLevel === 0 ? 0 : Math.min(1, remainingXp / xpForLevel);

  return {
    level,
    xpIntoLevel: remainingXp,
    xpForLevel,
    xpToNext: Math.max(0, xpForLevel - remainingXp),
    progress,
  };
}

const TopBar: React.FC = () => {
  const navigate = useNavigate();
  const { mode, setMode } = useLayout();
  const { logout, user } = useAuth();
  const gamification = useGamification();
  const levelProgress = useMemo(() => {
    if (gamification) {
      return {
        level: gamification.level,
        xpIntoLevel: gamification.xpIntoLevel,
        xpForLevel: gamification.xpForLevel,
        xpToNext: gamification.xpToNext,
        progress: gamification.progress,
      };
    }
    const xpTotal = user?.xp_total ?? 0;
    return calculateLevelProgress(xpTotal);
  }, [gamification, user]);

  return (
    <div className="h-16 border-b panel-outer px-6 flex items-center gap-4 flex-shrink-0 bg-background/95 backdrop-blur-sm">
      <div className="flex items-center gap-3 flex-shrink-0 min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">Astra</h1>
        <LayoutSelector mode={mode} setMode={setMode} />
        <ThemeToggle />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => navigate('/timeline')}
          className="gap-2 font-semibold shadow-sm"
        >
          <Milestone className="w-4 h-4" />
          Таймлайн
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => navigate('/map')}
          className="gap-2 font-semibold shadow-sm"
        >
          <Map className="w-4 h-4" />
          Карта
        </Button>
        
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => navigate('/clock')}
          className="gap-2 font-semibold shadow-sm"
        >
          <Clock className="w-4 h-4" />
          Часы
        </Button>
        {config.features.yiddishMode ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => navigate('/yiddish')}
            className="gap-2 font-semibold shadow-sm"
          >
            <Languages className="w-4 h-4" />
            Yiddish
          </Button>
        ) : null}
      </div>
      <div className="flex-1 flex justify-center min-w-0">
        <LevelProgressBar
          levelProgress={levelProgress}
          onClick={() => navigate('/progress')}
        />
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <UserMenu
          user={user}
          levelProgress={levelProgress}
          logout={logout}
          navigate={navigate}
        />
      </div>
    </div>
  );
};

export default TopBar;
