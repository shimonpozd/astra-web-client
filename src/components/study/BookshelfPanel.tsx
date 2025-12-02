/* eslint-disable @typescript-eslint/no-unused-vars */
import { memo, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Search, BookOpen, Loader2, ArrowDownWideNarrow, ArrowDownNarrowWide, Plus, HelpCircle } from 'lucide-react';
import { BookshelfPanelProps } from '../../types/bookshelf';
import { api } from '../../services/api';
import ProfileInspectorModal from './ProfileInspectorModal';

// Помощник: извлечь человекочитаемое превью из старой (string) или новой ({he,en}) схемы.
// Правило: всегда приоритет he, затем en как fallback. Смотрим также на поля he/hebrew вне preview.
function coalescePreview(raw: any): { text: string | undefined; lang: 'he' | 'en' | undefined } {
  if (!raw) return { text: undefined, lang: undefined };

  const heDirect = typeof raw.he === 'string' ? raw.he.trim() : (typeof raw.hebrew === 'string' ? raw.hebrew.trim() : '');
  if (heDirect) return { text: heDirect, lang: 'he' };

  const val = raw.preview ?? raw.text ?? raw.snippet ?? raw.summary ?? raw.he;

  // Старый кейс: plain string (считаем как he для обратной совместимости)
  if (typeof val === 'string') {
    const s = val.trim();
    return s.length ? { text: s, lang: 'he' } : { text: undefined, lang: undefined };
  }

  // Новый кейс: объект {he?, en?} или вложенный {text:{he?,en?}}
  const obj = val?.text ? val.text : val;

  if (obj && typeof obj === 'object') {
    const he = typeof obj.he === 'string' ? obj.he.trim() : '';
    const en = typeof obj.en === 'string' ? obj.en.trim() : '';

    // всегда приоритет he
    if (he) return { text: he, lang: 'he' };
    // fallback на en
    if (en) return { text: en, lang: 'en' };
  }

  // Попробуем массивы (могут приходить текстовые версии)
  if (Array.isArray(val)) {
    const heFromArray = val.find((x) => typeof x === 'string' && x.trim().length > 0);
    if (heFromArray) return { text: heFromArray.trim(), lang: 'he' };
  }

  return { text: undefined, lang: undefined };
}

// Утилита: проверяет, есть ли английский перевод
function hasEnglish(raw: any): boolean {
  if (!raw) return false;
  if (raw.sourceHasEn === true) return true;
  const val = raw.preview ?? raw.text ?? raw.snippet ?? raw.summary;
  const obj = typeof val === 'string' ? null : (val?.text ? val.text : val);
  const en = obj?.en || (typeof val === 'object' ? val?.en : undefined);
  return typeof en === 'string' && en.trim().length > 0;
}

// Есть ли иврит (по тем же полям, что и coalescePreview)
function hasHebrew(raw: any): boolean {
  if (!raw) return false;
  if (typeof raw.he === 'string' && raw.he.trim()) return true;
  if (typeof raw.hebrew === 'string' && raw.hebrew.trim()) return true;
  const val = raw.preview ?? raw.text ?? raw.snippet ?? raw.summary;
  const obj = typeof val === 'string' ? { he: val } : (val?.text ? val.text : val);
  const he = obj?.he;
  return typeof he === 'string' && he.trim().length > 0;
}
// Возвращает текст и css-класс бейджа для языков (оставляем только EN-маркер)
function getLangBadge(raw: any): { text: string; className: string } | null {
  const en = hasEnglish(raw);
  if (en) return { text: 'EN', className: 'bookshelf-lang-badge' };
  return null;
}

interface Category {
  name: string;
  color: string;
}

type SortOrder = 'score' | 'compAsc' | 'compDesc';

function CategoryButtonBar({
  categories,
  selected,
  onSelect,
  getCount,
  accent = '#c2a970',
  showAll,
  onToggleShowAll,
}: {
  categories: { name: string; color?: string }[];
  selected: string | null;
  onSelect: (name: string) => void;
  getCount?: (name: string) => number;
  accent?: string;
  showAll?: boolean;
  onToggleShowAll?: (next: boolean) => void;
}) {
  const visible = showAll ? categories : categories.slice(0, PRIMARY_CATEGORY_ORDER.length);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {visible.map((c) => {
        const isActive = selected === c.name;
        const btnAccent = c.color || accent;
        const count = getCount ? getCount(c.name) : undefined;

        return (
          <button
            key={c.name}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(c.name)}
            className={`bookshelf-catbtn ${isActive ? 'is-active' : ''}`}
            style={{
              // мягкие рамки без «жёстких светлых линий»
              borderColor: isActive ? btnAccent : 'hsl(var(--border) / 0.28)',
              background: isActive
                ? `color-mix(in oklab, ${btnAccent} 16%, transparent)`
                : 'hsl(var(--panel))',
            }}
            title={c.name}
          >
            <span className="flex items-center gap-1 truncate">
              <span className="inline-block w-2 h-2 rounded-full" style={{ background: btnAccent }} />
              <span className="truncate">{CATEGORY_LOCALE[c.name] || c.name}</span>
            </span>
            {typeof count === 'number' && count > 0 && (
              <span className="bookshelf-catcount">{count}</span>
            )}
          </button>
        );
      })}
      {categories.length > PRIMARY_CATEGORY_ORDER.length && (
        <button
          type="button"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          onClick={() => onToggleShowAll?.(!showAll)}
        >
          {showAll ? 'Скрыть остальные' : 'Показать остальные'}
        </button>
      )}
    </div>
  );
}

export type GroupKey = string; // "Rashi on Shabbat 12a:2"

export type GroupNode = {
  key: GroupKey;
  parsed: Omit<ParsedRef, 'part'>; // без part
  color: string;                    // вычисляем из category|commentator
  items: any[];           // все части этой группы
};

