/**
 * DESIGN SYSTEM NOTE
 * ------------------
 * This dashboard is set up for a two-typeface system:
 *  - display/serif  → "Fraunces"      (headings, dates, Torah source citations)
 *  - body/sans      → "Inter"         (UI text, labels, descriptions)
 *  - data/mono      → "JetBrains Mono" (zmanim times)
 *
 * Add this to your index.html <head> (or import in your global CSS):
 *
 *   <link rel="preconnect" href="https://fonts.googleapis.com">
 *   <link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap" rel="stylesheet">
 *
 * And in tailwind.config.js, extend fontFamily:
 *   fontFamily: {
 *     sans: ['Inter', 'sans-serif'],
 *     serif: ['Fraunces', 'serif'],
 *     mono: ['"JetBrains Mono"', 'monospace'],
 *   }
 */
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
  Compass,
  ChevronDown
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

const ZMANIM_LABELS_RU: Record<string, { label: string; desc: string }> = {
  getAlos16Point1Degrees: { label: 'Алот а-Шахар (16.1°)', desc: 'Рассвет (заря)' },
  getAlos72: { label: 'Алот а-Шахар (72 мин)', desc: 'Рассвет МГА' },
  getAlosBaalHatanya: { label: 'Алот а-Шахар (Алтер Ребе)', desc: 'Рассвет по Баал а-Тания' },
  getMisheyakir11Degrees: { label: 'Мишейакир (11°)', desc: 'Время цицит и тфилин' },
  getSunrise: { label: 'Восход солнца (Нец)', desc: 'Астрономический восход' },
  getSeaLevelSunrise: { label: 'Восход на уровне моря', desc: 'Восход солнца' },
  getSunriseBaalHatanya: { label: 'Восход (Алтер Ребе)', desc: 'Восход по Баал а-Тания' },
  getSofZmanShmaGRA: { label: 'Шма (ГРА)', desc: 'Время чтения Шма' },
  getSofZmanShmaMGA: { label: 'Шма (МГА)', desc: 'Время чтения Шма МГА' },
  getSofZmanShmaBaalHatanya: { label: 'Шма (Алтер Ребе)', desc: 'Время чтения Шма' },
  getSofZmanTfilaGRA: { label: 'Тфила (ГРА)', desc: 'Время утренней молитвы' },
  getSofZmanTfilaMGA: { label: 'Тфила (МГА)', desc: 'Время утренней молитвы МГА' },
  getChatzos: { label: 'Хацот а-Йом', desc: 'Астрономический полдень' },
  getChatzosHayomBaalHatanya: { label: 'Хацот (Алтер Ребе)', desc: 'Полдень по Баал а-Тания' },
  getMinchaGedola: { label: 'Минха Гедола', desc: 'Начало дневной молитвы' },
  getMinchaKetana: { label: 'Минха Ктана', desc: 'Малая Минха' },
  getPlagHamincha: { label: 'Плаг а-Минха', desc: 'Раннее зажигание свечей' },
  getSunset: { label: 'Заход солнца (Шкиа)', desc: 'Закат' },
  getSunsetBaalHatanya: { label: 'Закат (Алтер Ребе)', desc: 'Закат по Баал а-Тания' },
  getTzaisGeonim7Point083Degrees: { label: 'Цейт а-Кохавим (Геоним)', desc: 'Выход звезд' },
  getTzais72: { label: 'Цейт а-Кохавим (72 мин)', desc: 'Выход звезд по Рабейну Там' },
  getTzaisBaalHatanya: { label: 'Цейт а-Кохавим (Алтер Ребе)', desc: 'Выход звезд по Баал а-Тания' },
};

