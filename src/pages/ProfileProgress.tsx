import { useEffect, useMemo, useState } from 'react';
import { api, DailyProgressDay, DailyProgressResponse } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Trophy, ChevronLeft, ChevronRight, Sparkles, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';

const DEFAULT_CATEGORIES_RU = [
  'Недельная глава',
  'Афтара',
  'Даф йоми',
  'Мишна йомит',
  'Рамбам',
  'Рамбам (3 главы)',
  'Даф за неделю',
  'Галаха йомит',
  'Арух а-Шульхан',
  'Танах йоми',
  '929',
  'Хок ле-Исраэль',
  'Танья йоми',
  'Йерушалми йоми',
  'Все уроки',
];

function deriveCategories(history: DailyProgressDay[]): string[] {
  const set = new Set<string>();
  history.forEach((day) => {
    (day.entries || []).forEach((entry) => {
      const label = entry.category_label || entry.category;
      if (label) set.add(label);
    });
  });
  const list = Array.from(set).sort();
  const hasAnyCompletion = history.some((d) => d.completed);
  if (!list.length && hasAnyCompletion) {
    return ['Все уроки'];
  }
  return list;
}

function daysOfMonth(viewDate: Date): string[] {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const start = new Date(Date.UTC(year, month, 1));
  const days: string[] = [];
  while (start.getUTCMonth() === month) {
    days.push(start.toISOString().slice(0, 10));
    start.setUTCDate(start.getUTCDate() + 1);
  }
  return days;
}

function formatMonth(viewDate: Date): string {
  return viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
}

function getDaysWord(count: number): string {
  const lastDigit = count % 10;
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 'дней';
  if (lastDigit === 1) return 'день';
  if (lastDigit >= 2 && lastDigit <= 4) return 'дня';
  return 'дней';
}

function formatDateRelative(dateStr: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (dateStr === today) return 'Сегодня';
  if (dateStr === yesterday) return 'Вчера';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
}

function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'Недельная глава': '📖',
    'Афтара': '📜',
    'Даф йоми': '📚',
    'Мишна йомит': '✡️',
    'Рамбам': '🕎',
    'Рамбам (3 главы)': '🕎',
    'Даф за неделю': '🗓️',
    'Галаха йомит': '📜',
    'Арух а-Шульхан': '📜',
    'Танах йоми': '📖',
    '929': '🔢',
    'Хок ле-Исраэль': '🕯️',
    'Танья йоми': '🧠',
    'Йерушалми йоми': '📘',
    'Все уроки': '📝',
  };
  return icons[category] || '📝';
}

