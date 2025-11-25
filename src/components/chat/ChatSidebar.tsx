import { Plus, X, Calendar, BookOpen, MessageSquare, ChevronLeft, ChevronRight as ChevronRightIcon, Bookmark, CheckCircle2 } from 'lucide-react';
import { Chat } from '../../services/api';
import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '../theme-provider';
import { useLocation } from 'react-router-dom';

interface ChatSidebarProps {
  chats: Chat[];
  isLoading: boolean;
  error: string | null;
  selectedChatId: string | null;
  onSelectChat: (id: string, type: 'chat' | 'study' | 'daily') => void;
  onCreateChat: () => void;
  onCreateStudy?: () => void;
  onDeleteSession: (id: string, type: 'chat' | 'study' | 'daily') => void;
  onCompleteDaily?: (id: string, completed: boolean) => Promise<any> | void;
  onModeChange?: (mode: 'split' | 'compact') => void;
}

export default function ChatSidebar({
  chats,
  isLoading,
  error,
  selectedChatId,
  onSelectChat,
  onCreateChat,
  onCreateStudy,
  onDeleteSession,
  onCompleteDaily,
  onModeChange,
}: ChatSidebarProps) {
  
  const [mode, setMode] = useState<'split' | 'compact'>(() => {
    try { return (localStorage.getItem('astra_sidebar_mode') as 'split' | 'compact') || 'split'; } catch { return 'split'; }
  });
  const [activeCategory, setActiveCategory] = useState<'daily' | 'study' | 'chat'>(() => {
    try { return (localStorage.getItem('astra_active_category') as 'daily'|'study'|'chat') || 'study'; } catch { return 'study'; }
  });
  const [focusedIndex, setFocusedIndex] = useState<number>(-1);
  const [isFading, setIsFading] = useState(false);
  const [pendingCompleteId, setPendingCompleteId] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ text: string; accent?: boolean } | null>(null);
  const [confirmDailyId, setConfirmDailyId] = useState<string | null>(null);
  const { theme } = useTheme();
  const location = useLocation();
  const routeMatch = location.pathname.match(/^\/(chat|study|daily)\/([^\/?#]+)/);
  const activeRouteType = routeMatch ? (routeMatch[1] as 'chat' | 'study' | 'daily') : null;
  const activeRouteId = routeMatch ? decodeURIComponent(routeMatch[2]) : null;

  const resolveCategoryFromType = (type: 'chat' | 'study' | 'daily'): 'chat' | 'study' | 'daily' => {
    return type === 'chat' ? 'chat' : type;
  };

  const handleSelectCategory = useCallback((cat: 'daily'|'study'|'chat') => {
    setIsFading(true);
    window.setTimeout(() => {
      setActiveCategory(cat);
      setFocusedIndex(-1);
      setIsFading(false);
      try { localStorage.setItem('astra_active_category', cat); } catch {}
    }, 150);
  }, []);

  const syncActiveCategory = useCallback((nextCategory: 'daily' | 'study' | 'chat') => {
    setActiveCategory(prev => {
      if (prev === nextCategory) return prev;
      setFocusedIndex(-1);
      return nextCategory;
    });
  }, []);

  useEffect(() => {
    if (!selectedChatId) return;
    const activeChat = chats.find((chat) => chat.session_id === selectedChatId);
    if (!activeChat) return;
    syncActiveCategory(resolveCategoryFromType(activeChat.type));
  }, [selectedChatId, chats, syncActiveCategory]);

  useEffect(() => {
    if (!activeRouteType) return;
    syncActiveCategory(activeRouteType);
  }, [activeRouteType, syncActiveCategory]);

  // Separate by category
  const dailyChats = chats.filter(chat => chat.type === 'daily');
  const studyChats = chats.filter(chat => chat.type === 'study');
  const simpleChats = chats.filter(chat => chat.type === 'chat');
  const categoryToList: Record<'daily'|'study'|'chat', Chat[]> = {
    daily: dailyChats,
    study: studyChats,
    chat: simpleChats,
  };
  const visibleChats = categoryToList[activeCategory];
  
  // reserved for future use: macOS squircle utility was removed to satisfy lint (unused)
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  // Minimal tokens
  const colorAccent = isDark ? '#b89d63' : '#c2a970';
  const colorFg = isDark ? 'rgba(255,255,255,0.88)' : '#1a1611';
  const colorFgMuted = isDark ? 'rgba(255,255,255,0.70)' : 'rgba(0,0,0,0.45)';
  const colorHover = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
  const colorSelectedBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
  const colorSeparator = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';

  // Autofocus first list item on category change
  useEffect(() => {
    if (visibleChats.length === 0) {
      setFocusedIndex(-1);
    } else {
      setFocusedIndex(0);
    }
  }, [activeCategory]);

  const handleToggleMode = () => {
    const next = mode === 'split' ? 'compact' : 'split';
    setMode(next);
    try { localStorage.setItem('astra_sidebar_mode', next); } catch {}
  };

  const handleKeyDownList = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!visibleChats || visibleChats.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setFocusedIndex(i => Math.min(i + 1, visibleChats.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setFocusedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const idx = focusedIndex >= 0 ? focusedIndex : 0;
      const chat = visibleChats[idx];
      if (chat) onSelectChat(chat.session_id, chat.type);
    } else if (e.key === 'Delete') {
      const idx = focusedIndex >= 0 ? focusedIndex : 0;
      const chat = visibleChats[idx];
      if (chat) {
        // native confirm
        if (window.confirm('Delete this chat?')) onDeleteSession(chat.session_id, chat.type);
      }
    }
  };

  useEffect(() => {
    onModeChange?.(mode);
  }, [mode, onModeChange]);

  const handleCompleteDaily = useCallback(
    async (chat: Chat) => {
      if (!onCompleteDaily) return;
      const targetState = !chat.completed;
      setConfirmDailyId(chat.session_id);
    },
    [onCompleteDaily]
  );

  const collapsed = mode === 'compact';
  const listWidth = collapsed ? 0 : 300;
  const listFlexBasis = collapsed ? '0px' : '300px';
  const listBoxShadow = isDark ? '-1px 0 0 rgba(255,255,255,0.05)' : '-1px 0 0 rgba(0,0,0,0.05)';
  
  const runComplete = async (session_id: string, targetState: boolean, chat: Chat | undefined) => {
    if (!onCompleteDaily) return;
    try {
      setPendingCompleteId(session_id);
      const result = await onCompleteDaily(session_id, targetState);
      if (targetState) {
        const currentStreak = result?.streak?.current ?? 0;
        setFlash({ text: `Отлично! Серия ${currentStreak} 🔥`, accent: true });
      } else {
        setFlash({ text: 'Отметка снята', accent: false });
      }
      window.setTimeout(() => setFlash(null), 2600);
    } finally {
      setPendingCompleteId(null);
      setConfirmDailyId(null);
    }
  };

  return (
    <aside className="border-r panel-outer flex flex-row min-h-0 h-full relative" style={{ color: colorFg }}>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-40%); }
        }
      `}</style>
      {flash && (
        <div
          className="absolute left-16 top-3 z-20 px-3 py-2 rounded-md text-sm shadow-lg"
          style={{
            background: flash.accent ? 'rgba(34,197,94,0.12)' : 'rgba(0,0,0,0.06)',
            color: flash.accent ? '#15803d' : colorFgMuted,
            border: `1px solid ${flash.accent ? 'rgba(34,197,94,0.4)' : colorSeparator}`,
            backdropFilter: 'blur(6px)',
          }}
          aria-live="polite"
        >
          {flash.text}
        </div>
      )}
      {confirmDailyId && (
        <div className="absolute inset-0 z-30 bg-black/30 backdrop-blur-[2px] flex items-center justify-center px-4">
          <div className="bg-background border border-border/80 rounded-lg shadow-xl p-5 max-w-sm w-full space-y-3">
            <div className="text-base font-semibold">Завершить урок?</div>
            <div className="text-sm text-muted-foreground">Отметим дневной отрывок как выполненный. Это продолжит вашу серию.</div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                className="px-3 py-1.5 text-sm rounded-md border border-border/60 text-muted-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setConfirmDailyId(null)}
              >
                Отмена
              </button>
              <button
                className="px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors"
                onClick={() => {
                  const chat = chats.find((c) => c.session_id === confirmDailyId);
                  runComplete(confirmDailyId, !(chat?.completed), chat);
                }}
              >
                Да, завершить
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Left Category Rail */}
      <div
        className={`flex flex-col border-r border-border/50 w-14 flex-none`}
        role="tablist"
        aria-orientation="vertical"
        style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)', paddingTop: 20 }}
      >
        <div className="flex items-center justify-between px-2 pb-2">
          <button
            aria-label={mode === 'split' ? 'Collapse' : 'Expand'}
            aria-expanded={mode === 'split'}
            className="h-8 w-8 grid place-items-center rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ color: colorFgMuted, borderRadius: 8, border: '1px solid transparent' }}
            onClick={handleToggleMode}
          >
            {mode === 'split' ? <ChevronLeft className="w-4 h-4" /> : <ChevronRightIcon className="w-4 h-4" />}
          </button>
        </div>

        {([
          { key: 'study', icon: <BookOpen className="w-5 h-5" />, label: 'Study' },
          { key: 'chat',  icon: <MessageSquare className="w-5 h-5" />, label: 'Chat'  },
          { key: 'daily', icon: <Calendar className="w-5 h-5" />, label: 'Daily' }
        ] as Array<{key: 'daily'|'study'|'chat'; icon: React.ReactNode; label: string}>).map(cat => {
          const selected = activeCategory === cat.key;
          return (
            <button
              key={cat.key}
              role="tab"
              aria-selected={selected}
              className={`mx-2 my-1.5 flex items-center justify-center h-11 rounded-md`}
              style={{
                color: selected ? colorFg : colorFgMuted,
                background: selected ? colorSelectedBg : 'transparent',
                transition: 'all 0.25s cubic-bezier(0.25, 1, 0.5, 1)'
              }}
              onClick={() => handleSelectCategory(cat.key)}
              title={cat.key === 'daily' ? `${cat.label} · в разработке` : cat.label}
            >
              {cat.icon}
            </button>
          );
        })}
      </div>

      {/* Right List */}
      <div
        className={`min-h-0 overflow-hidden flex flex-col transition-all duration-300 ease-in-out ${
          collapsed ? 'flex-none opacity-0 pointer-events-none' : 'flex-1 opacity-100'
        }`}
        style={{
          width: listWidth,
          flexBasis: listFlexBasis,
          flexGrow: collapsed ? 0 : 1,
          boxShadow: listBoxShadow,
        }}
        aria-hidden={collapsed}
      >
          <div className="panel-padding border-b border-[color:var(--color-separator,transparent)]" style={{ borderColor: colorSeparator }}>
            <div className="flex items-center justify-between">
              <h3 className="text-[12px] font-medium tracking-wide" style={{ color: colorFgMuted }}>
                {activeCategory[0].toUpperCase() + activeCategory.slice(1)}
                {activeCategory === 'daily' ? ' · в разработке' : ''}
              </h3>
              <button
                onClick={() => {
                  if (activeCategory === 'study') {
                    onCreateStudy && onCreateStudy();
                  } else if (activeCategory === 'chat') {
                    onCreateChat();
                  }
                }}
                className="h-8 w-8 grid place-items-center rounded-md"
                style={{ border: '1px solid transparent', color: colorAccent }}
                aria-label="New"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto panel-padding-sm" role="list" onKeyDown={handleKeyDownList} tabIndex={collapsed ? -1 : 0}
               style={{ transition: 'all 200ms cubic-bezier(0.25,1,0.5,1)', transform: isFading ? 'translateX(8px)' : 'translateX(0)', opacity: isFading ? 0 : 1 }}>
        {isLoading && (
          <div className="space-y-2">
            {[0,1,2,3].map(i => (
              <div key={i} className="h-11 rounded-md animate-pulse" style={{ background: colorHover }} />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm flex items-center justify-between p-2 rounded-md" style={{ borderColor: colorSeparator, color: colorFgMuted }}>
            <span>Error loading. </span>
            <button className="text-xs rounded-md px-2 py-1" style={{ border: `1px solid ${colorAccent}`, color: colorAccent }} onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {!isLoading && !error && (
          <div className="flex flex-col gap-2" role="presentation">
            {visibleChats.length === 0 ? (
              <div className="flex items-center justify-start gap-2 text-sm p-2 rounded-md" style={{ color: colorFgMuted }}>
                <span className="w-4 h-4 rounded-full" style={{ background: colorSeparator }} />
                <span>No items</span>
              </div>
            ) : (
              visibleChats.map((chat, idx) => {
                const isRouteActive = Boolean(activeRouteId && activeRouteType === chat.type && activeRouteId === chat.session_id);
                const selected = isRouteActive || (!activeRouteId && selectedChatId === chat.session_id);
                return (
                  <div
                    key={chat.session_id}
                    role="listitem"
                    tabIndex={0}
                    aria-selected={selected}
                    onFocus={() => setFocusedIndex(idx)}
                    className="relative flex items-center justify-between h-12 px-3 rounded-md outline-none gap-2"
                    style={{
                      background: selected ? (isDark ? 'rgba(184,157,99,0.12)' : 'rgba(194,169,112,0.10)') : 'transparent',
                      transition: 'all 200ms cubic-bezier(0.25,1,0.5,1)'
                    }}
                    onClick={() => {
                      handleSelectCategory(resolveCategoryFromType(chat.type));
                      onSelectChat(chat.session_id, chat.type);
                    }}
                  >
                    {selected && (
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded"
                            style={{ background: `linear-gradient(180deg, ${colorAccent} 0%, transparent 100%)` }} />
                    )}
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Secondary badges */}
                        {chat.type === 'daily' ? (
                          <span className="relative w-5 h-5 grid place-items-center">
                            <span className="absolute w-2.5 h-2.5 rounded-full" style={{ background: chat.completed ? colorAccent : colorSeparator }} />
                            {chat.completed && (
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" strokeWidth={2} />
                            )}
                          </span>
                        ) : chat.type === 'study' ? (
                          <Bookmark className="w-3.5 h-3.5" style={{ color: colorFgMuted }} />
                        ) : null}

                        <div className="min-w-0 space-y-0.5">
                          <span
                            className="truncate text-[14.5px] font-[600] tracking-[-0.01em]"
                            title={chat.display_value_ru || chat.display_value || chat.name}
                          >
                            {chat.display_value_ru || chat.display_value || chat.name}
                          </span>
                          {chat.type === 'daily' && (
                            <div className="flex items-center gap-2 text-[11px]" style={{ color: colorFgMuted }}>
                              <div className="relative min-w-0 flex-1 overflow-hidden">
                                <div
                                  className="whitespace-nowrap overflow-hidden"
                                  style={{
                                    maskImage: 'linear-gradient(90deg, rgba(0,0,0,1) 80%, rgba(0,0,0,0) 100%)',
                                  }}
                                >
                                  <span
                                    className="inline-block"
                                    title={chat.ref || chat.display_value || chat.name}
                                    style={{
                                      animation: (chat.ref && chat.ref.length > 28) ? 'marquee 9s linear infinite' : undefined,
                                    }}
                                  >
                                    {chat.ref || chat.display_value_ru || chat.display_value || '—'}
                                  </span>
                                </div>
                              </div>
                              {chat.daily_stream && chat.daily_stream.units_total > 1 && (
                                <span className="font-semibold" style={{ color: colorAccent }}>
                                  {chat.daily_stream.unit_index_today + 1}/{chat.daily_stream.units_total}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                    {chat.type === 'daily' ? (
                      <button
                        className="p-1.5 rounded opacity-80 hover:opacity-100 transition-opacity ml-auto"
                        onClick={(e) => { e.stopPropagation(); handleCompleteDaily(chat); }}
                        aria-label={chat.completed ? "Снять отметку" : "Отметить завершение"}
                        disabled={pendingCompleteId === chat.session_id}
                        style={{ color: chat.completed ? colorAccent : colorFgMuted }}
                      >
                        <CheckCircle2
                          className="w-4 h-4"
                          strokeWidth={1.8}
                          fill={chat.completed ? colorAccent : 'transparent'}
                          style={{ transition: 'all 150ms ease-out' }}
                        />
                      </button>
                    ) : (
                      <button
                        className="p-1 rounded opacity-40 hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); onDeleteSession(chat.session_id, chat.type); }}
                        aria-label="Delete chat"
                      >
                        <X className="w-3 h-3" style={{ color: colorFgMuted, transition: 'transform 120ms ease-out, opacity 120ms ease-out' }} strokeWidth={1.25} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
          </div>
      </div>
    </aside>
  );
}