function getZmanInfo(methodId: string): { label: string; desc: string } {
  if (ZMANIM_LABELS_RU[methodId]) {
    return ZMANIM_LABELS_RU[methodId];
  }
  const clean = methodId
    .replace(/^get/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim();
  return { label: clean, desc: 'Галахическое время' };
}

const DEFAULT_ZMANIM = [
  { label: 'Алот а-Шахар', time: '--:--', desc: 'Рассвет' },
  { label: 'Шма (ГРА)', time: '--:--', desc: 'Время чтения Шма' },
  { label: 'Хацот', time: '--:--', desc: 'Полдень' },
  { label: 'Заход солнца (Шкиа)', time: '--:--', desc: 'Закат' },
];

const LESSON_ACCENTS: Record<string, { border: string; iconBg: string; iconText: string; chip: string }> = {
  amber: {
    border: 'border-l-amber-500/70',
    iconBg: 'bg-amber-500/10 dark:bg-amber-400/10',
    iconText: 'text-amber-600 dark:text-amber-400',
    chip: 'text-amber-700 dark:text-amber-300',
  },
  blue: {
    border: 'border-l-blue-500/70',
    iconBg: 'bg-blue-500/10 dark:bg-blue-400/10',
    iconText: 'text-blue-600 dark:text-blue-400',
    chip: 'text-blue-700 dark:text-blue-300',
  },
  emerald: {
    border: 'border-l-emerald-500/70',
    iconBg: 'bg-emerald-500/10 dark:bg-emerald-400/10',
    iconText: 'text-emerald-600 dark:text-emerald-400',
    chip: 'text-emerald-700 dark:text-emerald-300',
  },
};

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { chats, isLoading: loadingChats } = useChat();
  const todayDates = useMemo(() => getTodayDates(), []);
  
  const dailyItems = useMemo(() => {
    const todayIso = new Date().toISOString().split('T')[0];
    return chats.filter(c => {
      if (c.type !== 'daily') return false;
      if (c.session_id.includes(todayIso)) return true;
      const parts = c.session_id.split('-');
      if (parts.length >= 4) {
        const itemDateStr = `${parts[1]}-${parts[2]}-${parts[3]}`;
        return itemDateStr === todayIso;
      }
      return false;
    });
  }, [chats]);

  const recentChats = useMemo(() => {
    return chats.filter(c => c.type !== 'daily').slice(0, 5);
  }, [chats]);

  const [zmanimList, setZmanimList] = useState<{ label: string; time: string; desc: string }[]>(DEFAULT_ZMANIM);
  const [zmanimLocationName, setZmanimLocationName] = useState<string>('Иерусалим');

  useEffect(() => {
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

    let selectedMethods: string[] = [];
    try {
      const savedMethods = localStorage.getItem('astra.zmanim.methods');
      if (savedMethods) {
        const parsed = JSON.parse(savedMethods);
        if (Array.isArray(parsed) && parsed.length > 0) {
          selectedMethods = parsed;
        }
      }
    } catch {
      /* ignore storage parse error */
    }

    if (selectedMethods.length === 0) {
      selectedMethods = [
        'getAlos16Point1Degrees',
        'getSunrise',
        'getSofZmanShmaGRA',
        'getChatzos',
        'getSunset',
        'getTzaisGeonim7Point083Degrees',
      ];
    }

    const today = new Date().toISOString().split('T')[0];
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

    api.calculateZmanim({
      date: today,
      timezone: tz,
      location: loc,
      methods: selectedMethods,
      use_elevation: false,
    })
      .then(data => {
        if (data?.results) {
          const fmt = (val: any) => {
            if (!val || typeof val !== 'string') return null;
            const d = new Date(val);
            return Number.isNaN(d.getTime()) ? null : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          };

          const list: { label: string; time: string; desc: string }[] = [];
          for (const mId of selectedMethods) {
            const rawVal = data.results[mId];
            const timeFormatted = fmt(rawVal);
            if (timeFormatted) {
              const info = getZmanInfo(mId);
              list.push({
                label: info.label,
                time: timeFormatted,
                desc: info.desc,
              });
            }
          }
          if (list.length > 0) {
            setZmanimList(list);
          }
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
      color: 'amber',
      btnText: 'Начать'
    },
    {
      id: 'rambam_3',
      title: 'Рамбам (3 главы)',
      subtitle: 'Мишне Тора • Книга 3',
      sessionId: 'daily-rambam_3',
      ref: 'Mishneh Torah, Sabbath 1',
      icon: Sparkles,
      color: 'blue',
      btnText: 'Начать'
    },
    {
      id: 'chitas',
      title: 'Танах / ХИТАШ',
      subtitle: 'Дварим 2:1-12',
      sessionId: 'daily-chitas',
      ref: 'Deuteronomy 2:1',
      icon: Calendar,
      color: 'emerald',
      btnText: 'Начать'
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
      title: 'Таймлайн',
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
      subtitle: 'Карта цепочки Седер Иштальшелус',
      path: '/lab/map',
      icon: Map,
      badge: 'Интерактивная карта'
    }
  ];

  const [dailyTab, setDailyTab] = useState<'active' | 'completed'>('active');

  const processedDailyItems = useMemo(() => {
    const rawList = dailyItems.length > 0 ? dailyItems : defaultDailyLessons;

    const getPriority = (item: any): number => {
      const title = (item.title || item.name || '').toLowerCase();
      const session = (item.sessionId || item.session_id || item.id || '').toLowerCase();
      const cat = (item.daily_category || item.category || '').toLowerCase();

      if (title.includes('daf yomi') || title.includes('даф') || session.includes('daf_yomi')) return 100;
      if (title.includes('rambam (3') || session.includes('rambam_3')) return 90;
      if (title.includes('rambam (1') || session.includes('rambam_1') || title.includes('рамбам')) return 85;
      if (title.includes('parasha') || session.includes('parasha') || title.includes('недельн')) return 80;
      if (title.includes('chitas') || session.includes('chitas') || title.includes('929') || session.includes('929')) return 75;
      if (title.includes('tanakh') || session.includes('tanakh')) return 70;
      if (title.includes('haftarah') || session.includes('haftarah')) return 60;
      return 50;
    };

    const cleanSubtitle = (sub: string, fallbackTitle: string): string => {
      if (!sub) return fallbackTitle;
      let clean = sub.trim();
      if (/^\d{1,2}\s+\d{1,2}\s+/.test(clean)) {
        clean = clean.replace(/^\d{1,2}\s+\d{1,2}\s+/, '');
      }
      return clean || fallbackTitle;
    };

    const mapped = rawList.map((item, idx) => {
      const isRambam = item.daily_category?.includes('rambam') || item.session_id?.includes('rambam') || item.title?.includes('Rambam');
      const isChitas = item.daily_category?.includes('chitas') || item.session_id?.includes('chitas') || item.title?.includes('Chitas');
      const itemTitle = item.title_ru || item.name || item.title || 'Дневной урок';
      const rawSub = item.display_value_ru || item.display_value || item.display_value_he || item.name || '';
      const displaySubtitle = cleanSubtitle(rawSub, itemTitle);

      return {
        id: item.session_id || `daily-${idx}`,
        title: itemTitle,
        subtitle: displaySubtitle,
        ref: item.display_value || item.session_id,
        sessionId: item.session_id,
        completed: Boolean(item.completed),
        priority: getPriority(item),
        icon: isRambam ? Sparkles : isChitas ? Calendar : BookOpen,
        color: isRambam ? 'blue' : isChitas ? 'emerald' : 'amber',
        btnText: item.completed ? 'Открыть' : 'Начать'
      };
    });

    mapped.sort((a, b) => b.priority - a.priority);
    return mapped;
  }, [dailyItems]);

  const [isAllDailyExpanded, setIsAllDailyExpanded] = useState(false);

  const filteredDailyItems = useMemo(() => {
    if (dailyTab === 'active') {
      return processedDailyItems.filter(i => !i.completed);
    } else {
      return processedDailyItems.filter(i => i.completed);
    }
  }, [processedDailyItems, dailyTab]);

  const visibleDailyItems = useMemo(() => {
    return isAllDailyExpanded ? filteredDailyItems : filteredDailyItems.slice(0, 4);
  }, [filteredDailyItems, isAllDailyExpanded]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopBar />
      
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-10 animate-in fade-in duration-300">

        {/* Header Greeting & Jewish Calendar Banner */}
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-10 shadow-sm">
          {/* subtle top accent line, evoking a manuscript rule */}
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-amber-500/60 via-primary/50 to-blue-500/60" />

          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 relative z-10">
            <div className="space-y-3">
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                Рабочий кабинет
              </span>
              <h1 className="font-serif text-3xl sm:text-4xl font-semibold tracking-tight text-foreground">
                Шалом!
              </h1>
              <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm sm:text-base">
                <span className="font-serif font-semibold text-foreground">{todayDates.hebrew}</span>
                <span className="text-border">•</span>
                <span className="text-muted-foreground">{todayDates.secular}</span>
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {todayDates.events.map((ev, idx) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground/80"
                >
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
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
            <CardHeader className="pb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="font-serif text-xl font-semibold flex items-center gap-2.5">
                    <BookOpen className="w-5 h-5 text-primary" />
                    Дневные уроки
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Ваши текущие дневные учебные циклы
                  </CardDescription>
                </div>

                {/* Tabs filter */}
                <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border/40">
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      dailyTab === 'active' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    )}
                    onClick={() => setDailyTab('active')}
                  >
                    Сегодня ({processedDailyItems.filter(i => !i.completed).length})
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "px-3 py-1 text-xs font-semibold rounded-md transition-all",
                      dailyTab === 'completed' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
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
                <div className="text-center py-8 text-sm text-muted-foreground">
                  {dailyTab === 'active' ? 'Все сегодняшние уроки пройдены.' : 'Нет пройденных уроков'}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {visibleDailyItems.map((item) => {
                    const Icon = item.icon;
                    const accent = LESSON_ACCENTS[item.color] || LESSON_ACCENTS.amber;
                    return (
                      <div
                        key={item.id}
                        className={cn(
                          "rounded-lg border border-border border-l-4 bg-muted/20 p-3.5 flex items-center justify-between gap-3 transition-all hover:bg-muted/40",
                          accent.border
                        )}
                      >
                        <div className="min-w-0 flex items-start gap-3">
                          <div className={cn("shrink-0 rounded-md p-1.5", accent.iconBg)}>
                            <Icon className={cn("w-3.5 h-3.5", accent.iconText)} />
                          </div>
                          <div className="min-w-0 space-y-0.5">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground truncate block">
                              {item.title}
                            </span>
                            <p className="text-sm font-medium font-serif line-clamp-1 text-foreground">{item.subtitle}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={item.completed ? "outline" : "default"}
                          className="h-8 px-3 text-xs font-semibold shrink-0 gap-1.5"
                          onClick={async () => {
                            const targetRef = item.ref || item.sessionId || 'Chullin 87a';
                            try {
                              if (item.sessionId) {
                                await api.createDailySessionLazy(item.sessionId);
                                navigate(`/daily/${item.sessionId}`);
                              } else {
                                navigate(`/study/${encodeURIComponent(targetRef)}`);
                              }
                            } catch {
                              if (item.sessionId) {
                                navigate(`/daily/${item.sessionId}`);
                              } else {
                                navigate(`/study/${encodeURIComponent(targetRef)}`);
                              }
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

              {filteredDailyItems.length > 4 && (
                <div className="text-center pt-2 border-t border-border/20 mt-3">
                  <button
                    type="button"
                    onClick={() => setIsAllDailyExpanded(!isAllDailyExpanded)}
                    className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isAllDailyExpanded ? 'Свернуть' : `Показать все уроки (${filteredDailyItems.length})`}
                    <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isAllDailyExpanded && "rotate-180")} />
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Zmanim Widget (1 Col) */}
          <Card className="shadow-sm border-border flex flex-col justify-between">
            <CardHeader className="pb-4">
              <CardTitle className="font-serif text-xl font-semibold flex items-center gap-2.5">
                <Clock className="w-5 h-5 text-primary" />
                Зманим
              </CardTitle>
              <CardDescription>
                Галахическое время для <span className="font-semibold text-foreground">{zmanimLocationName}</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between">
              <div className="divide-y divide-border/60">
                {zmanimList.map((z, idx) => (
                  <div key={idx} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                    <div className="min-w-0 pr-3">
                      <span className="text-sm font-medium text-foreground block truncate">{z.label}</span>
                      <span className="text-xs text-muted-foreground">{z.desc}</span>
                    </div>
                    <span className="font-mono font-semibold text-sm text-primary tabular-nums shrink-0">{z.time}</span>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                size="sm"
                className="w-full justify-between mt-5 font-semibold text-xs"
                onClick={() => navigate('/clock')}
              >
                <span className="flex items-center gap-2">
                  <Compass className="w-4 h-4 text-primary" />
                  Открыть астро-карту
                </span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>

        </div>

        {/* Modules & Tools Grid */}
        <div className="space-y-4">
          <h2 className="font-serif text-2xl font-semibold tracking-tight">
            Модули и инструменты
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {modules.map((mod) => {
              const Icon = mod.icon;
              return (
                <div
                  key={mod.id}
                  onClick={() => navigate(mod.path)}
                  className="group relative rounded-xl border border-border p-5 bg-card hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-5"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {mod.badge}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-serif font-semibold text-base group-hover:text-primary transition-colors">{mod.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed mt-1">{mod.subtitle}</p>
                    </div>
                  </div>

                  <div className="flex items-center text-xs font-semibold text-primary gap-1 pt-3 border-t border-border/40">
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
          <CardHeader className="pb-4">
            <CardTitle className="font-serif text-xl font-semibold flex items-center gap-2.5">
              <History className="w-5 h-5 text-primary" />
              Последние сессии
            </CardTitle>
            <CardDescription>Быстрое возобновление незавершённых сессий</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingChats ? (
              <div className="py-6 text-center text-sm text-muted-foreground">Загрузка сессий…</div>
            ) : recentChats.length > 0 ? (
              <div className="divide-y divide-border">
                {recentChats.map((chat) => (
                  <div
                    key={chat.session_id}
                    onClick={() => navigate(`/study/${chat.session_id}`)}
                    className="py-3.5 flex items-center justify-between hover:bg-muted/30 px-3 -mx-3 rounded-lg transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-md bg-muted text-muted-foreground shrink-0">
                        <BookOpen className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium font-serif text-foreground truncate">{chat.display_value || chat.name || chat.session_id}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(chat.last_modified).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost" className="gap-1 text-xs shrink-0">
                      <span>Продолжить</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-10 text-center text-sm text-muted-foreground">
                <p>История сессий пуста. Начните своё первое изучение.</p>
                <Button size="sm" className="mt-4" onClick={() => navigate('/study')}>
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
