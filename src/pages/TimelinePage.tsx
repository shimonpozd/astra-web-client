import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, RefreshCw, Maximize2, Minimize2, Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TopBar from '@/components/layout/TopBar';
import { TimelineCanvas } from '@/components/timeline/TimelineCanvas';
import { FilterPanel } from '@/components/timeline/FilterPanel';
import { Legend } from '@/components/timeline/Legend';
import { PersonModal } from '@/components/timeline/PersonModal';
import { fetchTimelineData } from '@/services/timeline';
import { PERIODS } from '@/data/periods';
import { REGIONS } from '@/data/regions';
import { SAMPLE_TIMELINE_PEOPLE } from '@/data/timelineSample';
import { useTimelineFilters } from '@/hooks/useTimelineFilters';
import { deriveLifespanRange } from '@/utils/dataParser';
import { getTimelineBounds } from '@/utils/dateCalculations';
import { Button } from '@/components/ui/button';
import type { Period, TimelinePerson, TimelineApiResponse } from '@/types/timeline';

type Mode = 'research' | 'explore';

function applyFilters(people: TimelinePerson[], filters: ReturnType<typeof useTimelineFilters>['filters']) {
  const query = filters.searchQuery.trim().toLowerCase();
  return people.filter((person) => {
    if (filters.periods.size && !filters.periods.has(person.period)) return false;
    if (filters.regions.size && person.region && !filters.regions.has(person.region)) return false;
    if (filters.generations.size && person.generation !== undefined && !filters.generations.has(person.generation)) {
      return false;
    }
    if (filters.dateRange) {
      const range = deriveLifespanRange(person);
      if (range) {
        if (range.end < filters.dateRange[0] || range.start > filters.dateRange[1]) return false;
      }
      // если у персоны нет дат — не фильтруем по дате, чтобы не терять карточки без lifespan
    }
    if (query) {
      const haystack = `${person.name_en} ${person.name_ru ?? ''} ${person.name_he}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function StatsCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/70 p-4 shadow-sm">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold leading-tight">{value}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

export default function TimelinePage() {
  const [data, setData] = useState<TimelineApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.4);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>('research');
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [bottomOpen, setBottomOpen] = useState(false);
  const [toolbarOpen, setToolbarOpen] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [searchOverlayOpen, setSearchOverlayOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const initialized = useRef(false);
  const fullscreenRef = useRef<HTMLDivElement | null>(null);

  const {
    filters,
    togglePeriod,
    toggleRegion,
    toggleGeneration,
    setSearchQuery,
    setDateRange,
    reset,
    setAllPeriods,
  } = useTimelineFilters(PERIODS.map((p) => p.id));

  const periods: Period[] = data?.periods ?? PERIODS;
  const people: TimelinePerson[] = data?.people ?? SAMPLE_TIMELINE_PEOPLE;

  const generations = useMemo(() => {
    const genSet = new Set<number>();
    people.forEach((p) => {
      if (p.generation !== undefined) genSet.add(p.generation);
    });
    periods.forEach((period) => {
      period.subPeriods?.forEach((sub) => {
        if (sub.generation !== undefined) genSet.add(sub.generation);
      });
    });
    return Array.from(genSet).sort((a, b) => a - b);
  }, [people, periods]);

  const filteredPeople = useMemo(() => applyFilters(people, filters), [people, filters]);

  const periodMin = useMemo(() => Math.min(...periods.map((p) => p.startYear)), [periods]);
  const periodMax = useMemo(() => Math.max(...periods.map((p) => p.endYear)), [periods]);
  const timelineMinYear = periodMin;
  const timelineMaxYear = periodMax;

  const filtersKey = useMemo(
    () =>
      JSON.stringify({
        periods: Array.from(filters.periods).sort(),
        regions: Array.from(filters.regions).sort(),
        generations: Array.from(filters.generations).sort(),
        searchQuery: filters.searchQuery,
        dateRange: filters.dateRange,
      }),
    [filters],
  );

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    fetchTimelineData(filters, controller.signal)
      .then((payload) => {
        setData(payload);
        setError(null);
      })
      .catch((err: Error) => {
        setError(err.message);
      })
      .finally(() => setIsLoading(false));

    return () => controller.abort();
  }, [filters, filtersKey]);

  useEffect(() => {
    if (!data || initialized.current) return;
    const { minYear: min, maxYear: max } = getTimelineBounds(data.people, data.periods, 20);
    setAllPeriods(data.periods.map((p) => p.id));
    setDateRange([min, max]);
    initialized.current = true;
  }, [data, setAllPeriods, setDateRange]);

  const selectedPerson = useMemo(
    () => filteredPeople.find((p) => p.slug === selectedSlug) ?? null,
    [filteredPeople, selectedSlug],
  );

  const handleReload = () => {
    setIsLoading(true);
    setError(null);
    fetchTimelineData(filters)
      .then((payload) => setData(payload))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  };

  const toggleFullscreen = () => {
    const node = fullscreenRef.current;
    if (!node) return;
    if (!document.fullscreenElement) {
      node.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => setIsFullscreen(false));
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => setIsFullscreen(false));
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  useEffect(() => {
    if (mode === 'research') {
      setLeftOpen(false);
      setRightOpen(false);
      setBottomOpen(false);
      setToolbarOpen(true);
    } else if (mode === 'explore') {
      setLeftOpen(true);
      setRightOpen(true);
      setBottomOpen(true);
      setToolbarOpen(true);
    }
  }, [mode]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'F11') return;
      if (e.metaKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOverlayOpen(true);
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        setSearchOverlayOpen(true);
      }
      if (e.key === 'Escape') {
        setLeftOpen(false);
        setRightOpen(false);
        setBottomOpen(false);
        setSearchOverlayOpen(false);
      }
      if (e.key.toLowerCase() === 'f') setLeftOpen((v) => !v);
      if (e.key.toLowerCase() === 'l') setRightOpen((v) => !v);
      if (e.key.toLowerCase() === 'b') setBottomOpen((v) => !v);
      if (e.key.toLowerCase() === 't') setToolbarOpen((v) => !v);
      if (e.key === '1') setMode('research');
      if (e.key === '2') setMode('explore');
      if (e.key.toLowerCase() === 's') {
        // placeholder for save view
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      <TopBar />
      <main className="flex-1 relative overflow-hidden">
        <div ref={fullscreenRef} className="absolute inset-0">
          {/* Top floating toolbar */}
          {toolbarOpen && (
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="absolute top-3 left-1/2 -translate-x-1/2 z-40 bg-card/90 backdrop-blur-md border border-border/70 rounded-xl shadow-lg px-3 py-2 flex items-center gap-2"
            >
              <div className="flex items-center gap-1">
                {(['research', 'explore'] as Mode[]).map((m, idx) => (
                  <Button
                    key={m}
                    variant={mode === m ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setMode(m)}
                    className="text-xs capitalize"
                  >
                    {idx + 1}. {m}
                  </Button>
                ))}
              </div>
              <div className="h-6 w-px bg-border mx-2" />
              <Button variant="outline" size="sm" onClick={handleReload} disabled={isLoading} className="text-xs">
                <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                Обновить
              </Button>
              <Button variant="outline" size="sm" onClick={() => setLeftOpen((v) => !v)} className="text-xs">
                F: Фильтры
              </Button>
              <Button variant="outline" size="sm" onClick={() => setRightOpen((v) => !v)} className="text-xs">
                L: Легенда
              </Button>
              <Button variant="outline" size="sm" onClick={() => setBottomOpen((v) => !v)} className="text-xs">
                B: Поиск/Миникарта
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSearchOverlayOpen(true)} className="text-xs">
                <Search className="w-4 h-4 mr-1" />
                Cmd/Ctrl+K
              </Button>
              <Button variant="outline" size="sm" onClick={toggleFullscreen} className="text-xs">
                {isFullscreen ? <Minimize2 className="w-4 h-4 mr-1" /> : <Maximize2 className="w-4 h-4 mr-1" />}
                FS
              </Button>
              <div className="text-xs text-muted-foreground ml-2">Зум: {zoom.toFixed(1)}x</div>
            </motion.div>
          )}

          <div className="absolute inset-0 pt-14">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Загружаем таймлайн...
                </div>
              </div>
            ) : error ? (
              <div className="m-4 p-4 rounded-xl border border-destructive/40 bg-destructive/5 text-destructive">
                Не удалось загрузить данные: {error}
              </div>
            ) : (
              <TimelineCanvas
                people={filteredPeople}
                periods={periods}
                minYear={timelineMinYear}
                maxYear={timelineMaxYear}
                zoom={zoom}
                onZoomChange={setZoom}
                selectedPersonSlug={selectedSlug}
                onPersonSelect={(p) => setSelectedSlug(p.slug)}
              />
            )}
          </div>

          {/* Left panel */}
          <AnimatePresence>
            {leftOpen && (
              <motion.div
                initial={{ x: -320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -320, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                className="absolute left-3 top-16 bottom-16 w-80 z-30 bg-card/95 backdrop-blur-md border border-border/70 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="p-3 border-b border-border/60 flex items-center justify-between">
                  <div className="text-sm font-semibold">Фильтры</div>
                  <Button variant="ghost" size="sm" onClick={() => setLeftOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="overflow-y-auto h-full p-3">
                  <FilterPanel
                    periods={periods}
                    regions={REGIONS}
                    generations={generations}
                    filters={filters}
                    onTogglePeriod={togglePeriod}
                    onToggleRegion={toggleRegion}
                    onToggleGeneration={toggleGeneration}
                    onSearch={setSearchQuery}
                    onDateRangeChange={setDateRange}
                    onReset={reset}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Right panel */}
          <AnimatePresence>
            {rightOpen && (
              <motion.div
                initial={{ x: 320, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: 320, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                className="absolute right-3 top-16 bottom-16 w-80 z-30 bg-card/95 backdrop-blur-md border border-border/70 rounded-xl shadow-2xl overflow-hidden"
              >
                <div className="p-3 border-b border-border/60 flex items-center justify-between">
                  <div className="text-sm font-semibold">Легенда и статистика</div>
                  <Button variant="ghost" size="sm" onClick={() => setRightOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-3 space-y-3 overflow-y-auto h-full">
                  <div className="grid grid-cols-2 gap-2">
                    <StatsCard label="Персон" value={stats.total} />
                    <StatsCard label="Диапазон" value={`${minYear} – ${maxYear}`} />
                  </div>
                      <Legend
                        periods={periods}
                        activePeriods={filters.periods}
                        onToggle={togglePeriod}
                        onFocusPeriod={undefined}
                        counts={stats.byPeriod}
                      />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom panel */}
          <AnimatePresence>
            {bottomOpen && (
              <motion.div
                initial={{ y: 200, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 200, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 220, damping: 24 }}
                className="absolute left-3 right-3 bottom-3 z-30 bg-card/95 backdrop-blur-md border border-border/70 rounded-xl shadow-2xl"
              >
                <div className="p-3 border-b border-border/60 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Search className="w-4 h-4" /> Быстрый переход по году
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setBottomOpen(false)}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                <div className="p-3 flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Например: 1200 или XIII"
                      className="w-full h-10 rounded-lg border border-border px-3 bg-background text-sm"
                    />
                    <Button size="sm" disabled>
                      Перейти
                    </Button>
                  </div>
                  <div className="h-16 w-full rounded-lg border border-dashed border-border/70 flex items-center justify-center text-xs text-muted-foreground">
                    Миникарта (скоро): обзор всего таймлайна и текущего окна
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Global search overlay */}
          <AnimatePresence>
            {searchOverlayOpen && (
              <motion.div
                className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-start justify-center pt-24"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSearchOverlayOpen(false)}
              >
                <motion.div
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.98, opacity: 0 }}
                  className="w-full max-w-2xl rounded-xl bg-card p-4 shadow-2xl border border-border/70"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-muted-foreground" />
                    <input
                      autoFocus
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Введите год, век или имя: 1200, XIII, Rambam..."
                      className="flex-1 bg-transparent outline-none text-sm"
                    />
                    <Button size="sm" variant="secondary" disabled>
                      Перейти
                    </Button>
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground">Cmd/Ctrl+K для быстрого вызова. История и подсказки будут добавлены.</div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <PersonModal
        slug={selectedSlug}
        open={Boolean(selectedSlug)}
        onClose={() => setSelectedSlug(null)}
        fallbackPerson={selectedPerson}
      />
    </div>
  );
}
