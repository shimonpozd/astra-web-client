import { useEffect, useMemo, useState } from 'react';
import { api, DailyProgressDay, DailyProgressResponse, XpEvent, Achievement, DailyProgressEntry } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Trophy, ChevronLeft, ChevronRight, Sparkles, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { useGamification } from '../contexts/GamificationContext';

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
  'Танья йоми',
  'Йерушалми йоми',
];

const achievementLabels: Record<string, { title: string; emoji: string; description: string }> = {
  discipline: {
    title: 'Дисциплина',
    emoji: '📅',
    description: 'Регулярность daily и серия',
  },
  lexicon: {
    title: 'Лексикон',
    emoji: '🔍',
    description: 'Работа со словами и карточками',
  },
  rambam: {
    title: 'Рамбам',
    emoji: '📘',
    description: 'Изучение Рамбама (halachot/главы)',
  },
  daf: {
    title: 'Талмуд (Даф Йоми)',
    emoji: '📖',
    description: 'Изученные дафы',
  },
};

const levelNames: Record<string, string> = {
  none: 'Нет уровня',
  bronze: 'Бронза',
  silver: 'Серебро',
  gold: 'Золото',
  platinum: 'Алмаз',
};

const badgeMap: Record<string, Record<string, string>> = {
  discipline: {
    bronze: '/images/badge_0000.png',
    silver: '/images/badge_0001.png',
    gold: '/images/badge_0002.png',
    platinum: '/images/badge_0003.png',
  },
  lexicon: {
    bronze: '/images/badge_0004.png',
    silver: '/images/badge_0005.png',
    gold: '/images/badge_0006.png',
    platinum: '/images/badge_0007.png',
  },
  rambam: {
    bronze: '/images/badge_0008.png',
    silver: '/images/badge_0009.png',
    gold: '/images/badge_0010.png',
    platinum: '/images/badge_0011.png',
  },
  daf: {
    bronze: '/images/badge_0012.png',
    silver: '/images/badge_0013.png',
    gold: '/images/badge_0014.png',
    platinum: '/images/badge_0015.png',
  },
};

const thresholds: Record<string, number[]> = {
  discipline: [7, 30, 100, 365],
  lexicon: [10, 50, 150, 500],
  rambam: [10, 40, 120, 300],
  daf: [7, 30, 100, 365],
};

const CATEGORY_TRANSLATIONS: Record<string, string> = {
  'daf yomi': 'Даф йоми',
  'daf yomit': 'Даф йоми',
  'daf': 'Даф йоми',
  'daily rambam': 'Рамбам',
  'rambam': 'Рамбам',
  'mishneh torah': 'Рамбам',
  'rambam (3 chapters)': 'Рамбам',
  'daily mishnah': 'Мишна йомит',
  'mishnah yomit': 'Мишна йомит',
  'tanya yomit': 'Танья йоми',
  'yerushalmi yomit': 'Йерушалми йоми',
  'daf yomi weekly': 'Даф за неделю',
  'daf a week': 'Даф за неделю',
  'haftarah': 'Афтара',
  'parashat hashavua': 'Недельная глава',
};

function normalizeCategory(label?: string | null): string | null {
  if (!label) return null;
  const lower = label.trim().toLowerCase();
  const translated = CATEGORY_TRANSLATIONS[lower];
  if (translated) return translated;
  return label;
}

function inferCategory(entry: DailyProgressEntry): string | null {
  const label = normalizeCategory(entry.category_label || entry.category);
  if (label) return label;
  const ref = (entry.ref || entry.title || '').toLowerCase();
  if (!ref) return null;
  if (ref.includes('mishnah')) return 'Мишна йомит';
  if (ref.includes('mishneh torah') || ref.includes('rambam')) return 'Рамбам';
  if (ref.includes('daf')) return 'Даф йоми';
  if (ref.includes('talmud')) return 'Даф йоми';
  return null;
}

