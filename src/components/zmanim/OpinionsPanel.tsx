import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/Switch';
import { Badge } from '../ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

export type ZmanimMethod = {
  id: string;
  type: 'time' | 'duration_ms' | 'number';
  menu_ru?: string | null;
  title_ru?: string | null;
  category?: string | null;
  what_is_it_ru?: string | null;
  how_calculated_ru?: string | null;
  bounds_ru?: {
    start_ru?: string | null;
    end_ru?: string | null;
  } | null;
  returns?: {
    type?: 'time' | 'duration_ms' | 'number' | string | null;
    unit_ru?: string | null;
    meaning_ru?: string | null;
    error_value?: string | null;
    error_ru?: string | null;
  } | null;
  deprecated?: boolean | null;
  deprecated_ru?: string | null;
  attribution?: string | null;
  authors?: string[] | null;
  author_primary?: string | null;
  tags?: string[] | null;
};

type Preset = {
  id: string;
  label: string;
  methods: string[];
};

const OPINIONS_I18N_RU = {
  opinions: {
    title: 'Мнения',
    searchPlaceholder: 'Поиск по названию или id',
    buttons: {
      clear: 'Сбросить',
      all: 'Выбрать все',
      core: 'Базовый набор',
      select: 'Выбрать',
      deselect: 'Снять выбор',
      copyLink: 'Скопировать ссылку на метод',
      showInList: 'Показать в списке',
      showSimilar: 'Показать похожие неустаревшие',
      details: 'Подробнее',
    },
    filters: {
      title: 'Фильтры',
      category: 'Категория',
      author: 'Автор / школа',
      calcType: 'Тип расчёта',
      dataType: 'Тип данных',
      showDeprecated: 'Показать устаревшие',
      onlySelected: 'Показывать только выбранные',
      reset: 'Сбросить фильтры',
    },
    badges: {
      deprecated: 'устар.',
      core: 'база',
      chabad: 'хабад',
    },
    group: {
      chabad: 'Хабад (Бааль ха-Тания)',
      other: 'Другие мнения',
    },
    empty: {
      noResults: 'Ничего не найдено',
      noMethods: 'Нет доступных методов',
    },
    detail: {
      category: 'Категория',
      author: 'Автор / школа',
      status: 'Статус',
      statusDeprecated: 'устаревший',
      statusActive: 'активный',
      whatIsIt: 'Что это такое',
      howCalculated: 'Как считается',
      bounds: 'Границы',
      returns: 'Возвращаемое значение',
      attribution: 'Источники / attribution',
      practical: 'Практическое значение',
      core: 'Входит в базовый набор',
      coreYes: 'Да',
      coreNo: 'Нет',
    },
  },
};

const CATEGORY_LABELS_RU: Record<string, string> = {
  'Alos Hashachar': 'Алот ашахар (рассвет)',
  Alos: 'Алот ашахар (рассвет)',
  Misheyakir: 'Мишеякир',
  Hanetz: 'Нэц (восход)',
  Sunrise: 'Нэц (восход)',
  'Sof Zman Krias Shema': 'Соф зман Криат Шма',
  'Sof Zman Kerias Shema': 'Соф зман Криат Шма',
  'Sof Zman Shma': 'Соф зман Криат Шма',
  'Sof Zman Tefillah': 'Соф зман Тфила',
  'Sof Zman Tfila': 'Соф зман Тфила',
  'Sof Zman Achilas Chametz': 'Соф зман ахилат хамец',
  'Sof Zman Biur Chametz': 'Соф зман биур хамец',
  Chametz: 'Соф зман ахилат/биур хамец',
  Chatzos: 'Хацот (полдень)',
  'Mincha Gedola': 'Минха гдола',
  'Mincha Ketana': 'Минха ктана',
  Plag: 'Плаг а-минха',
  'Plag Hamincha': 'Плаг а-минха',
  'Plag Haminchah': 'Плаг а-минха',
  Shkiah: 'Шкия (закат)',
  Sunset: 'Шкия (закат)',
  Tzeis: 'Цейт (выход звёзд / ночь)',
  Tzais: 'Цейт (выход звёзд / ночь)',
  'Chatzos Halailah': 'Хацот лайла (полночь)',
  'Shaah Zmanis': 'Шаа зманит (пропорциональный час)',
  'Bein Hashemashos': 'Бейн а-шемашот (сумерки)',
  'Bain Hashmashos': 'Бейн а-шемашот (сумерки)',
  'Shabbat/Yom Tov Ends': 'Исход шаббата / йом тов',
};

