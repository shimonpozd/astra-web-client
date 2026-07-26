import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BookOpen, 
  Clock, 
  Milestone, 
  Map, 
  Languages, 
  Play, 
  ArrowRight, 
  Calendar, 
  Sparkles, 
  History, 
  Compass
} from 'lucide-react';
import TopBar from '../components/layout/TopBar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { api, Chat } from '../services/api';
import { cn } from '../lib/utils';

import { useChat } from '../hooks/useChat';

// Helper to get formatted Jewish Date & secular date
function getTodayDates() {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  };
  const secularDateStr = now.toLocaleDateString('ru-RU', options);
  
  return {
    secular: secularDateStr,
    hebrew: '24 Таммуз 5786',
    events: ['Парашат Пинхас', 'Йорцайт Рабби Моше Кордоверо (Рамак)']
  };
}

// Zmanim sample for default coordinates
const MOCK_ZMANIM = [
  { label: 'Алот а-Шахар', time: '02:41', desc: 'Рассвет' },
  { label: 'Шма (ГРА)', time: '08:52', desc: 'Время чтения Шма' },
  { label: 'Хацот', time: '12:44', desc: 'Полдень' },
  { label: 'Заход солнца (Шкиа)', time: '20:48', desc: 'Закат' },
];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { chats, isLoading: loadingChats } = useChat();
  const todayDates = useMemo(() => getTodayDates(), []);
  
  const dailyItems = useMemo(() => {
    return chats.filter(c => c.type === 'daily');
  }, [chats]);

  const recentChats = useMemo(() => {
    return chats.filter(c => c.type !== 'daily').slice(0, 5);
  }, [chats]);

  const [zmanimList, setZmanimList] = useState(MOCK_ZMANIM);
  const [zmanimLocationName, setZmanimLocationName] = useState<string>('Иерусалим');

  useEffect(() => {
    // Determine location & Calculate Zmanim non-blockingly
    let loc = { name: 'Иерусалим', lat: 31.7683, lon: 35.2137 };
    try {
      const savedRaw = localStorage.getItem('astra.zmanim.location');
      if (savedRaw) {
        const saved = JSON.parse(savedRaw);
        if (saved?.lat && saved?.lon) {
          loc = {
            name: saved.name || 'Моё местоположение',
            lat: Number(saved.lat),
            lon: Number(saved.lon),
          };
        }
      }
    } catch {
      /* ignore storage parse error */
    }

    setZmanimLocationName(loc.name);

    const today = new Date().toISOString().split('T')[0];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    api.calculateZmanim({
      date: today,
      timezone: tz,
      location: loc,
      methods: [
        'getAlos16Point1Degrees',
        'getSofZmanShmaGRA',
        'getChatzos',
        'getSunset',
      ],
      use_elevation: false,
    })
      .then(data => {
        if (data?.results) {
          const fmt = (val: any) => {
            if (!val || typeof val !== 'string') return '--:--';
            const d = new Date(val);
            return Number.isNaN(d.getTime()) ? '--:--' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          };
          setZmanimList([
            { label: 'Алот а-Шахар', time: fmt(data.results.getAlos16Point1Degrees), desc: 'Рассвет' },
            { label: 'Шма (ГРА)', time: fmt(data.results.getSofZmanShmaGRA), desc: 'Время чтения Шма' },
            { label: 'Хацот', time: fmt(data.results.getChatzos), desc: 'Полдень' },
            { label: 'Заход солнца (Шкиа)', time: fmt(data.results.getSunset), desc: 'Закат' },
          ]);
        }
      })
      .catch(err => console.warn('Failed to calculate Zmanim:', err));
  }, []);

  const defaultDailyLessons = [
    {
      id: 'daf_yomi',
      title: 'Даф Йоми',
      subtitle: 'Chullin 75a',
      sessionId: 'daily-daf_yomi',
      ref: 'Chullin 75a',
      icon: BookOpen,
      color: 'from-amber-500/20 to-orange-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30',
      btnText: '▶ Начать Даф Йоми'
    },
    {
      id: 'rambam_3',
      title: 'Рамбам (3 главы)',
      subtitle: 'Мишне Тора • Книга 3',
      sessionId: 'daily-rambam_3',
      ref: 'Mishneh Torah, Sabbath 1',
      icon: Sparkles,
      color: 'from-blue-500/20 to-cyan-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30',
      btnText: '▶ Начать Рамбам'
    },
    {
      id: 'chitas',
      title: 'Танах / ХИТАШ',
      subtitle: 'Дварим 2:1-12',
      sessionId: 'daily-chitas',
      ref: 'Deuteronomy 2:1',
      icon: Calendar,
      color: 'from-emerald-500/20 to-teal-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      btnText: '▶ Начать ХИТАШ'
    }
  ];

  const modules = [
    {
      id: 'reader',
      title: 'Astra Reader',
      subtitle: 'Свободное чтение источников & ИИ-Хаврута',
      path: '/study',
      icon: BookOpen,
      badge: 'Монолитный ридер'
    },
    {
      id: 'timeline',
      title: 'Таймлайн Мудрецов',
      subtitle: 'Хронология поколений от Танаив до Ахроним',
      path: '/timeline',
      icon: Milestone,
      badge: 'Все эпохи'
    },
    {
      id: 'yiddish',
      title: 'Идиш-Лаборатория',
      subtitle: 'Интерактивное изучение сихот и бесед Ребе',
      path: '/lab/yiddish',
      icon: Languages,
      badge: 'Аудио & Текст'
    },
    {
      id: 'map',
      title: 'Седер Иштальшелус',
      subtitle: 'Карта цепочки передачи учения Торы',
      path: '/lab/map',
      icon: Map,
      badge: 'Интерактивная карта'
    }
  ];

  const [dailyTab, setDailyTab] = useState<'active' | 'completed'>('active');

  const processedDailyItems = useMemo(() => {
    const rawList = dailyItems.length > 0 ? dailyItems : defaultDailyLessons;
    return rawList.map((item, idx) => {
      const isRambam = item.daily_category?.includes('rambam') || item.session_id?.includes('rambam');
      const isChitas = item.daily_category?.includes('chitas') || item.session_id?.includes('chitas');
      const displaySubtitle = item.display_value_ru || item.display_value || item.display_value_he || item.name;

      return {
        id: item.session_id || `daily-${idx}`,
        title: item.name || item.title || 'Дневной урок',
        subtitle: displaySubtitle,
        ref: item.display_value || item.session_id,
        sessionId: item.session_id,
        completed: Boolean(item.completed),
        icon: isRambam ? Sparkles : isChitas ? Calendar : BookOpen,
        color: isRambam
          ? 'from-blue-500/10 to-cyan-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30'
          : isChitas
          ? 'from-emerald-500/10 to-teal-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : 'from-amber-500/10 to-orange-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
        btnText: item.completed ? '✓ Открыть' : '▶ Начать'
      };
    });
  }, [dailyItems]);

  const visibleDailyItems = useMemo(() => {
    if (dailyTab === 'active') {
      return processedDailyItems.filter(i => !i.completed);
    } else {
      return processedDailyItems.filter(i => i.completed);
    }
  }, [processedDailyItems, dailyTab]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopBar />
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-in fade-in duration-300">
        
        {/* Header Greeting & Jewish Calendar Banner */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-amber-500/10 via-primary/10 to-blue-500/10 border border-border p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight flex items-center gap-3">
                👋 Шалом! 
                <span className="text-sm font-normal text-muted-foreground bg-background/60 backdrop-blur px-3 py-1 rounded-full border border-border">
                  Рабочий Кабинет
                </span>
              </h1>
              <p className="text-muted-foreground mt-2 text-sm sm:text-base flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-semibold text-foreground">{todayDates.hebrew}</span>
                <span>•</span>
                <span>{todayDates.secular}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {todayDates.events.map((ev, idx) => (
                <span key={idx} className="bg-primary/10 text-primary font-medium px-3 py-1.5 rounded-lg border border-primary/20 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  {ev}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 2 Grid Columns: Daily Learning + Zmanim Widget */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Daily Learning Block (2 Cols) */}
          <Card className="lg:col-span-2 shadow-sm border-border">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-primary" />
                    📚 ДНЕВНЫЕ УРОКИ (Дейлики)
                  </CardTitle>
                  <CardDescription>
                    Ваши текущие дневные учебные циклы
                  </CardDescription>
                </div>

                {/* Tabs filter */}
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/40">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      dailyTab === 'active' ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setDailyTab('active')}
                  >
                    Сегодня ({processedDailyItems.filter(i => !i.completed).length})
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      dailyTab === 'completed' ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setDailyTab('completed')}
                  >
                    Пройденные ({processedDailyItems.filter(i => i.completed).length})
                  </button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {visibleDailyItems.length === 0 ? (
                <div className="text-center p-6 text-xs text-muted-foreground font-medium">
                  {dailyTab === 'active' ? 'Все сегодняшние уроки пройдены! 🎉' : 'Нет пройденных уроков'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleDailyItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div 
                        key={item.id} 
                        className={cn(
                          "rounded-xl p-3 border bg-gradient-to-br flex items-center justify-between transition-all hover:shadow-md gap-3",
                          item.color
                        )}
                      >
                        <div className="min-w-0 space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 opacity-70 shrink-0" />
                            <span className="text-[11px] font-bold uppercase tracking-wider opacity-80 truncate">{item.title}</span>
                          </div>
                          <p className="text-sm font-bold font-serif line-clamp-1 text-foreground/90">{item.subtitle}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={item.completed ? "outline" : "default"}
                          className="h-8 px-3 text-xs font-semibold shrink-0 gap-1.5 shadow-sm"
                          onClick={async () => {
                            try {
                              if (item.sessionId) {
                                await api.createDailySessionLazy(item.sessionId);
                                navigate(`/daily/${item.sessionId}`);
                              } else {
                                navigate(`/study/${encodeURIComponent(item.ref)}`);
                              }
                            } catch {
                              navigate(`/study/${encodeURIComponent(item.ref)}`);
                            }
                          }}
                        >
                          <Play className="w-3 h-3 fill-current" />
                          {item.btnText}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Zmanim Widget (1 Col) */}
          <Card className="shadow-sm border-border flex flex-col justify-between">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                ⏱ ЗМАНИМ (Галахическое время)
              </CardTitle>
              <CardDescription>Расписание для: <span className="font-semibold text-foreground">{zmanimLocationName}</span></CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
              <div className="space-y-2.5">
                {zmanimList.map((z, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/40 text-xs">
                    <div>
                      <span className="font-semibold block">{z.label}</span>
                      <span className="text-[10px] text-muted-foreground">{z.desc}</span>
                    </div>
                    <span className="font-mono font-bold text-sm text-primary">{z.time}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between mt-4 font-semibold text-xs"
                onClick={() => navigate('/clock')}
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-primary" />
                  Открыть Астро-карту
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Modules & Tools Grid */}
        <div className="space-y-4">
          <h2 className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            🚀 МОДУЛИ И ИНСТРУМЕНТЫ
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className="group relative rounded-xl border border-border p-5 bg-card hover:bg-muted/40 transition-all cursor-pointer shadow-sm hover:shadow-md flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {mod.badge}
                      </span>
                    </div>
                    <h3 className="font-bold text-base group-hover:text-primary transition-colors">{mod.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{mod.subtitle}</p>
                  </div>

                  <div className="flex items-center text-xs font-semibold text-primary gap-1 pt-2 border-t border-border/40">
                    <span>Открыть модуль</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Study Sessions */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <History className="w-5 h-5 text-primary" />
              💬 ПОСЛЕДНИЕ СЕССИИ И ИЗУЧЕНИЯ
            </CardTitle>
            <CardDescription>Быстрое возобновление незавершенных сессий</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChats ? (
              <div className="py-6 text-center text-xs text-muted-foreground">Загрузка сессий...</div>
            ) : recentChats.length > 0 ? (
              <div className="divide-y divide-border">
                {recentChats.map((chat) => (
                  <div 
                    key={chat.session_id} 
                    onClick={() => navigate(`/study/${chat.session_id}`)}
                    className="py-3 flex items-center justify-between hover:bg-muted/30 px-3 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-md bg-muted text-muted-foreground">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">{chat.display_value || chat.name || chat.session_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(chat.last_modified).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1 text-xs">
                      <span>Продолжить</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                <p>История сессий пуста. Начните свое первое изучение!</p>
                <Button size="sm" className="mt-3" onClick={() => navigate('/study')}>
                  Перейти в Astra Reader
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

      </main>
    </div>
  );
};

export default Dashboard;