function checkIfCategoryCompleted(day: DailyProgressDay | undefined, category: string): boolean {
  if (!day) return false;
  const entries = day.entries || [];
  const hasExplicit = entries.some((e) => {
    const label = (e.category_label || e.category || '').toLowerCase();
    return label === category.toLowerCase();
  });
  if (!entries.length && day.completed) return true;
  if (category.toLowerCase() === 'все уроки' && day.completed) return true;
  if (category.toLowerCase() === 'все уроки' && (day.completed || entries.length > 0)) return true;
  return hasExplicit;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProfileProgress() {
  const [progress, setProgress] = useState<DailyProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const data = await api.getDailyProgress(186);
        setProgress(data);
        const latestDate = data.history?.[0]?.date;
        if (latestDate) {
          const parts = latestDate.split('-').map(Number);
          if (parts.length === 3) {
            setViewDate(new Date(parts[0], parts[1] - 1, 1));
          }
        }
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const categoryLegend = useMemo(() => (progress ? deriveCategories(progress.history) : []), [progress]);
  const effectiveCategories = useMemo(() => {
    const base = categoryLegend.length ? categoryLegend : ['Все уроки'];
    const merged = new Set<string>(['Все уроки', ...DEFAULT_CATEGORIES_RU, ...base]);
    return Array.from(merged);
  }, [categoryLegend]);
  const monthDays = useMemo(() => daysOfMonth(viewDate), [viewDate]);
  const historyByDate = useMemo(() => {
    const map = new Map<string, DailyProgressDay>();
    progress?.history.forEach((day) => map.set(day.date, day));
    return map;
  }, [progress]);
  const totalEntries = useMemo(() => {
    if (!progress) return 0;
    return progress.history.reduce((acc, day) => acc + (day.entries?.length || 0), 0);
  }, [progress]);
  const todayString = getTodayString();

  return (
    <motion.div
      className="min-h-screen bg-background text-foreground"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-10">
        <div className="flex items-center justify-between gap-4">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Назад
          </button>
        </div>

        {/* Metrics Panel */}
        <div className="rounded-2xl border border-border/50 bg-card/60 shadow-lg p-6">
          <div className="grid lg:grid-cols-4 gap-6 items-center">
            <div className="lg:col-span-4 flex flex-col items-center text-center py-4">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Flame className="w-12 h-12 text-amber-500 mx-auto mb-2" />
              </motion.div>
              <div className="text-sm uppercase tracking-wider text-muted-foreground mb-2">
                Текущая серия
              </div>
              <div className="text-6xl font-bold bg-gradient-to-r from-amber-500 to-orange-600 bg-clip-text text-transparent leading-none">
                {progress?.streak.current ?? 0}
              </div>
              <div className="text-lg text-muted-foreground mt-1">
                {getDaysWord(progress?.streak.current ?? 0)}
              </div>
            </div>

            <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
              <motion.div
                whileHover={{ y: -2 }}
                className="p-6 rounded-xl bg-card border-2 border-border/50 shadow-md text-center"
              >
                <Trophy className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                <div className="text-3xl font-bold">{progress?.streak.best ?? 0}</div>
                <div className="text-sm text-muted-foreground mt-1">Лучшая серия</div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="p-6 rounded-xl bg-card border-2 border-border/50 shadow-md text-center"
              >
                <Sparkles className="w-8 h-8 text-sky-500 mx-auto mb-2" />
                <div className="text-3xl font-bold">{totalEntries}</div>
                <div className="text-sm text-muted-foreground mt-1">Всего уроков</div>
              </motion.div>

              <div className="p-6 rounded-xl bg-card/50 border-2 border-dashed border-border/50 text-center opacity-60">
                <div className="text-2xl mb-2">⚡</div>
                <div className="text-lg font-semibold text-muted-foreground">Уровень</div>
                <div className="text-sm text-muted-foreground mt-2">Скоро</div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-purple-500 w-0" />
                </div>
              </div>

              <div className="p-6 rounded-xl bg-card/50 border-2 border-dashed border-border/50 text-center opacity-60">
                <div className="text-2xl mb-2">🏆</div>
                <div className="text-lg font-semibold text-muted-foreground">Достижения</div>
                <div className="text-sm text-muted-foreground mt-2">В разработке</div>
              </div>
            </div>
          </div>
        </div>

        {/* Calendar */}
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Календарь прогресса</h2>
              <p className="text-sm text-muted-foreground">
                Вертикально — уроки, горизонтально — дни месяца. Сделал/не сделал.
              </p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border/60 hover:bg-muted/60 transition-colors"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                aria-label="Предыдущий месяц"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="text-lg font-semibold min-w-[140px] text-center capitalize">{formatMonth(viewDate)}</div>
              <button
                className="h-9 w-9 inline-flex items-center justify-center rounded-md border border-border/60 hover:bg-muted/60 transition-colors"
                onClick={() => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                aria-label="Следующий месяц"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                className="h-9 px-3 inline-flex items-center justify-center rounded-md border border-border/60 hover:bg-muted/60 transition-colors text-sm"
                onClick={() => setViewDate(new Date())}
              >
                Сегодня
              </button>
              {isLoading && <span className="text-xs text-muted-foreground">Загрузка…</span>}
            </div>
          </div>

          <div className="overflow-auto">
            <div className="inline-block min-w-full">
              <div className="grid gap-2 items-center sticky top-0 bg-background z-10 pb-3" style={{ gridTemplateColumns: `180px repeat(${monthDays.length}, 20px)` }}>
                <div className="text-xs font-medium text-muted-foreground pr-2">Урок</div>
                {monthDays.map((d) => {
                  const dayNum = d.slice(-2);
                  const isToday = d === todayString;
                  return (
                    <div
                      key={d}
                      className={cn(
                        'text-xs text-center rounded-full w-7 h-7 flex items-center justify-center mx-auto',
                        isToday ? 'font-bold text-primary bg-primary/10' : 'text-muted-foreground'
                      )}
                    >
                      {dayNum}
                    </div>
                  );
                })}
              </div>

              {!progress?.history?.length && (
                <div className="text-sm text-muted-foreground py-6">
                  Пока нет отметок. Отметьте ежедневный урок, чтобы увидеть прогресс.
                </div>
              )}

              {effectiveCategories.map((cat) => (
                <div key={cat} className="grid gap-2 items-center mb-2" style={{ gridTemplateColumns: `180px repeat(${monthDays.length}, 20px)` }}>
                  <div className="text-sm font-medium truncate pr-2 inline-flex items-center gap-2">
                    <span>{getCategoryIcon(cat)}</span>
                    <span className="truncate">{cat}</span>
                  </div>
                  {monthDays.map((d) => {
                    const day = historyByDate.get(d);
                    const dayEntries = day?.entries || [];
                    const dayCompleted = day?.completed;
                    const hitExplicit = dayEntries.some((e) => {
                      const label = (e.category_label || e.category || '').toLowerCase();
                      return label === cat.toLowerCase();
                    });
                    const hitFallback =
                      (!dayEntries.length && dayCompleted) ||
                      (cat.toLowerCase() === 'все уроки' && (dayCompleted || dayEntries.length > 0));
                    const hit = hitExplicit || hitFallback;
                    return (
                      <motion.div key={d} whileHover={{ scale: 1.15 }} className="relative group">
                        <div
                          className={cn(
                            'w-5 h-5 rounded-md transition-all duration-200',
                            hit ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-sm' : 'bg-muted opacity-20'
                          )}
                        />
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                          <div className="bg-popover text-popover-foreground px-3 py-2 rounded-lg shadow-lg text-sm border border-border whitespace-nowrap">
                            <div className="font-semibold">{d}</div>
                            <div className="text-muted-foreground text-xs">{cat}</div>
                            {hit ? (
                              <div className="text-emerald-500 text-xs mt-1 flex items-center gap-1">
                                <Check className="w-3 h-3" /> Выполнено
                              </div>
                            ) : (
                              <div className="text-muted-foreground text-xs mt-1">Пропущено</div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-8 rounded-xl bg-card/50 border-2 border-dashed border-border/50 text-center">
          <div className="text-4xl mb-3">🏆</div>
          <h3 className="text-lg font-semibold mb-2">Достижения</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Система достижений находится в разработке
          </p>
          <div className="flex justify-center gap-3 opacity-40">
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="w-12 h-12 rounded-full bg-muted" />
            <div className="w-12 h-12 rounded-full bg-muted" />
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="text-xl font-bold tracking-tight flex items-center gap-2">
            📝 Последние отметки
          </h3>
          {!progress || progress.history.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📅</div>
              <p className="text-muted-foreground mb-4">
                Ещё нет отметок. Отметь первый урок, чтобы начать свой путь!
              </p>
              <button
                className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                onClick={() => navigate('/')}
              >
                Отметить урок сейчас
              </button>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {progress.history
                .slice(0, 8)
                .filter((d) => d.entries.length)
                .map((day) => (
                  <motion.div
                    key={day.date}
                    whileHover={{ y: -2 }}
                    className="rounded-xl border border-border/60 bg-card p-4 shadow-sm hover:shadow-md transition-all"
                  >
                    <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <span className="text-lg">📅</span>
                      {formatDateRelative(day.date)}
                    </div>
                    <ul className="space-y-2">
                      {day.entries.map((entry) => (
                        <li key={entry.session_id} className="text-sm flex items-start gap-2">
                          <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <span className="font-medium text-foreground">
                              {entry.title || entry.ref || 'Урок'}
                            </span>
                            {(entry.category_label || entry.category) && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({entry.category_label || entry.category})
                              </span>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </motion.div>
                ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