const CATEGORY_ORDER = [
  'Alos Hashachar',
  'Alos',
  'Misheyakir',
  'Hanetz',
  'Sunrise',
  'Sof Zman Krias Shema',
  'Sof Zman Kerias Shema',
  'Sof Zman Shma',
  'Sof Zman Tefillah',
  'Sof Zman Tfila',
  'Sof Zman Achilas Chametz',
  'Sof Zman Biur Chametz',
  'Chametz',
  'Chatzos',
  'Mincha Gedola',
  'Mincha Ketana',
  'Plag',
  'Plag Hamincha',
  'Plag Haminchah',
  'Shkiah',
  'Sunset',
  'Tzeis',
  'Tzais',
  'Bein Hashemashos',
  'Bain Hashmashos',
  'Chatzos Halailah',
  'Shaah Zmanis',
  'Shabbat/Yom Tov Ends',
];

const PRACTICAL_MEANING_RU: Record<string, string> = {
  'Alos Hashachar': 'Начало дневных обязанностей; старт большинства постов (кроме Йом Кипур и 9 Ава).',
  Alos: 'Начало дневных обязанностей; старт большинства постов (кроме Йом Кипур и 9 Ава).',
  Misheyakir: 'Ранний порог для талит/тфилин/Шма при необходимости.',
  Hanetz: 'Идеальное время для Шахарит и Амида.',
  Sunrise: 'Идеальное время для Шахарит и Амида.',
  'Sof Zman Krias Shema': 'Дедлайн для чтения Шма.',
  'Sof Zman Kerias Shema': 'Дедлайн для чтения Шма.',
  'Sof Zman Shma': 'Дедлайн для чтения Шма.',
  'Sof Zman Tefillah': 'Дедлайн для Шахарит-Амида.',
  'Sof Zman Tfila': 'Дедлайн для Шахарит-Амида.',
  Chatzos: 'Полдень; опорная точка для расчётов дневных интервалов.',
  'Mincha Gedola': 'Открывает окно для Минхи (ранняя граница).',
  'Mincha Ketana': 'Основное окно Минхи (предпочтительное время).',
  Plag: 'Порог между Минхой и Мааривом.',
  'Plag Hamincha': 'Порог между Минхой и Мааривом.',
  'Plag Haminchah': 'Порог между Минхой и Мааривом.',
  Shkiah: 'Завершение дня по солнцу, переход к сумеркам.',
  Sunset: 'Завершение дня по солнцу, переход к сумеркам.',
  Tzeis: 'Наступление ночи, завершение дневных митцвот.',
  Tzais: 'Наступление ночи, завершение дневных митцвот.',
  'Bein Hashemashos': 'Сумеречный интервал со смешанным статусом дня/ночи.',
  'Bain Hashmashos': 'Сумеречный интервал со смешанным статусом дня/ночи.',
  'Chatzos Halailah': 'Дедлайн ряда ночных митцвот.',
  'Shaah Zmanis': 'Базовая единица для пропорциональных расчётов времени.',
};

const AUTHOR_LABELS: Record<string, string> = {
  'Baal HaTanya': 'Хабад / Бааль ха-Тания',
  GRA: 'ГРА (Виленский Гаон)',
  MGA: 'МГА (Маген Авраам)',
  Rambam: 'Рамбам',
  'Rav Ovadia Yosef': 'Рав Овадья Йосеф',
  'Pri Megadim': 'При Мегадим (ПМГ)',
  'Rav Moshe Feinstein': 'Рав Моше Файнштейн',
};

const CALC_TYPE_LABELS: Record<string, string> = {
  degrees: 'Градусы солнца',
  fixedMinutes: 'Фиксированные минуты',
  zmaniyot: 'Минуты зманийот',
  seaLevel: 'Уровень моря',
  elevation: 'Высота / горы',
  chatzosMidpoint: 'Середина между точками (хацот)',
};