function deriveCategories(history: DailyProgressDay[]): string[] {
  const set = new Set<string>();
  history.forEach((day) => {
    (day.entries || []).forEach((entry) => {
      const label = normalizeCategory(entry.category_label || entry.category) || inferCategory(entry);
      if (label) set.add(label);
    });
  });
  const list = Array.from(set).sort();
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
  const hitEntry = entries.some((e) => {
    const label = normalizeCategory(e.category_label || e.category) || inferCategory(e);
    return label?.toLowerCase() === category.toLowerCase();
  });
  if (hitEntry) return true;

  const hasAnyCategory = entries.some((e) => !!normalizeCategory(e.category_label || e.category));

  // fallback: если день отмечен, но нет или не хватает категорий — подсветим ключевые daily категории
  if (day.completed && (!entries.length || !hasAnyCategory)) {
    const key = category.toLowerCase();
    return (
      key.includes('даф') ||
      key.includes('йоми') ||
      key.includes('rambam') ||
      key.includes('рамбам') ||
      key.includes('мишн') ||
      key.includes('mishn')
    );
  }
  return false;
}

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ProfileProgress() {
  const [progress, setProgress] = useState<DailyProgressResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewDate, setViewDate] = useState(() => new Date());
  const [xpHistory, setXpHistory] = useState<XpEvent[]>([]);
  const [isXpLoading, setIsXpLoading] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [isAchievementsLoading, setIsAchievementsLoading] = useState(false);
  const navigate = useNavigate();
  const { xpTotal, level, xpIntoLevel, xpForLevel, xpToNext, recent, levelUps, formatXp } = useGamification();

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
    const base = categoryLegend.length ? categoryLegend : DEFAULT_CATEGORIES_RU;
    const merged = new Set<string>([...DEFAULT_CATEGORIES_RU, ...base]);
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

  const xpRecent = recent.slice(0, 6);
  const levelUpsRecent = levelUps.slice(0, 3);
  const achievementsByCat = useMemo(() => {
    const map = new Map<string, Achievement>();
    achievements.forEach((a) => map.set(a.category, a));
    return map;
  }, [achievements]);

  useEffect(() => {
    const loadXpHistory = async () => {
      try {
        setIsXpLoading(true);
        const data = await api.getXpHistory(20);
        setXpHistory(data);
      } catch {
        setXpHistory([]);
      } finally {
        setIsXpLoading(false);
      }
    };
    loadXpHistory();
    const loadAchievements = async () => {
      try {
        setIsAchievementsLoading(true);
        const data = await api.getAchievements();
        setAchievements(data);
      } catch {
        setAchievements([]);
      } finally {
        setIsAchievementsLoading(false);
      }
    };
    loadAchievements();
  }, []);

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

              <motion.div
                whileHover={{ y: -2 }}
                className="p-6 rounded-xl bg-gradient-to-br from-primary/5 via-card to-card border-2 border-primary/30 shadow-md text-center"
              >
                <div className="text-2xl mb-1 flex items-center justify-center gap-2 text-primary">
                  ⚡ <span className="text-lg text-foreground">Уровень {level}</span>
                </div>
                <div className="text-xl font-semibold text-foreground">
                  {formatXp(xpTotal)} XP
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  До след. уровня: {formatXp(xpToNext)}
                </div>
                <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary via-amber-400 to-orange-500"
                    style={{ width: `${Math.max(6, Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100 || 0)))}%` }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {formatXp(xpIntoLevel)} / {formatXp(xpForLevel)}
                </div>
              </motion.div>

              <motion.div
                whileHover={{ y: -2 }}
                className="p-6 rounded-xl bg-card/80 border-2 border-border/50 text-center"
              >
                <div className="text-2xl mb-2">🏆</div>
                <div className="text-lg font-semibold text-foreground">Level-ups</div>
                <div className="text-sm text-muted-foreground mt-2">
                  {levelUpsRecent.length ? `Последние: ${levelUpsRecent.map((l) => l.level).join(', ')}` : 'Ещё не было'}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

      {/* XP Session Events */}
      <div className="rounded-2xl border border-border/50 bg-card/80 shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">XP за текущую сессию</h2>
            <p className="text-sm text-muted-foreground">Локальные начисления за время этого запуска</p>
          </div>
          <div className="text-sm text-muted-foreground">
            {formatXp(xpTotal)} XP · уровень {level}
          </div>
        </div>
        {xpRecent.length === 0 ? (
          <div className="text-sm text-muted-foreground">Пока нет начислений.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {xpRecent.map((item) => (
              <div key={item.at} className="p-3 rounded-lg border border-border/40 bg-card/70 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">+{item.amount} XP</span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {item.source}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.label || item.verb || 'Событие'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* XP History from backend */}
      <div className="rounded-2xl border border-border/50 bg-card/80 shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">История XP (бэкенд)</h2>
            <p className="text-sm text-muted-foreground">Последние события, сохранённые на сервере</p>
          </div>
          {isXpLoading && <span className="text-xs text-muted-foreground">Загрузка…</span>}
        </div>
        {xpHistory.length === 0 ? (
          <div className="text-sm text-muted-foreground">Пока нет записей.</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {xpHistory.map((item, idx) => (
              <div key={`${item.ts ?? idx}-${idx}`} className="p-3 rounded-lg border border-border/40 bg-card/70 flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">+{item.amount} XP</span>
                  <span className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                    {item.source}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.title || item.ref || item.verb || 'Событие'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Achievements */}
      <div className="rounded-2xl border border-border/50 bg-card/80 shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Достижения</h2>
            <p className="text-sm text-muted-foreground">4 направления × 4 уровня (Бронза → Серебро → Золото → Алмаз).</p>
          </div>
          {isAchievementsLoading && <span className="text-xs text-muted-foreground">Загрузка…</span>}
        </div>
        <div className="overflow-auto">
          <table className="min-w-full text-sm border border-border/60 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-muted/50">
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Категория</th>
                {['bronze', 'silver', 'gold', 'platinum'].map((lvl) => (
                  <th key={lvl} className="px-3 py-2 text-center text-xs font-semibold text-muted-foreground">
                    {levelNames[lvl]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(achievementLabels).map(([cat, meta]) => {
                const data = achievementsByCat.get(cat) || { level: 'none', value: 0, to_next: null };
                const currentIdx = ['none', 'bronze', 'silver', 'gold', 'platinum'].indexOf(data.level);
                return (
                  <tr key={cat} className="border-t border-border/40">
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{meta.emoji}</span>
                        <div>
                          <div className="font-semibold">{meta.title}</div>
                          <div className="text-xs text-muted-foreground">{meta.description}</div>
                        </div>
                      </div>
                    </td>
                    {['bronze', 'silver', 'gold', 'platinum'].map((lvl, idx) => {
                      const unlocked = idx + 1 <= currentIdx; // currentIdx includes 'none' at 0
                      const img = badgeMap[cat]?.[lvl] || '/images/badge_0000.png';
                      const req = (thresholds[cat] || [])[idx];
                      const remaining = req != null ? Math.max(0, req - (data.value ?? 0)) : null;
                  return (
                    <td key={lvl} className="px-2 py-2 text-center">
                      <div className="w-16 h-16 mx-auto rounded-lg border border-border/60 bg-card/70 overflow-hidden flex items-center justify-center">
                        <img
                          src={img}
                              alt={`${meta.title} ${levelNames[lvl]}`}
                              className={`w-full h-full object-cover ${unlocked ? '' : 'grayscale opacity-40'}`}
                            />
                      </div>
                      <div className="mt-1 text-[11px] text-muted-foreground leading-tight">
                        {req != null ? `Порог: ${req}` : ''}
                        {req != null
                          ? unlocked
                            ? ' · Получено'
                            : ` · Осталось: ${remaining}`
                          : ''}
                      </div>
                      {req != null && (
                        <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full ${unlocked ? 'bg-gradient-to-r from-primary via-amber-400 to-orange-500' : 'bg-muted-foreground/30'}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, ((data.value ?? 0) / req) * 100))}%`,
                            }}
                          />
                        </div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
              })}
            </tbody>
          </table>
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
                    const hit = checkIfCategoryCompleted(day, cat);
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