interface BookshelfState {
  // Данные
  groups: GroupNode[];
  orphans: any[];
  sortOrder: SortOrder;

  // Фильтры и поиск
  searchQuery: string;
  activeFilters: {
    commentators: string[];
    tractates: string[];
    viewType: 'all' | 'groups' | 'parts';
  };

  // UI состояние
  draggedItem: string | null;
  hoveredGroup: string | null;
  previewVisible: string | null;
}

export type ParsedRef = {
  commentator: string;   // "Rashi"
  tractate: string;      // "Shabbat"
  page: string;          // "12a"
  section: string;       // "2"
  part?: string;         // "1"
};

const REF_RE = /^(.+?)\s+on\s+(.+?)\s+(\S+?):(\S+?)(?::(\S+))?$/;

export function parseRefStrict(ref: string): ParsedRef | null {
  const m = ref.match(REF_RE);
  if (!m) return null;
  const [, commentator, tractate, page, section, part] = m;
  const trimmedPart = part?.trim();
  // If part is "?" or empty, treat as no part
  const finalPart = (trimmedPart && trimmedPart !== '?') ? trimmedPart : undefined;
  return {
    commentator: commentator.trim(),
    tractate: tractate.trim(),
    page: page.trim(),
    section: section.trim(),
    part: finalPart,
  };
}


