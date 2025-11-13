import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LayoutDashboard, PanelRight, type LucideIcon } from 'lucide-react';

import PersonaSelector from '../PersonaSelector';
import { ThemeToggle } from '../ThemeToggle';
import { StudyLayoutMode, useLayout } from '../../contexts/LayoutContext';
import { useAuth } from '../../contexts/AuthContext';

interface TopBarProps {
  agentId: string;
  setAgentId: (value: string) => void;
}

const layoutOptions: Array<{
  value: StudyLayoutMode;
  icon: LucideIcon;
  label: string;
  title: string;
}> = [
  {
    value: 'talmud_default',
    icon: LayoutDashboard,
    label: 'Две панели',
    title: 'Талмуд: две панели',
  },
  {
    value: 'vertical_three',
    icon: PanelRight,
    label: 'Три панели',
    title: 'Три вертикальные панели',
  },
];

const TopBar: React.FC<TopBarProps> = ({ agentId, setAgentId }) => {
  const navigate = useNavigate();
  const { mode, setMode } = useLayout();
  const { logout, user } = useAuth();

  return (
    <div className="h-16 border-b panel-outer px-6 flex items-center justify-between gap-6 flex-shrink-0 bg-background/95">
      <div className="flex items-center gap-4 min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">Astra</h1>
        <div className="flex items-center gap-1 rounded-lg border border-border/60 bg-card/70 px-1 py-1 shadow-sm">
          {layoutOptions.map((option) => {
            const Icon = option.icon;
            const isActive = mode === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setMode(option.value)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary/10 border border-primary/40 text-primary'
                    : 'border border-transparent text-foreground/80 hover:text-foreground hover:bg-muted/60'
                }`}
                title={option.title}
                aria-pressed={isActive}
              >
                <Icon className="h-4 w-4" strokeWidth={1.6} />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {user ? (
          <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={user.username}>
            {user.username}
          </span>
        ) : null}
        <button
          onClick={() => navigate('/admin')}
          className="h-8 text-xs rounded-lg border border-border/50 px-3 flex items-center hover:bg-accent/50 transition-colors"
          title="Админ-панель"
        >
          Admin
        </button>
        <button
          onClick={logout}
          className="h-8 text-xs rounded-lg border border-border/50 px-3 flex items-center hover:bg-accent/50 transition-colors"
        >
          Выйти
        </button>
        <div className="w-48">
          <PersonaSelector selected={agentId} onSelect={setAgentId} />
        </div>
        <ThemeToggle />
      </div>
    </div>
  );
};

export default TopBar;