const DATA_TYPE_LABELS: Record<ZmanimMethod['type'], string> = {
  time: 'Время',
  duration_ms: 'Длительность',
  number: 'Число',
};

const AUTHOR_PATTERNS: Array<{ key: string; pattern: RegExp }> = [
  { key: 'Baal HaTanya', pattern: /(баал|baal|hatanya|alter rebbe)/i },
  { key: 'GRA', pattern: /(г.?ра|gaon|vilna|vilnius|gra)/i },
  { key: 'MGA', pattern: /(mga|magen avraam|mag(en)? avraam|маг(ен)? авраам)/i },
  { key: 'Rambam', pattern: /(rambam|рамбам)/i },
  { key: 'Rav Ovadia Yosef', pattern: /(ovad(ia|ya)|овадья|ялкут|yalkut)/i },
  { key: 'Pri Megadim', pattern: /(pri megadim|pmg|при мегадим)/i },
  { key: 'Rav Moshe Feinstein', pattern: /(moshe feinstein|моше файнштейн)/i },
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeQuery = (value: string) =>
  normalizeText(value).split(' ').filter(Boolean);

const labelForCategory = (category?: string | null) => {
  if (!category) return '';
  return CATEGORY_LABELS_RU[category] ?? category;
};

const normalizeCategoryLabel = (label: string) => label.replace(/\s+/g, ' ').trim();

const normalizeAuthorKey = (value: string) => {
  const cleaned = value.trim();
  if (!cleaned) return null;
  for (const entry of AUTHOR_PATTERNS) {
    if (entry.pattern.test(cleaned)) return entry.key;
  }
  return cleaned;
};

const extractAuthors = (method: ZmanimMethod) => {
  const authors = new Set<string>();
  const rawList = method.authors ?? [];
  if (Array.isArray(rawList)) {
    rawList.forEach((raw) => {
      if (!raw) return;
      const normalized = normalizeAuthorKey(String(raw));
      if (normalized) authors.add(normalized);
    });
  }
  const attribution = method.attribution ?? '';
  if (attribution) {
    let matched = false;
    AUTHOR_PATTERNS.forEach((entry) => {
      if (entry.pattern.test(attribution)) {
        authors.add(entry.key);
        matched = true;
      }
    });
    if (!matched && method.authors?.length) {
      const normalized = normalizeAuthorKey(attribution);
      if (normalized) authors.add(normalized);
    }
  }
  return Array.from(authors);
};

const resolveAuthorPrimary = (method: ZmanimMethod, authors: string[]) => {
  const primaryRaw = method.author_primary ?? '';
  if (primaryRaw) {
    const normalized = normalizeAuthorKey(primaryRaw);
    if (normalized) return normalized;
  }
  return authors[0] ?? null;
};

const resolveTags = (method: ZmanimMethod, isBaalHatanya: boolean) => {
  const tags = new Set<string>((method.tags ?? []).filter(Boolean));
  const id = method.id ?? '';
  const attribution = method.attribution ?? '';
  const labelText = `${method.menu_ru ?? ''} ${method.title_ru ?? ''}`;
  const haystack = `${id} ${attribution} ${labelText}`.toLowerCase();

  if (/[°]/.test(attribution) || /degrees?/.test(haystack) || /point\d+/.test(haystack)) {
    tags.add('degrees');
  }
  if (/minutes?/.test(haystack) || /мин/.test(haystack)) {
    tags.add('fixedMinutes');
  }
  if (/zmaniy/.test(haystack) || /zmanis/.test(haystack)) {
    tags.add('zmaniyot');
  }
  if (/sea.?level/.test(haystack) || /уровень моря/.test(haystack)) {
    tags.add('seaLevel');
  }
  if (/elevation|mountain|высот|гор/.test(haystack)) {
    tags.add('elevation');
  }
  if (/midpoint|half/.test(haystack) || /середин/.test(haystack)) {
    tags.add('chatzosMidpoint');
  }
  if (isBaalHatanya) {
    tags.add('baalHatanya');
  }
  return Array.from(tags);
};

const buildSearchText = (method: ZmanimMethod, categoryLabel: string, authors: string[]) => {
  const parts = [
    method.menu_ru,
    method.title_ru,
    method.id,
    categoryLabel,
    method.category,
    method.attribution,
    authors.map((author) => AUTHOR_LABELS[author] ?? author).join(' '),
  ]
    .filter(Boolean)
    .map((item) => normalizeText(String(item)));
  return parts.join(' ');
};

export function OpinionsPanel({
  methods,
  selected,
  onChangeSelected,
  presets,
  defaultSet,
  humanizeMethod,
  getGroupName,
}: {
  methods: ZmanimMethod[];
  selected: string[];
  onChangeSelected: (next: string[]) => void;
  presets: Preset[];
  defaultSet: string[];
  humanizeMethod: (id: string) => string;
  getGroupName: (id: string) => string;
}) {
  const [filter, setFilter] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<string[]>([]);
  const [authorFilters, setAuthorFilters] = useState<string[]>([]);
  const [calcTypeFilters, setCalcTypeFilters] = useState<string[]>([]);
  const [dataTypeFilters, setDataTypeFilters] = useState<string[]>([]);
  const [showDeprecated, setShowDeprecated] = useState(false);
  const [onlySelected, setOnlySelected] = useState(false);
  const [activeMethodId, setActiveMethodId] = useState<string | null>(null);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'success' | 'error'>('idle');
  const rowRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const methodId = params.get('method');
    if (methodId) {
      setActiveMethodId(methodId);
    }
  }, []);

  const optionData = useMemo(() => {
    const categories = new Map<string, string>();
    const authors = new Set<string>();
    const calcTypes = new Set<string>();
    const dataTypes = new Set<string>();

    methods.forEach((method) => {
      const category = method.category ?? getGroupName(method.id);
      const categoryLabel = normalizeCategoryLabel(
        labelForCategory(category) || category || OPINIONS_I18N_RU.opinions.group.other
      );
      if (categoryLabel) categories.set(categoryLabel, categoryLabel);
      const authorList = extractAuthors(method);
      authorList.forEach((author) => authors.add(author));
      dataTypes.add(method.type);
      const isBaalHatanya = authorList.includes('Baal HaTanya') || /(baal|баал)/i.test(method.attribution ?? '');
      const tags = resolveTags(method, isBaalHatanya);
      tags.forEach((tag) => {
        if (CALC_TYPE_LABELS[tag]) calcTypes.add(tag);
      });
    });

    const sortByLabel = (values: string[], labelMap?: Record<string, string>) =>
      values.sort((a, b) => (labelMap?.[a] ?? a).localeCompare(labelMap?.[b] ?? b));

    const dataTypeOrder: ZmanimMethod['type'][] = ['time', 'duration_ms', 'number'];

    return {
      categories: sortByLabel(Array.from(categories.values())),
      authors: sortByLabel(Array.from(authors), AUTHOR_LABELS),
      calcTypes: sortByLabel(Array.from(calcTypes), CALC_TYPE_LABELS),
      dataTypes: Array.from(dataTypes).sort(
        (a, b) => dataTypeOrder.indexOf(a) - dataTypeOrder.indexOf(b)
      ),
    };
  }, [methods, getGroupName]);

  const filterTokens = useMemo(() => tokenizeQuery(filter), [filter]);

  const filteredMethods = useMemo(() => {
    const pinnedDeprecated = new Set<string>([...(selected || []), ...(activeMethodId ? [activeMethodId] : [])]);
    return methods.filter((method) => {
      const category = method.category ?? getGroupName(method.id);
      const categoryLabel = normalizeCategoryLabel(
        labelForCategory(category) || category || OPINIONS_I18N_RU.opinions.group.other
      );
      const authors = extractAuthors(method);
      const authorPrimary = resolveAuthorPrimary(method, authors);
      const isDeprecated = Boolean(method.deprecated);
      const isBaalHatanya =
        authorPrimary === 'Baal HaTanya' ||
        authors.includes('Baal HaTanya') ||
        /(baal|баал)/i.test(method.attribution ?? '');
      const tags = resolveTags(method, isBaalHatanya);

      if (!showDeprecated && isDeprecated && !pinnedDeprecated.has(method.id)) return false;
      if (onlySelected && !selected.includes(method.id)) return false;
      if (categoryFilters.length > 0 && !categoryFilters.includes(categoryLabel)) return false;
      if (authorFilters.length > 0) {
        const hasAuthor =
          authors.some((author) => authorFilters.includes(author)) ||
          (authorPrimary ? authorFilters.includes(authorPrimary) : false);
        if (!hasAuthor) return false;
      }
      if (calcTypeFilters.length > 0 && !tags.some((tag) => calcTypeFilters.includes(tag))) return false;
      if (dataTypeFilters.length > 0 && !dataTypeFilters.includes(method.type)) return false;
      if (filterTokens.length > 0) {
        const haystack = buildSearchText(method, categoryLabel, authors);
        const matches = filterTokens.every((token) => haystack.includes(token));
        if (!matches) return false;
      }
      return true;
    });
  }, [
    methods,
    selected,
    activeMethodId,
    showDeprecated,
    onlySelected,
    categoryFilters,
    authorFilters,
    calcTypeFilters,
    dataTypeFilters,
    filterTokens,
    getGroupName,
  ]);

  const groupedMethods = useMemo(() => {
    const groups = new Map<string, { key: string; label: string; items: ZmanimMethod[]; order: number }>();
    const categoryOrder = new Map(CATEGORY_ORDER.map((item, index) => [item, index]));

    filteredMethods.forEach((method) => {
      const category = method.category ?? getGroupName(method.id);
      const categoryLabel = normalizeCategoryLabel(
        labelForCategory(category) || OPINIONS_I18N_RU.opinions.group.other
      );
      const authors = extractAuthors(method);
      const authorPrimary = resolveAuthorPrimary(method, authors);
      const isBaalHatanya =
        authorPrimary === 'Baal HaTanya' ||
        authors.includes('Baal HaTanya') ||
        /(baal|баал)/i.test(method.attribution ?? '');

      const groupLabel = isBaalHatanya ? OPINIONS_I18N_RU.opinions.group.chabad : categoryLabel;
      const groupKey = isBaalHatanya ? 'chabad' : category ?? groupLabel;
      const order = isBaalHatanya ? -1 : categoryOrder.get(category ?? '') ?? 999;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { key: groupKey, label: groupLabel, items: [], order });
      }
      groups.get(groupKey)!.items.push(method);
    });

    const sortByLabel = (a: ZmanimMethod, b: ZmanimMethod) => {
      const aLabel = a.menu_ru ?? humanizeMethod(a.id);
      const bLabel = b.menu_ru ?? humanizeMethod(b.id);
      return aLabel.localeCompare(bLabel);
    };

    groups.forEach((group) => {
      group.items.sort((a, b) => {
        const aCategory = a.category ?? getGroupName(a.id);
        const bCategory = b.category ?? getGroupName(b.id);
        const orderA = CATEGORY_ORDER.indexOf(aCategory ?? '');
        const orderB = CATEGORY_ORDER.indexOf(bCategory ?? '');
        if (orderA !== orderB) {
          if (orderA === -1) return 1;
          if (orderB === -1) return -1;
          return orderA - orderB;
        }
        const labelSort = sortByLabel(a, b);
        if (labelSort !== 0) return labelSort;
        return a.id.localeCompare(b.id);
      });
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.label.localeCompare(b.label);
    });
  }, [filteredMethods, getGroupName, humanizeMethod]);

  const toggleMethod = (id: string) => {
    onChangeSelected(
      selected.includes(id) ? selected.filter((m) => m !== id) : [...selected, id]
    );
  };

  const applyPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId);
    if (!preset) return;
    const available = new Set(methods.map((m) => m.id));
    onChangeSelected(preset.methods.filter((id) => available.has(id)));
  };

  const activeMethod = useMemo(
    () => (activeMethodId ? methods.find((method) => method.id === activeMethodId) : null),
    [activeMethodId, methods]
  );

  const resetFilters = () => {
    setCategoryFilters([]);
    setAuthorFilters([]);
    setCalcTypeFilters([]);
    setDataTypeFilters([]);
    setShowDeprecated(false);
    setOnlySelected(false);
  };

  const toggleFilterValue = (
    value: string,
    current: string[],
    setter: (next: string[]) => void
  ) => {
    if (current.includes(value)) {
      setter(current.filter((item) => item !== value));
    } else {
      setter([...current, value]);
    }
  };

  const highlightRow = (id: string) => {
    const el = rowRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setHighlightedId(id);
    window.setTimeout(() => {
      setHighlightedId((prev) => (prev === id ? null : prev));
    }, 2000);
  };

  const handleCopyLink = (id: string) => {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('method', id);
      navigator.clipboard
        .writeText(url.toString())
        .then(() => {
          setCopyState('success');
          window.setTimeout(() => setCopyState('idle'), 1500);
        })
        .catch(() => {
          setCopyState('error');
          window.setTimeout(() => setCopyState('idle'), 1500);
        });
    } catch {
      setCopyState('error');
      window.setTimeout(() => setCopyState('idle'), 1500);
    }
  };

  const showSimilar = (method: ZmanimMethod) => {
    const category = method.category ?? '';
    const authors = extractAuthors(method);
    const primary = resolveAuthorPrimary(method, authors);
    setFilter('');
    if (category) setCategoryFilters([category]);
    if (primary) setAuthorFilters([primary]);
    setShowDeprecated(false);
  };

  const formatAuthorLabel = (authorKey: string) => AUTHOR_LABELS[authorKey] ?? authorKey;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>{OPINIONS_I18N_RU.opinions.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 flex-1 flex flex-col min-h-0">
        <Input
          placeholder={OPINIONS_I18N_RU.opinions.searchPlaceholder}
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <div className="flex items-center gap-2 overflow-x-auto">
          <Button type="button" variant="secondary" size="sm" onClick={() => onChangeSelected([])}>
            {OPINIONS_I18N_RU.opinions.buttons.clear}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onChangeSelected(methods.map((m) => m.id))}
          >
            {OPINIONS_I18N_RU.opinions.buttons.all}
          </Button>
          {presets.map((preset) => (
            <Button
              key={preset.id}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => applyPreset(preset.id)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <details className="rounded-lg border border-border/50 p-3" open>
          <summary className="cursor-pointer text-sm font-medium">
            {OPINIONS_I18N_RU.opinions.filters.title}
          </summary>
          <div className="mt-3 grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {OPINIONS_I18N_RU.opinions.filters.category}
              </div>
              <div className="flex flex-wrap gap-2">
                {optionData.categories.map((category) => (
                  <label key={category} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={categoryFilters.includes(category)}
                      onChange={() => toggleFilterValue(category, categoryFilters, setCategoryFilters)}
                    />
                    <span>{category}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {OPINIONS_I18N_RU.opinions.filters.author}
              </div>
              <div className="flex flex-wrap gap-2">
                {optionData.authors.map((author) => (
                  <label key={author} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={authorFilters.includes(author)}
                      onChange={() => toggleFilterValue(author, authorFilters, setAuthorFilters)}
                    />
                    <span>{formatAuthorLabel(author)}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {OPINIONS_I18N_RU.opinions.filters.calcType}
              </div>
              <div className="flex flex-wrap gap-2">
                {optionData.calcTypes.map((calcType) => (
                  <label key={calcType} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={calcTypeFilters.includes(calcType)}
                      onChange={() => toggleFilterValue(calcType, calcTypeFilters, setCalcTypeFilters)}
                    />
                    <span>{CALC_TYPE_LABELS[calcType] ?? calcType}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {OPINIONS_I18N_RU.opinions.filters.dataType}
              </div>
              <div className="flex flex-wrap gap-2">
                {optionData.dataTypes.map((dataType) => (
                  <label key={dataType} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={dataTypeFilters.includes(dataType)}
                      onChange={() => toggleFilterValue(dataType, dataTypeFilters, setDataTypeFilters)}
                    />
                    <span>{DATA_TYPE_LABELS[dataType]}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-6 text-sm">
              <div className="flex items-center gap-2">
                <Switch checked={showDeprecated} onChange={(e) => setShowDeprecated(e.target.checked)} />
                <span>{OPINIONS_I18N_RU.opinions.filters.showDeprecated}</span>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} />
                <span>{OPINIONS_I18N_RU.opinions.filters.onlySelected}</span>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={resetFilters}>
                {OPINIONS_I18N_RU.opinions.filters.reset}
              </Button>
            </div>
          </div>
        </details>
        <div className="flex-1 min-h-0 overflow-y-auto grid gap-4 pr-2">
          {methods.length === 0 ? (
            <div className="text-sm text-muted-foreground">{OPINIONS_I18N_RU.opinions.empty.noMethods}</div>
          ) : groupedMethods.length === 0 ? (
            <div className="text-sm text-muted-foreground">{OPINIONS_I18N_RU.opinions.empty.noResults}</div>
          ) : (
            groupedMethods.map((group) => (
              <div key={group.key} className="space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">{group.label}</div>
                <div className="grid gap-2">
                  {group.items.map((method) => {
                    const category = method.category ?? getGroupName(method.id);
                    const categoryLabel = labelForCategory(category);
                    const authors = extractAuthors(method);
                    const authorPrimary = resolveAuthorPrimary(method, authors);
                    const isBaalHatanya =
                      authorPrimary === 'Baal HaTanya' ||
                      authors.includes('Baal HaTanya') ||
                      /(baal|баал)/i.test(method.attribution ?? '');
                    const isDeprecated = Boolean(method.deprecated);
                    const isCore = defaultSet.includes(method.id);
                    const label = method.menu_ru ?? humanizeMethod(method.id);
                    const attributionLabel = method.attribution
                      ? method.attribution
                      : authors.length > 0
                        ? authors.map((author) => formatAuthorLabel(author)).join(', ')
                        : '';
                    return (
                      <div
                        key={method.id}
                        ref={(el) => {
                          if (el) rowRefs.current.set(method.id, el);
                        }}
                        className={`flex items-start gap-2 text-sm border border-border/40 rounded-lg px-3 py-2 hover:bg-muted/40 ${
                          highlightedId === method.id ? 'ring-1 ring-primary/60 bg-primary/5' : ''
                        }`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setActiveMethodId(method.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            setActiveMethodId(method.id);
                          }
                        }}
                      >
                        <input
                          type="checkbox"
                          className="accent-primary"
                          checked={selected.includes(method.id)}
                          onChange={() => toggleMethod(method.id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <div className="flex-1">
                          <div>{label}</div>
                          <div className="text-xs text-muted-foreground">{attributionLabel || '—'}</div>
                          <div className="mt-2 flex flex-wrap items-center gap-1">
                            <Badge variant="outline">{DATA_TYPE_LABELS[method.type]}</Badge>
                            {isCore ? (
                              <Badge variant="secondary">{OPINIONS_I18N_RU.opinions.badges.core}</Badge>
                            ) : null}
                            {isBaalHatanya ? (
                              <Badge variant="secondary">{OPINIONS_I18N_RU.opinions.badges.chabad}</Badge>
                            ) : null}
                            {isDeprecated ? (
                              <Badge variant="destructive">{OPINIONS_I18N_RU.opinions.badges.deprecated}</Badge>
                            ) : null}
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 rounded-full border border-border/60 p-0"
                              aria-label={OPINIONS_I18N_RU.opinions.buttons.details}
                              title={OPINIONS_I18N_RU.opinions.buttons.details}
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveMethodId(method.id);
                              }}
                            >
                              ?
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
      <Dialog open={Boolean(activeMethod)} onOpenChange={(open) => !open && setActiveMethodId(null)}>
        {activeMethod ? (
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{activeMethod.title_ru ?? activeMethod.menu_ru ?? humanizeMethod(activeMethod.id)}</DialogTitle>
              <DialogDescription>
                {labelForCategory(activeMethod.category ?? '')}
                {activeMethod.category ? ' · ' : ''}
                {(() => {
                  const authors = extractAuthors(activeMethod);
                  const primary = resolveAuthorPrimary(activeMethod, authors);
                  return primary ? formatAuthorLabel(primary) : '';
                })()}
                {activeMethod.deprecated ? ` · ${OPINIONS_I18N_RU.opinions.detail.statusDeprecated}` : ''}
              </DialogDescription>
            </DialogHeader>
            {activeMethod.deprecated ? (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {activeMethod.deprecated_ru || OPINIONS_I18N_RU.opinions.detail.statusDeprecated}
              </div>
            ) : null}
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {OPINIONS_I18N_RU.opinions.detail.status}
                </div>
                <div>
                  {activeMethod.deprecated
                    ? OPINIONS_I18N_RU.opinions.detail.statusDeprecated
                    : OPINIONS_I18N_RU.opinions.detail.statusActive}
                </div>
              </div>
              {activeMethod.what_is_it_ru ? (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {OPINIONS_I18N_RU.opinions.detail.whatIsIt}
                  </div>
                  <div>{activeMethod.what_is_it_ru}</div>
                </div>
              ) : null}
              {activeMethod.how_calculated_ru ? (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {OPINIONS_I18N_RU.opinions.detail.howCalculated}
                  </div>
                  <div>{activeMethod.how_calculated_ru}</div>
                </div>
              ) : null}
              {activeMethod.bounds_ru?.start_ru || activeMethod.bounds_ru?.end_ru ? (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {OPINIONS_I18N_RU.opinions.detail.bounds}
                  </div>
                  <div>
                    {activeMethod.bounds_ru?.start_ru ? activeMethod.bounds_ru.start_ru : ''}
                    {activeMethod.bounds_ru?.start_ru && activeMethod.bounds_ru?.end_ru ? ' → ' : ''}
                    {activeMethod.bounds_ru?.end_ru ? activeMethod.bounds_ru.end_ru : ''}
                  </div>
                </div>
              ) : null}
              {activeMethod.returns
                ? (() => {
                    const returnType = activeMethod.returns?.type ?? activeMethod.type;
                    const returnTypeLabel =
                      (DATA_TYPE_LABELS as Record<string, string>)[returnType as string] ??
                      String(returnType ?? '');
                    const unit = activeMethod.returns?.unit_ru ? ` (${activeMethod.returns.unit_ru})` : '';
                    return (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          {OPINIONS_I18N_RU.opinions.detail.returns}
                        </div>
                        <div>
                          {activeMethod.returns?.meaning_ru || returnTypeLabel}
                          {unit}
                        </div>
                        {activeMethod.returns?.error_ru ? (
                          <div className="text-xs text-muted-foreground">{activeMethod.returns.error_ru}</div>
                        ) : null}
                      </div>
                    );
                  })()
                : null}
              {activeMethod.attribution
                ? (() => {
                    const authors = extractAuthors(activeMethod)
                      .map((author) => formatAuthorLabel(author))
                      .join(', ');
                    return (
                      <div>
                        <div className="text-xs uppercase tracking-wider text-muted-foreground">
                          {OPINIONS_I18N_RU.opinions.detail.attribution}
                        </div>
                        <div>{activeMethod.attribution}</div>
                        {authors ? <div className="text-xs text-muted-foreground">{authors}</div> : null}
                      </div>
                    );
                  })()
                : null}
              {activeMethod.category ? (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground">
                    {OPINIONS_I18N_RU.opinions.detail.practical}
                  </div>
                  <div>{PRACTICAL_MEANING_RU[activeMethod.category] || '—'}</div>
                </div>
              ) : null}
              <div>
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  {OPINIONS_I18N_RU.opinions.detail.core}
                </div>
                <div>
                  {defaultSet.includes(activeMethod.id)
                    ? OPINIONS_I18N_RU.opinions.detail.coreYes
                    : OPINIONS_I18N_RU.opinions.detail.coreNo}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              <Button type="button" onClick={() => toggleMethod(activeMethod.id)}>
                {selected.includes(activeMethod.id)
                  ? OPINIONS_I18N_RU.opinions.buttons.deselect
                  : OPINIONS_I18N_RU.opinions.buttons.select}
              </Button>
              <Button type="button" variant="secondary" onClick={() => handleCopyLink(activeMethod.id)}>
                {OPINIONS_I18N_RU.opinions.buttons.copyLink}
                {copyState === 'success' ? ' ✓' : copyState === 'error' ? ' ✕' : ''}
              </Button>
              <Button type="button" variant="secondary" onClick={() => highlightRow(activeMethod.id)}>
                {OPINIONS_I18N_RU.opinions.buttons.showInList}
              </Button>
              {activeMethod.deprecated ? (
                <Button type="button" variant="outline" onClick={() => showSimilar(activeMethod)}>
                  {OPINIONS_I18N_RU.opinions.buttons.showSimilar}
                </Button>
              ) : null}
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </Card>
  );
}