// Группировка по ref
export function groupByRef(items: any[]) {
  const groups = new Map<GroupKey, GroupNode>();
  const orphans: any[] = [];

  if (!Array.isArray(items) || items.length === 0) {
    return { groups: [], orphans: [] };
  }

  for (const it of items) {
    // 1) Берём ref из нескольких возможных мест (как у вас и было)
    const ref = it.ref || it.metadata?.ref || it.raw?.ref || '';

    // 2) Пытаемся НЕ выводить из строки, а взять точные поля из metadata
    const m = it.metadata || {};
    const commentator = m.commentator || null;
    const tractate    = m.tractate    || null;
    const page        = m.page        || null;
    const section     = m.section     || null;

    // Если метаданных достаточно — строим ключ напрямую
    if (commentator && tractate && page && section) {
      const key: GroupKey = `${commentator} on ${tractate} ${page}:${section}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          parsed: { commentator, tractate, page, section },
          color: '',
          items: [],
        });
      }
      groups.get(key)!.items.push(it);
      continue;
    }

    // 3) Иначе — пробуем старую строгую регулярку как запасной путь
    const p = parseRefStrict(ref);
    if (p) {
      const key: GroupKey = `${p.commentator} on ${p.tractate} ${p.page}:${p.section}`;
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          parsed: { commentator: p.commentator, tractate: p.tractate, page: p.page, section: p.section },
          color: '',
          items: [],
        });
      }
      groups.get(key)!.items.push(it);
      continue;
    }

    // 4) Совсем не распознали — в сироты (но всё равно показываем!)
    orphans.push(it);
  }

  return { groups: [...groups.values()], orphans };
}

// Натуральная сортировка внутри группы
function naturalPartValue(ref: string): { n?: number; s?: string } {
  const p = parseRefStrict(ref);
  if (!p?.part) return { s: '' };
  const n = Number(p.part);
  return Number.isFinite(n) ? { n } : { s: p.part };
}

type CompDateRange = { start?: number; end?: number };

const PERIODS: { label: string; from: number; to: number; color: string }[] = [
  { label: 'Таннаим', from: 0, to: 220, color: '#b34f6a' },
  { label: 'Амораим', from: 220, to: 500, color: '#b7791f' },
  { label: 'Савораим', from: 500, to: 650, color: '#b08968' },
  { label: 'Геоним', from: 650, to: 1038, color: '#2563eb' },
  { label: 'Ришоним', from: 1038, to: 1500, color: '#4f46e5' },
  { label: 'Ахроним', from: 1500, to: 2100, color: '#0ea5e9' },
];

function normalizeYear(value: any): number | undefined {
  if (value == null) return undefined;
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  if (typeof value === 'string') {
    const digits = value.replace(/[^\d\-–—]/g, '');
    const num = Number(digits);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
}

function parseYearRangeString(str: string): { start?: number; end?: number } | null {
  // handle "1613-1617" or "1613–1617"
  const m = str.split(/[–—-]/).map(s => s.trim()).filter(Boolean);
  if (m.length === 2) {
    const start = normalizeYear(m[0]);
    const end = normalizeYear(m[1]);
    if (start || end) return { start, end };
  }
  return null;
}

function getCompDateRange(raw: any): CompDateRange | null {
  const src = raw?.compDate ?? raw?.metadata?.compDate ?? raw?.comp_date;

  if (Array.isArray(src)) {
    const [startRaw, endRaw] = src;
    const start = normalizeYear(startRaw);
    const end = normalizeYear(endRaw);
    if (!start && !end) return null;
    return { start, end };
  }

  if (typeof src === 'string') {
    const range = parseYearRangeString(src);
    if (range) return range;
    const single = normalizeYear(src);
    if (single != null) return { start: single, end: single };
  }

  if (typeof src === 'object' && src) {
    const start = normalizeYear(src.start ?? src.from);
    const end = normalizeYear(src.end ?? src.to);
    if (!start && !end) return null;
    return { start, end };
  }

  const single = normalizeYear(src);
  if (single != null) return { start: single, end: single };

  return null;
}

function compDateValue(raw: any): number | null {
  const range = getCompDateRange(raw);
  if (!range) return null;
  if (range.start != null) return range.start;
  if (range.end != null) return range.end;
  return null;
}

function compOrderVal(v: number | null, sortOrder: SortOrder): number {
  if (v == null) return sortOrder === 'compAsc' ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  return v;
}

function formatCompDateRange(range?: CompDateRange | null): string | null {
  if (!range) return null;
  if (range.start != null && range.end != null) return `${range.start}–${range.end}`;
  if (range.start != null) return `${range.start}`;
  if (range.end != null) return `${range.end}`;
  return null;
}

function getPeriodTag(range?: CompDateRange | null): { label: string; color: string } | null {
  if (!range) return null;
  const year = range.start ?? range.end;
  if (!Number.isFinite(year)) return null;
  const period = PERIODS.find((p) => year >= p.from && year < p.to);
  return period ? { label: period.label, color: period.color } : null;
}

function getGroupCompDateRange(group: GroupNode): CompDateRange | null {
  if (!group.items?.length) return null;
  const years = group.items
    .map((it) => compDateValue(it))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  if (!years.length) return null;
  return { start: years[0], end: years[years.length - 1] };
}

function groupCompDateValue(group: GroupNode): number | null {
  const range = getGroupCompDateRange(group);
  if (!range) return null;
  return range.start ?? range.end ?? null;
}

export function sortGroupItems(items: any[], sortOrder: SortOrder): any[] {
  return [...items].sort((a, b) => {
    if (sortOrder === 'compAsc' || sortOrder === 'compDesc') {
      const av = compOrderVal(compDateValue(a), sortOrder);
      const bv = compOrderVal(compDateValue(b), sortOrder);
      const diff = av - bv;
      if (diff !== 0) return sortOrder === 'compAsc' ? diff : -diff;
      // если дата одинакова — падаем к натуральной сортировке частей
    }

    // Стандартный порядок (score → part → ref) без приоритета EN при сортировке по дате
    const ae = hasEnglish(a) ? 1 : 0;
    const be = hasEnglish(b) ? 1 : 0;
    if (sortOrder === 'score' && ae !== be) return be - ae; // EN first only для score-сортировки

    const as = a.score ?? 0, bs = b.score ?? 0;
    if (as !== bs) return bs - as;

    const av = naturalPartValue(a.ref || a.metadata?.ref || '');
    const bv = naturalPartValue(b.ref || b.metadata?.ref || '');
    if (av.n != null && bv.n != null) return av.n - bv.n;
    if (av.n != null) return -1;
    if (bv.n != null) return 1;
    return (av.s ?? '').localeCompare(bv.s ?? '', undefined, { numeric: true, sensitivity: 'base' });
  });
}

// Сортировка групп
export function sortGroups(groups: GroupNode[], sortOrder: SortOrder): GroupNode[] {
  const groupHasEN = (g: GroupNode) => g.items.some(hasEnglish) ? 1 : 0;
  const maxScore = (items: any[]) => items.reduce((m, it) => Math.max(m, it.score ?? -Infinity), -Infinity);

  return [...groups].sort((g1, g2) => {
    if (sortOrder === 'compAsc' || sortOrder === 'compDesc') {
      const d1 = groupCompDateValue(g1);
      const d2 = groupCompDateValue(g2);
      const v1 = compOrderVal(d1, sortOrder);
      const v2 = compOrderVal(d2, sortOrder);
      const diff = v1 - v2;
      if (diff !== 0) return sortOrder === 'compAsc' ? diff : -diff;
      // при равных датах — падение к тракта/странице
    }
    // EN/score приоритет только в режиме score
    if (sortOrder === 'score') {
      const e1 = groupHasEN(g1), e2 = groupHasEN(g2);
      if (e1 !== e2) return e2 - e1;                 // EN-first по группам
      const s1 = maxScore(g1.items), s2 = maxScore(g2.items);
      if (s1 !== s2) return s2 - s1;                  // затем score
    }
    const t1 = `${g1.parsed.tractate} ${g1.parsed.page}:${g1.parsed.section}`;
    const t2 = `${g2.parsed.tractate} ${g2.parsed.page}:${g2.parsed.section}`;
    return t1.localeCompare(t2, undefined, { numeric: true, sensitivity: 'base' });
  });
}

export function sortOrphans(items: any[], sortOrder: SortOrder): any[] {
  return [...items].sort((a, b) => {
    if (sortOrder === 'compAsc' || sortOrder === 'compDesc') {
      const av = compOrderVal(compDateValue(a), sortOrder);
      const bv = compOrderVal(compDateValue(b), sortOrder);
      const diff = av - bv;
      if (diff !== 0) return sortOrder === 'compAsc' ? diff : -diff;
    }
    const ae = hasEnglish(a) ? 1 : 0;
    const be = hasEnglish(b) ? 1 : 0;
    if (sortOrder === 'score' && ae !== be) return be - ae;
    const as = a.score ?? 0, bs = b.score ?? 0;
    if (as !== bs) return bs - as;
    return (a.ref || '').localeCompare(b.ref || '', undefined, { numeric: true, sensitivity: 'base' });
  });
}

// Цветовая схема
const COMMENTATOR_COLORS: Record<string, string> = {
  Rashi:    '#4AA3FF',
  Tosafot:  '#2ECC71',
  Ramban:   '#8E8AFF',
  Rashba:   '#FF8A4A',
  Ritva:    '#00B8D9',
};

function colorFromString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 30%, 60%)`;
}

export function pickColor(category?: string, commentator?: string) {
  if (category) return colorFromString(category);
  if (commentator && COMMENTATOR_COLORS[commentator]) return COMMENTATOR_COLORS[commentator];
  return '#7A7A7A';
}

const CATEGORY_ALIASES: Record<string, string> = {
  Bible: 'Tanakh',
  'Modern Works': 'Reference',
};

const PRIMARY_CATEGORY_ORDER = [
  'Commentary',
  'Tanakh',
  'Mishnah',
  'Talmud',
  'Halakhah',
  'Responsa',
];

const ALL_CATEGORY_NAMES = [
  ...PRIMARY_CATEGORY_ORDER,
  'Midrash',
  'Kabbalah',
  'Liturgy',
  'Jewish Thought',
  'Tosefta',
  'Chasidut',
  'Musar',
  'Second Temple',
  'Reference',
  'Targum',
  'Quoting Commentary',
];

const FALLBACK_CATEGORIES: Category[] = ALL_CATEGORY_NAMES.map((name) => ({
  name,
  color: colorFromString(name),
}));

const CATEGORY_LOCALE: Record<string, string> = {
  'Commentary': 'Комментарий',
  'Quoting Commentary': 'Цитируемый комментарий',
  'Midrash': 'Мидраш',
  'Mishnah': 'Мишна',
  'Targum': 'Таргум',
  'Halakhah': 'Галаха',
  'Responsa': 'Респонсы',
  'Chasidut': 'Хасидизм',
  'Kabbalah': 'Каббала',
  'Jewish Thought': 'Еврейская мысль',
  'Liturgy': 'Литургия',
  'Bible': 'Танах',
  'Tanakh': 'Танах',
  'Talmud': 'Талмуд',
  'Tosefta': 'Тосефта',
  'Musar': 'Мусар',
  'Second Temple': 'Второй Храм',
  'Reference': 'Справочник',
  'Modern Works': 'Современные работы',
};

function canonicalCategoryName(name: string): string {
  return CATEGORY_ALIASES[name] || name;
}

function orderCategories(cats: Category[]): Category[] {
  const orderIndex = (name: string) => {
    const idx = PRIMARY_CATEGORY_ORDER.indexOf(name);
    return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
  };
  return [...cats].sort((a, b) => {
    const oa = orderIndex(a.name);
    const ob = orderIndex(b.name);
    if (oa !== ob) return oa - ob;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
}

const BookshelfPanel = memo(({
  sessionId,
  currentRef,
  onDragStart,
  onAddToWorkbench,
  studySnapshot
}: BookshelfPanelProps & {
  sessionId?: string;
  currentRef?: string;
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>('Commentary');
  const [showAllCategories, setShowAllCategories] = useState(false);
  const [bookshelfState, setBookshelfState] = useState<BookshelfState>({
    groups: [],
    orphans: [],
    sortOrder: 'score',
    searchQuery: '',
    activeFilters: {
      commentators: [],
      tractates: [],
      viewType: 'all'
    },
    draggedItem: null,
    hoveredGroup: null,
    previewVisible: null
  });
  const [profileSlug, setProfileSlug] = useState<string | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Debounced search
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearchQuery(bookshelfState.searchQuery);
    }, 200);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [bookshelfState.searchQuery]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [density, setDensity] = useState<'compact'|'normal'>('compact');

  // Функция для определения, какую панель использовать
  const getTargetPanel = useCallback((): 'left' | 'right' => {
    if (!studySnapshot?.workbench) return 'left';
    
    const leftOccupied = !!studySnapshot.workbench.left;
    const rightOccupied = !!studySnapshot.workbench.right;
    
    // Если левая свободна - используем её
    if (!leftOccupied) return 'left';
    // Если правая свободна - используем её
    if (!rightOccupied) return 'right';
    // Если обе заняты - заменяем левую (считаем её "самой старой")
    return 'left';
  }, [studySnapshot]);

  // Обработчик добавления в workbench
  const handleAddToWorkbench = useCallback((ref: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    
    if (!onAddToWorkbench) return;

    const targetSide = getTargetPanel();
    onAddToWorkbench(ref, targetSide);
  }, [onAddToWorkbench, getTargetPanel]);

  const handleSortChange = useCallback((order: SortOrder) => {
    setBookshelfState(prev => ({ ...prev, sortOrder: order }));
  }, []);

  const handleOpenProfile = useCallback((slug?: string | null, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!slug) return;
    setProfileSlug(slug);
    setIsProfileOpen(true);
  }, []);

  const deriveProfileSlug = useCallback((item: any, parsed?: ParsedRef | null): string | null => {
    if (item?.indexTitle) return item.indexTitle;
    if (parsed?.commentator && parsed?.tractate) {
      return `${parsed.commentator} on ${parsed.tractate}`;
    }
    return parsed?.commentator || null;
  }, []);

  // Load categories on mount
  useEffect(() => {
    const loadCategories = async () => {
      setIsLoadingCategories(true);
      setError(null);
      try {
        const cats = await api.getBookshelfCategories();
        const mergedMap = new Map<string, Category>();
        // сначала fallback чтобы порядок был консистентный
        for (const c of FALLBACK_CATEGORIES) {
          const canon = canonicalCategoryName(c.name);
          mergedMap.set(canon, { ...c, name: canon });
        }
        for (const c of cats || []) {
          const canon = canonicalCategoryName(c.name);
          mergedMap.set(canon, { ...c, name: canon, color: c.color || colorFromString(canon) });
        }
        const merged = orderCategories(Array.from(mergedMap.values()));
        setCategories(merged);
        // Auto-select Commentary always, fallback to first
        if (!selectedCategory || selectedCategory !== 'Commentary') {
          const preferred = merged.find((c) => c.name === 'Commentary')?.name || merged[0]?.name;
          setSelectedCategory(preferred ?? 'Commentary');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load categories');
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  // Load items when category or ref changes
  useEffect(() => {
    if (!selectedCategory || !sessionId || !currentRef) return;

    const loadItems = async () => {
      setIsLoadingItems(true);
      setError(null);
      try {
        const data = await api.getBookshelfItems(sessionId, currentRef, selectedCategory);

        // ✅ страховка на случай undefined/null
        const rawItems = Array.isArray(data?.bookshelf?.items) ? data.bookshelf.items : [];
        const normalizedItems = rawItems.map((it) => ({
          ...it,
          category: it.category ? canonicalCategoryName(it.category) : it.category,
        }));

        // Временный диагностический лог (чтобы понять причину, если снова пусто)
        console.debug('[Bookshelf] cat:', selectedCategory, 'items:', data?.bookshelf?.items?.length, 'sample:', data?.bookshelf?.items?.[0]);

        // Группировать и сортировать
        const { groups, orphans } = groupByRef(normalizedItems);

        // Сортировать группы и элементы внутри групп
        const sortedGroups = sortGroups(groups.map(group => ({
          ...group,
          items: sortGroupItems(group.items, bookshelfState.sortOrder),
          color: pickColor(group.items[0]?.category, group.parsed.commentator)
        })), bookshelfState.sortOrder);

        const sortedOrphans = sortOrphans(orphans, bookshelfState.sortOrder);

        setBookshelfState(prev => ({
          ...prev,
          groups: sortedGroups,
          orphans: sortedOrphans
        }));
      } catch (err: any) {
        setError(err.message || 'Failed to load bookshelf items');
      } finally {
        setIsLoadingItems(false);
      }
    };

    loadItems();
  }, [selectedCategory, sessionId, currentRef]);

  const sortOrder = bookshelfState.sortOrder;

  // Пересортировать уже загруженные данные при смене порядка сортировки
  useEffect(() => {
    setBookshelfState((prev) => {
      const reGroups = sortGroups(
        prev.groups.map((g) => ({
          ...g,
          items: sortGroupItems(g.items, sortOrder),
        })),
        sortOrder
      );
      const reOrphans = sortOrphans(prev.orphans, sortOrder);
      return { ...prev, groups: reGroups, orphans: reOrphans };
    });
  }, [sortOrder]);


  // Filter groups and items based on search and filters
  const filteredData = useMemo(() => {
    let filteredGroups = bookshelfState.groups;
    let filteredOrphans = bookshelfState.orphans;

    // Apply filters to groups
    if (bookshelfState.activeFilters.commentators.length > 0) {
      filteredGroups = filteredGroups.filter(group =>
        bookshelfState.activeFilters.commentators.includes(group.parsed.commentator)
      );
      filteredOrphans = filteredOrphans.filter((item: any) => {
        const parsed = parseRefStrict(item.ref);
        return parsed && bookshelfState.activeFilters.commentators.includes(parsed.commentator);
      });
    }

    if (bookshelfState.activeFilters.tractates.length > 0) {
      filteredGroups = filteredGroups.filter(group =>
        bookshelfState.activeFilters.tractates.includes(group.parsed.tractate)
      );
      filteredOrphans = filteredOrphans.filter((item: any) => {
        const parsed = parseRefStrict(item.ref);
        return parsed && bookshelfState.activeFilters.tractates.includes(parsed.tractate);
      });
    }

    // Search filter
    if (debouncedSearchQuery) {
      const query = debouncedSearchQuery.toLowerCase();
      filteredGroups = filteredGroups.filter(group =>
        group.parsed.commentator.toLowerCase().includes(query) ||
        group.key.toLowerCase().includes(query) ||
        group.items.some((item: any) => {
          const preview = coalescePreview(item);
          return item.ref.toLowerCase().includes(query) ||
                 item.category?.toLowerCase().includes(query) ||
                 (preview.text && preview.text.toLowerCase().includes(query));
        })
      );
      filteredOrphans = filteredOrphans.filter((item: any) => {
        const preview = coalescePreview(item);
        return item.ref.toLowerCase().includes(query) ||
               item.category?.toLowerCase().includes(query) ||
               (preview.text && preview.text.toLowerCase().includes(query));
      });
    }

    // View type filter
    if (bookshelfState.activeFilters.viewType === 'groups') {
      filteredOrphans = []; // Hide orphans when showing only groups
    } else if (bookshelfState.activeFilters.viewType === 'parts') {
      filteredGroups = filteredGroups.filter(group => group.items.length > 1); // Hide single-item groups
    }

    return { groups: filteredGroups, orphans: filteredOrphans };
  }, [bookshelfState.groups, bookshelfState.orphans, debouncedSearchQuery, bookshelfState.activeFilters]);

  // Render single part group (compact)
  const renderSinglePartGroup = useCallback((group: GroupNode) => {
    const item = group.items[0];
    const parsed = parseRefStrict(item.ref); // может вернуть null, проверим
    const compRange = getCompDateRange(item);
    const compDateLabel = formatCompDateRange(compRange);
    const periodTag = getPeriodTag(compRange);
    const langBadge = getLangBadge(item);

    return (
      <div
        key={group.key}
        className={`rounded-lg border panel-card cursor-move hover:bg-accent/5 transition-colors ${density === 'compact' ? 'p-2' : 'p-2.5'}`}
        style={{ borderColor: `${group.color}80`, borderWidth: '2px' }}
        draggable
        onDragStart={(e) => {
          // Для совместимости передаем конкретный ref части
          e.dataTransfer.setData('text/astra-commentator-ref', item.ref);
          e.dataTransfer.setData('text/plain', item.ref);
          setBookshelfState(prev => ({ ...prev, draggedItem: item.ref }));
          onDragStart?.(item.ref);
        }}
      >
        <div className="flex items-start gap-2">
          {/* цветовой маркер */}
          <div className="w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: group.color }} />

          <div className="flex-1 min-w-0">
            {/* ГЛАВНАЯ СТРОКА: КТО/ГДЕ */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="font-semibold text-sm truncate">
                {group.parsed.commentator} on {group.parsed.tractate} {group.parsed.page}:{group.parsed.section}
              </div>
              {deriveProfileSlug(item, parsed) && (
                <button
                  type="button"
                  onClick={(e) => handleOpenProfile(deriveProfileSlug(item, parsed), e)}
                  onMouseDown={(e) => e.stopPropagation()}
                  className="flex-shrink-0 w-6 h-6 grid place-items-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                  title="Профиль автора/книги"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground/90 flex-nowrap">
              {langBadge && (
                <span className={langBadge.className} aria-label={`Язык: ${langBadge.text}`}>
                  {langBadge.text}
                </span>
              )}
              {compDateLabel && (
                <span className="px-1.5 py-0.5 rounded-md bg-accent/20 border border-border/60 text-[11px] leading-none whitespace-nowrap text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
                  {compDateLabel}
                </span>
              )}
              {periodTag && (
                <span
                  className="px-1.5 py-0.5 rounded-md text-[11px] leading-none text-white whitespace-nowrap"
                  style={{ backgroundColor: periodTag.color }}
                  aria-label={`Период: ${periodTag.label}`}
                >
                  {periodTag.label}
                </span>
              )}
            </div>

            {/* ДОП. ПОДПИСИ (если есть) */}
            {(item.heRef || item.indexTitle) && (
              <div className="text-[11px] text-muted-foreground/80 mt-0.5 truncate">
                {/* Ивритский heRef показываем RTL и одной строкой */}
                {item.heRef && (
                  <span dir="rtl" className="font-hebrew">
                    {item.heRef}
                  </span>
                )}
                {item.heRef && item.indexTitle ? ' â€¢ ' : null}
                {item.indexTitle && (
                  <span dir="ltr">{item.indexTitle}</span>
                )}
              </div>
            )}

            {/* РЕФЕРЕНТ В МОНО (адрес части) */}
            <div className="text-[10px] font-mono text-muted-foreground mt-0.5">
              {parsed ? `${parsed.page}:${parsed.section}:${parsed.part ?? '?'}` : item.ref}
            </div>

            {/* ПРЕВЬЮ (2 строки, RTL при иврите) */}
            {density === 'normal' && (() => {
              const preview = coalescePreview(item);
              if (!preview.text) return null;
              const dir = preview.lang === 'he' ? 'rtl' : 'ltr';
              return (
                <div
                  className={`mt-1 opacity-85 line-clamp-2 ${preview.lang === 'he' ? 'text-right font-hebrew' : 'text-left'} text-[11px]`}
                  dir={dir}
                  title={preview.text}
                >
                  {preview.text}
                </div>
              );
            })()}
          </div>
          {onAddToWorkbench && (
            <button
              type="button"
              onClick={(e) => handleAddToWorkbench(item.ref, e)}
              className="flex-shrink-0 w-6 h-6 rounded-md border border-border/40 bg-background hover:bg-accent hover:border-accent-foreground/20 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
              title="Добавить в панель"
              aria-label="Добавить в панель"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }, [onDragStart, density, onAddToWorkbench, handleAddToWorkbench, handleOpenProfile, deriveProfileSlug]);

  // Render multi-part group
  const renderMultiPartGroup = useCallback((group: GroupNode) => {
    const compRange = getGroupCompDateRange(group);
    const compDateLabel = formatCompDateRange(compRange);
    const periodTag = getPeriodTag(compRange);
    const profileSlug = deriveProfileSlug(group.items[0], group.parsed);
    return (
      <div key={group.key} className="space-y-1">
        {/* Group header - compact "series line" */}
        <div
          className={`rounded-lg border panel-card cursor-move hover:bg-accent/5 transition-colors relative ${density === 'compact' ? 'p-2' : 'p-2.5'}`}
          style={{ borderColor: `${group.color}80`, borderWidth: '2px' }}
          title={`Drag entire series: ${group.parsed.commentator} on ${group.parsed.tractate} ${group.parsed.page}:${group.parsed.section} (${group.items.length} parts)`}
          draggable
          onDragStart={(e) => {
            // Передаем всю группу как единое целое
            const groupRef = `${group.parsed.commentator} on ${group.parsed.tractate} ${group.parsed.page}:${group.parsed.section}`;
            const groupData = {
              type: 'group',
              ref: groupRef, // Основной ref группы без части
              refs: group.items.map(item => item.ref), // Все части группы
              groupKey: group.key,
              commentator: group.parsed.commentator,
              tractate: group.parsed.tractate,
              page: group.parsed.page,
              section: group.parsed.section
            };
            
            e.dataTransfer.setData('text/astra-commentator-ref', groupRef);
            e.dataTransfer.setData('text/plain', groupRef);
            // Добавляем специальный тип для группы
            e.dataTransfer.setData('application/json', JSON.stringify(groupData));
            e.dataTransfer.setData('text/astra-group', JSON.stringify(groupData));
            
            setBookshelfState(prev => ({ ...prev, draggedItem: groupRef }));
            onDragStart?.(groupRef);
          }}
        >
            <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-muted-foreground">≡</span>
                <div
                  className="w-3 h-3 rounded-full relative"
                  style={{ backgroundColor: group.color }}
                >
                  {/* Индикатор группового перетаскивания */}
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-primary rounded-full border border-background text-[8px] flex items-center justify-center text-white font-bold">
                    ≡
                  </div>
                </div>
                <div className="font-semibold text-sm truncate">
                  {group.parsed.commentator} on {group.parsed.tractate} {group.parsed.page}:{group.parsed.section}
                </div>
                {profileSlug && (
                  <button
                    type="button"
                    onClick={(e) => handleOpenProfile(profileSlug, e)}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="flex-shrink-0 w-6 h-6 grid place-items-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                    title="Профиль автора/книги"
                  >
                    <HelpCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/90 ml-5 flex-nowrap">
              {compDateLabel && (
              <span className="px-1.5 py-0.5 rounded-md bg-accent/20 border border-border/60 leading-none whitespace-nowrap text-foreground text-[11px] shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
                {compDateLabel}
              </span>
            )}
              {periodTag && (
                <span
                  className="px-1.5 py-0.5 rounded-md leading-none text-white whitespace-nowrap"
                  style={{ backgroundColor: periodTag.color }}
                  aria-label={`Период: ${periodTag.label}`}
                >
                  {periodTag.label}
                </span>
                )}
              </div>
            </div>
            {onAddToWorkbench && (
              <button
                type="button"
                onClick={(e) => {
                  const groupRef = `${group.parsed.commentator} on ${group.parsed.tractate} ${group.parsed.page}:${group.parsed.section}`;
                  handleAddToWorkbench(groupRef, e);
                }}
                className="flex-shrink-0 w-6 h-6 rounded-md border border-border/40 bg-background hover:bg-accent hover:border-accent-foreground/20 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                title="Добавить группу в панель"
                aria-label="Добавить группу в панель"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Parts - indented and simpler */}
        <div className="ml-6 space-y-1">
          {group.items.map((item: any, idx: number) => {
            const part = parseRefStrict(item.ref)?.part;
            const langBadge = getLangBadge(item);
            return (
              <div
                key={`${item.ref}__${idx}`}
                className={`flex items-start gap-2 rounded border panel-card hover:bg-accent/10 transition-colors cursor-move ${density==='compact' ? 'py-1 px-2' : 'py-1.5 px-3'}`}
                title={`Drag individual part: ${item.ref}`}
                draggable
                onDragStart={(e) => {
                  // Передаем отдельную часть
                  const partData = {
                    type: 'part',
                    ref: item.ref,
                    parentGroup: group.key,
                    commentator: group.parsed.commentator,
                    tractate: group.parsed.tractate,
                    page: group.parsed.page,
                    section: group.parsed.section,
                    part: parseRefStrict(item.ref)?.part
                  };
                  
                  e.dataTransfer.setData('text/astra-commentator-ref', item.ref);
                  e.dataTransfer.setData('text/plain', item.ref);
                  // Добавляем специальный тип для части
                  e.dataTransfer.setData('application/json', JSON.stringify(partData));
                  e.dataTransfer.setData('text/astra-part', JSON.stringify(partData));
                  
                  setBookshelfState(prev => ({ ...prev, draggedItem: item.ref }));
                  onDragStart?.(item.ref);
                }}
              >
                <span className="text-muted-foreground mt-0.5">≡</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-mono text-muted-foreground">
                    {part ? `${group.parsed.page}:${group.parsed.section}:${part}` : item.ref}
                  </div>
                  {density === 'normal' && (() => {
                    const preview = coalescePreview(item);
                    if (!preview.text) return null;
                    const dir = preview.lang === 'he' ? 'rtl' : 'ltr';
                    return (
                      <div
                        className={`text-[11px] opacity-85 mt-0.5 line-clamp-2 ${preview.lang==='he' ? 'text-right font-hebrew' : 'text-left'}`}
                        dir={dir}
                      >
                        {preview.text}
                      </div>
                    );
                  })()}
                </div>
                {langBadge && <span className={langBadge.className} aria-label={`Язык: ${langBadge.text}`}>{langBadge.text}</span>}
                {onAddToWorkbench && (
                  <button
                    type="button"
                    onClick={(e) => handleAddToWorkbench(item.ref, e)}
                    className="flex-shrink-0 w-6 h-6 rounded-md border border-border/40 bg-background hover:bg-accent hover:border-accent-foreground/20 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
                    title="Добавить в панель"
                    aria-label="Добавить в панель"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }, [onDragStart, density, onAddToWorkbench, handleAddToWorkbench, handleOpenProfile]);

  // Main render group function
  const renderGroup = useCallback((group: GroupNode) => {
    return group.items.length === 1
      ? renderSinglePartGroup(group)
      : renderMultiPartGroup(group);
  }, [renderSinglePartGroup, renderMultiPartGroup, density]);

  // Render orphan item
  const renderOrphan = useCallback((item: any, idx?: number) => {
    const parsed = parseRefStrict(item.ref); // может быть null
    const compRange = getCompDateRange(item);
    const compDateLabel = formatCompDateRange(compRange);
    const periodTag = getPeriodTag(compRange);
    const langBadge = getLangBadge(item);
    const profileSlug = deriveProfileSlug(item, parsed);

    return (
      <div
        key={`${item.ref}__${idx ?? 0}`}
        className={`flex items-start gap-2 rounded-lg border panel-card hover:bg-accent/10 transition-colors cursor-move ${density==='compact' ? 'p-2' : 'p-2.5'}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData('text/astra-commentator-ref', item.ref);
          e.dataTransfer.setData('text/plain', item.ref);
          setBookshelfState(prev => ({ ...prev, draggedItem: item.ref }));
          onDragStart?.(item.ref);
        }}
      >
        <span className="text-muted-foreground mt-0.5">≡</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-sm font-medium truncate">
              {parsed
                ? `${parsed.commentator} on ${parsed.tractate} ${parsed.page}:${parsed.section}${parsed.part ? ` (Part ${parsed.part})` : ''}`
                : item.ref}
            </div>
            {profileSlug && (
              <button
                type="button"
                onClick={(e) => handleOpenProfile(profileSlug, e)}
                onMouseDown={(e) => e.stopPropagation()}
                className="flex-shrink-0 w-6 h-6 grid place-items-center rounded-md border border-border/60 text-muted-foreground hover:text-foreground hover:bg-accent/30 transition-colors"
                title="Профиль автора/книги"
              >
                <HelpCircle className="w-4 h-4" />
              </button>
            )}
            {langBadge && <span className={langBadge.className} aria-label={`Язык: ${langBadge.text}`}>{langBadge.text}</span>}
            {compDateLabel && (
                <span className="px-1.5 py-0.5 rounded-md bg-accent/20 border border-border/60 text-[11px] leading-none whitespace-nowrap text-foreground shadow-[0_0_0_1px_rgba(0,0,0,0.04)]">
                  {compDateLabel}
                </span>
              )}
            {periodTag && (
              <span
                className="px-1.5 py-0.5 rounded-md text-[11px] leading-none text-white whitespace-nowrap"
                style={{ backgroundColor: periodTag.color }}
              >
                {periodTag.label}
              </span>
            )}
          </div>
          {density === 'normal' && (() => {
            const preview = coalescePreview(item);
            if (!preview.text) return null;
            const dir = preview.lang === 'he' ? 'rtl' : 'ltr';
            return (
              <div
                className={`text-[11px] opacity-85 mt-1 line-clamp-2 ${preview.lang === 'he' ? 'text-right font-hebrew' : 'text-left'}`}
                dir={dir}
              >
                {preview.text}
              </div>
            );
          })()}
        </div>
        {onAddToWorkbench && (
          <button
            type="button"
            onClick={(e) => handleAddToWorkbench(item.ref, e)}
            className="flex-shrink-0 w-6 h-6 rounded-md border border-border/40 bg-background hover:bg-accent hover:border-accent-foreground/20 flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
            title="Добавить в панель"
            aria-label="Добавить в панель"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }, [onDragStart, density, onAddToWorkbench, handleAddToWorkbench, handleOpenProfile]);

  if (error) {
    return <ErrorState error={error} />;
  }

  if (isLoadingCategories) {
    return <LoadingState />;
  }

  return (
    <>
    <div className="h-full flex flex-col panel-outer border-l">
      {/* Header */}
      <div className="flex-shrink-0 panel-padding border-b border-border/50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">Источники</h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-border/60 overflow-hidden">
              <button
                type="button"
                onClick={() => handleSortChange('score')}
                aria-pressed={sortOrder === 'score'}
                className={`px-2 py-1 text-xs transition-colors ${sortOrder === 'score' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground'}`}
                title="Сначала релевантные"
              >
                Счёт
              </button>
              <button
                type="button"
                onClick={() => handleSortChange('compAsc')}
                aria-pressed={sortOrder === 'compAsc'}
                className={`px-2 py-1 text-xs border-l border-border/60 transition-colors ${sortOrder === 'compAsc' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground'}`}
                title="По дате: ранние → поздние"
              >
                Дата ↑
              </button>
              <button
                type="button"
                onClick={() => handleSortChange('compDesc')}
                aria-pressed={sortOrder === 'compDesc'}
                className={`px-2 py-1 text-xs border-l border-border/60 transition-colors ${sortOrder === 'compDesc' ? 'bg-accent text-accent-foreground' : 'bg-background text-muted-foreground'}`}
                title="По дате: поздние → ранние"
              >
                Дата ↓
              </button>
            </div>
            <div className="flex gap-1">
              <button onClick={()=>setDensity('compact')} aria-pressed={density==='compact'} type="button"
                title="Компактно" className={`rounded p-1 border ${density==='compact'?'bg-accent text-accent-foreground border-accent':'border-border bg-background text-muted-foreground'} transition-colors`}> <ArrowDownNarrowWide className="w-4 h-4"/></button>
              <button onClick={()=>setDensity('normal')} aria-pressed={density==='normal'} type="button"
                title="Стандартно" className={`rounded p-1 border ${density==='normal'?'bg-accent text-accent-foreground border-accent':'border-border bg-background text-muted-foreground'} transition-colors`}> <ArrowDownWideNarrow className="w-4 h-4"/></button>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Поиск источников..."
            className="w-full pl-9 pr-3 py-2 text-sm panel-card rounded-lg border-border/40 focus:outline-none focus:ring-0 focus:border-primary/50 transition-colors"
            value={bookshelfState.searchQuery}
            onChange={(e) => setBookshelfState(prev => ({ ...prev, searchQuery: e.target.value }))}
          />
        </div>

        {/* Category Buttons (compact, 12 max) */}
        <CategoryButtonBar
          categories={orderCategories(categories)}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
          accent="#c2a970"
          showAll={showAllCategories}
          onToggleShowAll={setShowAllCategories}
          getCount={(catName) => {
            // те же правила, что у тебя раньше — считаем сколько элементов в этой категории
            const all = [
              ...filteredData.groups.flatMap(g => g.items),
              ...filteredData.orphans,
            ];
            return all.filter(it => it.category === catName).length;
          }}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {isLoadingItems ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : (filteredData.groups.length === 0 && filteredData.orphans.length === 0) ? (
          <EmptyState hasSearch={!!bookshelfState.searchQuery} />
        ) : (
          <div className="panel-padding-sm space-compact">
            {filteredData.groups.map((group, i) => (
              <>
                {i>0 && <div className="soft-divider" />}
                {renderGroup(group)}
              </>
            ))}
            {filteredData.groups.length>0 && filteredData.orphans.length>0 && <div className="soft-divider" />}
            {filteredData.orphans.map((item, i) => (
              <>
                {i>0 && <div className="soft-divider" />}
                {renderOrphan(item, i)}
              </>
            ))}
          </div>
        )}
      </div>
    </div>
    <ProfileInspectorModal
      slug={profileSlug}
      open={isProfileOpen}
      onClose={() => setIsProfileOpen(false)}
    />
    </>
  );
});

export default BookshelfPanel;


const EmptyState = ({ hasSearch }: { hasSearch: boolean }) => (
  <div className="flex flex-col items-center justify-center h-full p-6 text-center">
    <BookOpen className="w-12 h-12 text-muted-foreground/30 mb-4" />
    <h4 className="text-sm font-medium text-muted-foreground mb-2">
      {hasSearch ? 'Ничего не найдено' : 'Источники ещё не добавлены'}
    </h4>
    <p className="text-xs text-muted-foreground/70">
      {hasSearch
        ? 'Попробуйте изменить параметры поиска'
        : 'Перетащите источники сюда или начните новое исследование'
      }
    </p>
  </div>
);

const LoadingState = () => (
  <div className="h-full flex items-center justify-center">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const ErrorState = ({ error }: { error: string }) => (
  <div className="h-full flex flex-col items-center justify-center p-6 text-center">
    <div className="text-red-500 mb-2">⚠️</div>
    <h3 className="text-lg font-medium mb-2">Error</h3>
    <p className="text-sm text-muted-foreground">{error}</p>
  </div>
);
