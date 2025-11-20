import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AnimatePresence, motion } from 'framer-motion';
import clsx from 'clsx';
import { X } from 'lucide-react';

import { useTheme } from '../../theme-provider';
import CategorySidebar from './components/CategorySidebar';
import CurrentLocationPanel from './components/CurrentLocationPanel';
import GlobalSearchBar from './components/GlobalSearchBar';
import BreadcrumbTrail from './components/BreadcrumbTrail';
import MishnahSectionSelector from './components/MishnahSectionSelector';
import HalakhahSectionSelector from './components/HalakhahSectionSelector';
import HalakhahVerseGrid from './components/HalakhahVerseGrid';
import BookList from './components/BookList';
import BookHeader from './components/BookHeader';
import ChapterGrid from './components/ChapterGrid';
import ParashaList from './components/ParashaList';
import TanakhSectionPanel from './components/TanakhSectionPanel';
import ComingSoonPanel from './components/ComingSoonPanel';
import TalmudSectionPanel from './components/TalmudSectionPanel';
import useFocusNavData from './hooks/useFocusNavData';
import useTanakhCollections from './hooks/useTanakhCollections';
import useBookData from './hooks/useBookData';
import useFocusNavShortcuts from './hooks/useFocusNavShortcuts';
import { buildTanakhBreadcrumbs, resolveTanakhSection } from './utils/tanakh';
import { findTanakhEntry, parseTanakhReference } from './utils/tanakhReference';
import { SECTION_VARIANTS, ITEM_VARIANTS } from './variants';
import { getChapterSizesForWork } from '../../../lib/sefariaShapeCache';
import type { Catalog, CatalogWork } from '../../../lib/sefariaCatalog';
import { getWorkDisplayTitle } from './utils/catalogWork';
import type {
  BookAliyah,
  BookParasha,
  BookTab,
  CorpusCategory,
  CurrentLocation,
  MishnahSection,
  RootSection,
  TanakhBookEntry,
  TanakhSection,
  TalmudEdition,
  TalmudSeder,
} from './types';
import { TALMUD_SEDER_LABELS, TALMUD_SEDER_ORDER_BAVLI, TALMUD_SEDER_ORDER_YERUSHALMI } from './constants';

interface FocusNavOverlayProps {
  open: boolean;
  onClose: () => void;
  onSelectRef: (ref: string) => void;
  currentRef?: string;
}

const CATEGORY_STRUCTURE: CorpusCategory[] = [
  {
    id: 'written-torah',
    label: 'Письменная Тора',
    icon: '📜',
    corpora: [
      {
        id: 'Tanakh',
        label: 'Танах',
        children: [
          { id: 'tanakh-torah', label: 'Тора', section: 'Torah' },
          { id: 'tanakh-neviim', label: 'Пророки', section: 'Neviim' },
          { id: 'tanakh-ketuvim', label: 'Писания', section: 'Ketuvim' },
        ],
      },
    ],
  },
  {
    id: 'oral-torah',
    label: 'Устная Тора',
    icon: '🗣',
    corpora: [
      { id: 'Mishnah', label: 'Мишна' },
      { id: 'Talmud', label: 'Талмуд' },
    ],
    defaultExpanded: true,
  },
  {
    id: 'halakhah',
    label: 'Галаха и респонсы',
    icon: '⚖️',
    corpora: [
      { id: 'Halakhah', label: 'Галаха' },
      { id: 'Responsa', label: 'Респонсы' },
    ],
  },
  {
    id: 'spiritual-teachings',
    label: 'Духовные учения',
    icon: '✨',
    corpora: [
      { id: 'Chasidut', label: 'Хасидут' },
      { id: 'Musar', label: 'Мусар' },
      { id: 'Jewish Thought', label: 'Еврейская мысль' },
    ],
  },
  {
    id: 'mysticism',
    label: 'Мистицизм',
    icon: '🌌',
    corpora: [{ id: 'Kabbalah', label: 'Каббала' }],
  },
  {
    id: 'liturgy-midrash',
    label: 'Литургия и мидраши',
    icon: '🕯',
    corpora: [
      { id: 'Liturgy', label: 'Литургия' },
      { id: 'Midrash', label: 'Мидраш' },
      { id: 'Reference', label: 'Справочники' },
    ],
  },
  {
    id: 'history',
    label: 'История и культура',
    icon: '📚',
    corpora: [
      { id: 'Second Temple', label: 'Период Второго Храма' },
      { id: 'Tosefta', label: 'Тосефта' },
    ],
  },
];

const CORPUS_TO_ROOT_SECTION: Record<string, RootSection> = {
  Tanakh: 'Tanakh',
  Mishnah: 'Mishnah',
  Talmud: 'Talmud',
  Halakhah: 'Halakha',
};

const ROOT_SECTION_TO_CORPUS: Record<RootSection, string> = {
  Tanakh: 'Tanakh',
  Mishnah: 'Mishnah',
  Talmud: 'Talmud',
  Halakha: 'Halakhah',
};

const TALMUD_SEDARIM_SET = new Set<TalmudSeder>([
  ...TALMUD_SEDER_ORDER_BAVLI,
  ...TALMUD_SEDER_ORDER_YERUSHALMI,
]);

const HALAKHAH_ROOT_LABEL = 'Галаха';
const HALAKHAH_SECTION_ORDER = ['Mishneh Torah', 'Shulchan Arukh', 'Kitzur Shulchan Arukh'];
const HALAKHAH_SUBSECTION_ORDER: Record<string, string[]> = {
  'Mishneh Torah': [
    'Introduction',
    'Sefer Madda',
    'Sefer Ahavah',
    'Sefer Zemanim',
    'Sefer Nashim',
    'Sefer Kedushah',
    'Sefer Haflaah',
    'Sefer Zeraim',
    'Sefer Avodah',
    'Sefer Korbanot',
    'Sefer Taharah',
    'Sefer Nezikim',
    'Sefer Kinyan',
    'Sefer Mishpatim',
    'Sefer Shoftim',
  ],
  'Shulchan Arukh': [
    'Shulchan_Arukh_Orach_Chayim',
    'Shulchan_Arukh_Yoreh_Deah',
    'Shulchan_Arukh_Choshen_Mishpat',
  ],
  'Kitzur Shulchan Arukh': ['Kitzur_Shulchan_Arukh'],
};
const HALAKHAH_SUBSECTION_LABEL_OVERRIDES: Record<string, Record<string, string>> = {
  'Shulchan Arukh': {
    Shulchan_Arukh_Orach_Chayim: 'Orach Chayim',
    Shulchan_Arukh_Yoreh_Deah: 'Yoreh Deah',
    Shulchan_Arukh_Choshen_Mishpat: 'Choshen Mishpat',
  },
  'Kitzur Shulchan Arukh': {
    Kitzur_Shulchan_Arukh: 'Kitzur Shulchan Arukh',
  },
};

interface HalakhahSubsection {
  id: string;
  label: string;
  works: CatalogWork[];
}

interface HalakhahSectionData {
  id: string;
  label: string;
  subsections: HalakhahSubsection[];
}

function formatSegmentLabel(value: string): string {
  return value.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
}

function slugFromWork(work: CatalogWork): string | null {
  if (!work.path) {
    return null;
  }
  const segments = work.path.split('/').filter(Boolean);
  if (!segments.length) {
    return null;
  }
  return segments[segments.length - 1].toLowerCase().replace(/_/g, '-');
}

function createHalakhahEntry(work: CatalogWork): TanakhBookEntry {
  const slug = slugFromWork(work) ?? work.title.toLowerCase().replace(/\s+/g, '-');
  return {
    seed: {
      slug,
      indexTitle: work.title,
      short_en: work.seedShorts?.short_en,
      short_ru: work.seedShorts?.short_ru,
      title_he: work.primaryTitles?.he,
      title_ru: work.primaryTitles?.ru,
    },
    work,
  };
}

function getHalakhahSubsectionLabel(sectionId: string, subsectionId: string): string {
  const sectionOverrides = HALAKHAH_SUBSECTION_LABEL_OVERRIDES[sectionId];
  if (sectionOverrides && subsectionId in sectionOverrides) {
    return sectionOverrides[subsectionId];
  }

  if (!subsectionId || subsectionId === sectionId) {
    return formatSegmentLabel(sectionId);
  }

  const normalizedSection = sectionId.replace(/\s+/g, '_');
  const prefixPattern = new RegExp(`^${normalizedSection}[_-]?`, 'i');
  const trimmed = subsectionId.replace(prefixPattern, '');
  if (trimmed && trimmed !== subsectionId) {
    return formatSegmentLabel(trimmed);
  }

  return formatSegmentLabel(subsectionId);
}

function sortHalakhahSubsections(sectionId: string, subsections: HalakhahSubsection[]): HalakhahSubsection[] {
  const order = HALAKHAH_SUBSECTION_ORDER[sectionId] ?? [];
  return [...subsections].sort((a, b) => {
    const indexA = order.indexOf(a.id);
    const indexB = order.indexOf(b.id);
    if (indexA !== -1 || indexB !== -1) {
      if (indexA === -1) {
        return 1;
      }
      if (indexB === -1) {
        return -1;
      }
      return indexA - indexB;
    }
    return a.label.localeCompare(b.label, 'ru');
  });
}

function buildHalakhahSections(catalog: Catalog | null): HalakhahSectionData[] {
  if (!catalog) {
    return [];
  }

  const sections = new Map<string, Map<string, CatalogWork[]>>();

  catalog.works.forEach((work) => {
    if (!work.categories.includes('Halakhah')) {
      return;
    }
    if (!work.path) {
      return;
    }
    const segments = work.path.split('/').filter(Boolean);
    if (segments.length < 3) {
      return;
    }
    const sectionId = segments[2];
    const subsectionId = segments[3] ?? sectionId;
    const sectionMap = sections.get(sectionId) ?? new Map<string, CatalogWork[]>();
    sections.set(sectionId, sectionMap);
    const works = sectionMap.get(subsectionId) ?? [];
    works.push(work);
    sectionMap.set(subsectionId, works);
  });

  const sectionData = Array.from(sections.entries()).map(([sectionId, subsectionMap]) => {
    const subsections = Array.from(subsectionMap.entries()).map(([subId, works]) => ({
      id: subId,
      label: getHalakhahSubsectionLabel(sectionId, subId),
      works: works.slice().sort((a, b) => a.title.localeCompare(b.title, 'ru')),
    }));
    return {
      id: sectionId,
      label: formatSegmentLabel(sectionId),
      subsections: sortHalakhahSubsections(sectionId, subsections),
    };
  });

  return sectionData.sort((a, b) => {
    const indexA = HALAKHAH_SECTION_ORDER.indexOf(a.id);
    const indexB = HALAKHAH_SECTION_ORDER.indexOf(b.id);
    if (indexA !== -1 || indexB !== -1) {
      if (indexA === -1) {
        return 1;
      }
      if (indexB === -1) {
        return -1;
      }
      return indexA - indexB;
    }
    return a.label.localeCompare(b.label, 'ru');
  });
}

function extractTalmudSeder(work: CatalogWork): TalmudSeder | null {
  const sederCategory = work.categories.find((category) => category.startsWith('Seder '));
  if (!sederCategory) {
    return null;
  }
  const name = sederCategory.slice('Seder '.length) as TalmudSeder;
  return TALMUD_SEDARIM_SET.has(name) ? name : null;
}

function isSameCatalogWork(a: CatalogWork | null, b: CatalogWork | null): boolean {
  if (!a || !b) {
    return false;
  }
  if (a.path && b.path) {
    return a.path === b.path;
  }
  return a.title === b.title;
}

function FocusNavOverlay({
  open,
  onClose,
  onSelectRef,
  currentRef,
}: FocusNavOverlayProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();

  useFocusNavShortcuts({ open, overlayRef, onClose });

  const {
    catalog,
    loadingCatalog,
    catalogError,
    manifest,
    loadingManifest,
    manifestError,
    tanakhSeed,
    loadingTanakhSeed,
    loadingExtraCategory,
    isCategoryLoaded,
    loadExtraCategory,
  } = useFocusNavData(open);

  const [activeCorpus, setActiveCorpus] = useState<string | null>(null);
  const [talmudEdition, setTalmudEdition] = useState<TalmudEdition>('Bavli');
  const [talmudSeder, setTalmudSeder] = useState<TalmudSeder | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [didInitFromRef, setDidInitFromRef] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [locationNav, setLocationNav] = useState<{ prev?: string; next?: string } | null>(null);
  const [locationChapterSizes, setLocationChapterSizes] = useState<number[] | null>(null);
  const [rootSection, setRootSection] = useState<RootSection | null>(null);
  const [tanakhSection, setTanakhSection] = useState<TanakhSection | null>(null);
  const [mishnahSection, setMishnahSection] = useState<MishnahSection | null>(null);
  const [halakhahSection, setHalakhahSection] = useState<string | null>(null);
  const [halakhahSubsection, setHalakhahSubsection] = useState<string | null>(null);
  const [expandedHalakhahSubsections, setExpandedHalakhahSubsections] = useState<string[]>([]);
  const [selectedBook, setSelectedBook] = useState<TanakhBookEntry | null>(null);
  const [bookTab, setBookTab] = useState<BookTab>('chapters');
  const [activeChapter, setActiveChapter] = useState<number | null>(null);
  const [selectedTractate, setSelectedTractate] = useState<CatalogWork | null>(null);
  const [selectedHalakhahContext, setSelectedHalakhahContext] = useState<{
    sectionLabel: string;
    subsectionLabel?: string;
  } | null>(null);
  const [halakhahVerse, setHalakhahVerse] = useState<number | null>(null);
  const halakhahBreadcrumbBase = useMemo(() => {
    if (!selectedBook || !selectedBook.work.categories.includes('Halakhah')) {
      return null;
    }
    const crumbs = [HALAKHAH_ROOT_LABEL];
    if (selectedHalakhahContext?.sectionLabel) {
      crumbs.push(selectedHalakhahContext.sectionLabel);
    }
    if (selectedHalakhahContext?.subsectionLabel) {
      crumbs.push(selectedHalakhahContext.subsectionLabel);
    }
    crumbs.push(getWorkDisplayTitle(selectedBook.work));
    return crumbs;
  }, [selectedBook, selectedHalakhahContext]);

  const {
    data: bookData,
    loading: loadingBook,
    error: bookError,
  } = useBookData(selectedBook);
  const hasParasha = !!(bookData && 'parshiot' in bookData && bookData.parshiot.length > 0);
  const isHalakhahSelectedBook =
    !!selectedBook && selectedBook.work.categories.includes('Halakhah');
  const halakhahVerseCount =
    isHalakhahSelectedBook && activeChapter && bookData?.chapterSizes
      ? bookData.chapterSizes[activeChapter - 1] ?? 0
      : 0;

  const talmudStructure = useMemo(() => {
    const empty = {
      order: [] as TalmudSeder[],
      map: {} as Partial<Record<TalmudSeder, CatalogWork[]>>,
    };
    if (!catalog) {
      return empty;
    }

    const map: Partial<Record<TalmudSeder, CatalogWork[]>> = {};

    catalog.works.forEach((work) => {
      if (!work.categories.includes('Talmud') || !work.categories.includes(talmudEdition)) {
        return;
      }
      const seder = extractTalmudSeder(work);
      if (!seder) {
        return;
      }
      if (!map[seder]) {
        map[seder] = [];
      }
      map[seder]!.push(work);
    });

    Object.values(map).forEach((list) => {
      if (list) {
        list.sort((a, b) => a.title.localeCompare(b.title, 'en'));
      }
    });

    const baseOrder =
      talmudEdition === 'Yerushalmi'
        ? TALMUD_SEDER_ORDER_YERUSHALMI
        : TALMUD_SEDER_ORDER_BAVLI;
    const order = baseOrder.filter((seder) => (map[seder]?.length ?? 0) > 0);

    return { order, map };
  }, [catalog, talmudEdition]);

  useEffect(() => {
    if (!open) {
      setRootSection(null);
      setTanakhSection(null);
      setMishnahSection(null);
      setSelectedBook(null);
      setHalakhahSection(null);
      setHalakhahSubsection(null);
      setSelectedHalakhahContext(null);
      setHalakhahVerse(null);
      setBookTab('chapters');
      setSelectedTractate(null);
      setTalmudEdition('Bavli');
      setTalmudSeder(null);
      setActiveCorpus(null);
      setSearchQuery('');
      setBreadcrumbs([]);
      setCurrentLocation(null);
      setLocationNav(null);
      setActiveChapter(null);
      setDidInitFromRef(false);
    }
  }, [open]);

  useEffect(() => {
    const { order, map } = talmudStructure;
    const editionLabel = talmudEdition === 'Bavli' ? 'Бавли' : 'Иерушалми';

    if (!order.length) {
      if (talmudSeder !== null) {
        setTalmudSeder(null);
      }
      if (selectedTractate) {
        setSelectedTractate(null);
      }
      setBreadcrumbs(['Талмуд', editionLabel]);
      return;
    }

    const desiredSeder =
      talmudSeder && map[talmudSeder]?.length ? talmudSeder : order[0];

    if (desiredSeder !== talmudSeder) {
      setTalmudSeder(desiredSeder);
      setSelectedTractate(null);
      setCurrentLocation(null);
      setLocationNav(null);
      setBreadcrumbs(['Талмуд', editionLabel, TALMUD_SEDER_LABELS[desiredSeder]]);
      return;
    }

    const tractates = map[desiredSeder] ?? [];
    if (!tractates.length) {
      if (selectedTractate) {
        setSelectedTractate(null);
      }
      setBreadcrumbs(['Талмуд', editionLabel, TALMUD_SEDER_LABELS[desiredSeder]]);
      return;
    }

    const hasSelected =
      selectedTractate &&
      tractates.some((work) => isSameCatalogWork(work, selectedTractate));

    if (!hasSelected) {
      const fallback = tractates[0]!;
      setSelectedTractate(fallback);
      setCurrentLocation(null);
      setLocationNav(null);
      setBreadcrumbs([
        'Талмуд',
        editionLabel,
        TALMUD_SEDER_LABELS[desiredSeder],
        getWorkDisplayTitle(fallback),
      ]);
      return;
    }
  }, [talmudStructure, talmudSeder, selectedTractate, talmudEdition]);
  useEffect(() => {
    if (!selectedTractate) {
      return;
    }
    const editionLabel = talmudEdition === 'Bavli' ? 'Бавли' : 'Иерушалми';
    const crumbs = ['Талмуд', editionLabel];
    if (talmudSeder) {
      crumbs.push(TALMUD_SEDER_LABELS[talmudSeder]);
    }
    crumbs.push(getWorkDisplayTitle(selectedTractate));
    setBreadcrumbs(crumbs);
  }, [selectedTractate, talmudEdition, talmudSeder]);

  useEffect(() => {
    if (!open || !rootSection) {
      return;
    }
    const mapped = ROOT_SECTION_TO_CORPUS[rootSection];
    if (mapped && mapped !== activeCorpus) {
      setActiveCorpus(mapped);
    }
  }, [open, rootSection, activeCorpus]);

  useEffect(() => {
    if (!activeCorpus) {
      return;
    }
    const mapped = CORPUS_TO_ROOT_SECTION[activeCorpus];
    if (mapped && mapped !== rootSection) {
      setRootSection(mapped);
    }
  }, [activeCorpus, rootSection]);

  const prepareForBook = useCallback((book: TanakhBookEntry) => {
    setSelectedBook(book);
    setBookTab('chapters');
    setActiveChapter(null);
    setHalakhahVerse(null);
    setCurrentLocation(null);
    setLocationNav(null);
    if (!book.work.categories.includes('Halakhah')) {
      setSelectedHalakhahContext(null);
    }
  }, []);

  const handleBookSelect = useCallback(
    (book: TanakhBookEntry) => {
      prepareForBook(book);
      const section = tanakhSection ?? resolveTanakhSection(book);
      setBreadcrumbs(buildTanakhBreadcrumbs(section, book, undefined));
    },
    [prepareForBook, tanakhSection],
  );

  const handleHalakhahWorkSelect = useCallback(
    (book: TanakhBookEntry, sectionLabel: string, subsectionLabel: string | null) => {
      prepareForBook(book);
      setSelectedHalakhahContext({
        sectionLabel,
        subsectionLabel: subsectionLabel ?? undefined,
      });
      const crumbs = [HALAKHAH_ROOT_LABEL, sectionLabel];
      if (subsectionLabel) {
        crumbs.push(subsectionLabel);
      }
      crumbs.push(getWorkDisplayTitle(book.work));
      setBreadcrumbs(crumbs);
    },
    [prepareForBook],
  );

  useEffect(() => {
    if (bookTab === 'parasha' && !hasParasha) {
      setBookTab('chapters');
    }
  }, [bookTab, hasParasha]);

  const handleChapterSelect = useCallback((chapter: number) => {
    if (!selectedBook) {
      return;
    }
    setActiveChapter(chapter);

    const isMishnahBook = selectedBook.work.categories.includes('Mishnah');
    const isHalakhahBook = selectedBook.work.categories.includes('Halakhah');
    let ref: string;

    const lastVerse = bookData?.chapterSizes?.[chapter - 1] ?? 1;

    if (isHalakhahBook) {
      setHalakhahVerse(null);
      const crumbsBase =
        halakhahBreadcrumbBase ??
        [HALAKHAH_ROOT_LABEL, getWorkDisplayTitle(selectedBook.work)];
      const chapterRef = `${selectedBook.seed.indexTitle} ${chapter}`;
      const startRef = `${chapterRef}:1`;
      setBreadcrumbs([...crumbsBase, `Симан ${chapter}`]);
      setCurrentLocation({
        type: 'tanakh',
        book: selectedBook,
        chapter,
        verse: 1,
        ref: startRef,
      });
      onSelectRef(chapterRef);
      onClose();
      return;
    }

    if (isMishnahBook) {
      const rangeRef = `${selectedBook.seed.indexTitle} ${chapter}:1-${chapter}:${lastVerse}`;
      ref = rangeRef;
      const startRef = `${selectedBook.seed.indexTitle} ${chapter}:1`;
      setCurrentLocation({
        type: 'tanakh',
        book: selectedBook,
        chapter,
        verse: 1,
        ref: startRef,
      });
      const crumbs = ['?????', selectedBook.work.title ?? selectedBook.seed.indexTitle];
      if (mishnahSection) {
        crumbs.splice(1, 0, getMishnahSectionLabel(mishnahSection));
      }
      setBreadcrumbs(crumbs);
    } else {
      ref = `${selectedBook.seed.indexTitle} ${chapter}:1-${chapter}:${lastVerse}`;
      const section = tanakhSection ?? resolveTanakhSection(selectedBook);
      setBreadcrumbs(buildTanakhBreadcrumbs(section, selectedBook, chapter));
      setCurrentLocation({
        type: 'tanakh',
        book: selectedBook,
        chapter,
        verse: 1,
        ref,
      });
    }

    onSelectRef(ref);
    onClose();
  }, [selectedBook, bookData, tanakhSection, mishnahSection, halakhahBreadcrumbBase, onSelectRef, onClose]);

  const handleAliyahSelect = useCallback((aliyah: BookAliyah) => {
    onSelectRef(aliyah.ref);
    onClose();
  }, [onSelectRef, onClose]);

  const handleParashaSelect = useCallback((parasha: BookParasha) => {
    onSelectRef(parasha.wholeRef);
    onClose();
  }, [onSelectRef, onClose]);

  const handleHalakhahVerseSelect = useCallback(
    (verse: number) => {
      if (!selectedBook || !activeChapter) {
        return;
      }
      const ref = `${selectedBook.seed.indexTitle} ${activeChapter}:${verse}`;
      setHalakhahVerse(verse);
      const crumbsBase =
        halakhahBreadcrumbBase ??
        [HALAKHAH_ROOT_LABEL, getWorkDisplayTitle(selectedBook.work)];
      setBreadcrumbs([...crumbsBase, `Симан ${activeChapter}`, `Сеф ${verse}`]);
      setCurrentLocation({
        type: 'tanakh',
        book: selectedBook,
        chapter: activeChapter,
        verse,
        ref,
      });
      onSelectRef(ref);
      onClose();
    },
    [selectedBook, activeChapter, halakhahBreadcrumbBase, onSelectRef, onClose],
  );

  const shouldRenderBookPanel =
    !!selectedBook && (Boolean(bookData) || loadingBook || Boolean(bookError));
  const shouldInlineHalakhahPanel =
    shouldRenderBookPanel && rootSection === 'Halakha' && isHalakhahSelectedBook;
  const bookPanelClassName = clsx(
    'rounded-2xl border p-5 shadow-lg backdrop-blur-xl w-full',
    theme === 'dark'
      ? 'border-white/10 bg-white/10 shadow-black/25'
      : 'border-gray-200 bg-white/20 shadow-gray-200/25',
  );
  const bookDetailContent = shouldRenderBookPanel ? (
    <>
      <Suspense fallback={null}>
        <BookHeader
          book={selectedBook as TanakhBookEntry}
          activeTab={bookTab}
          onTabChange={setBookTab}
          loading={loadingBook}
          error={bookError}
          isMishnah={selectedBook?.work.categories.includes('Mishnah')}
          hasParasha={hasParasha}
          theme={theme}
        />
      </Suspense>

      {loadingBook && (
        <div
          className={clsx(
            'rounded-xl border px-4 py-6 text-sm text-center',
            theme === 'dark'
              ? 'border-white/10 bg-white/5 text-white/80'
              : 'border-gray-200 bg-white text-gray-700',
          )}
        >
          Загружаем структуру книги…
        </div>
      )}

      {!loadingBook && bookError && (
        <div
          className={clsx(
            'rounded-xl border px-4 py-6 text-sm text-center',
            theme === 'dark'
              ? 'border-red-400/60 bg-red-500/10 text-red-200'
              : 'border-red-300 bg-red-50 text-red-700',
          )}
        >
          {bookError}
        </div>
      )}

      {!loadingBook && !bookError && bookData && (
        <>
          {bookTab === 'chapters' && 'chapterSizes' in bookData && (
            <Suspense fallback={null}>
              <ChapterGrid
                chapterSizes={bookData.chapterSizes}
                onSelect={handleChapterSelect}
                isLoading={loadingBook}
                activeChapter={activeChapter}
                theme={theme}
              />
            </Suspense>
          )}
          {bookTab === 'chapters' &&
            isHalakhahSelectedBook &&
            activeChapter &&
            halakhahVerseCount > 0 && (
              <HalakhahVerseGrid
                chapter={activeChapter}
                verseCount={halakhahVerseCount}
                onSelect={handleHalakhahVerseSelect}
                activeVerse={halakhahVerse}
                theme={theme}
              />
            )}

          {bookTab === 'parasha' && 'parshiot' in bookData && bookData.parshiot.length > 0 && (
            <Suspense fallback={null}>
              <ParashaList
                parshiot={bookData.parshiot}
                onSelectParasha={handleParashaSelect}
                onSelectAliyah={handleAliyahSelect}
                isLoading={loadingBook}
                theme={theme}
              />
            </Suspense>
          )}

          {bookTab === 'parasha' && 'parshiot' in bookData && bookData.parshiot.length === 0 && (
            <div
              className={clsx(
                'rounded-xl border px-4 py-4 text-sm text-center',
                theme === 'dark'
                  ? 'border-white/10 bg-white/5 text-white/70'
                  : 'border-gray-200 bg-gray-50 text-gray-600',
              )}
            >
              Для этой книги нет структурированных данных по парашам.
            </div>
          )}
        </>
      )}
    </>
  ) : null;

  const handleTalmudEditionChange = useCallback((edition: TalmudEdition) => {
    setTalmudEdition(edition);
    setTalmudSeder(null);
    setSelectedTractate(null);
    setCurrentLocation(null);
    setLocationNav(null);
    setBreadcrumbs(['Талмуд', edition === 'Bavli' ? 'Бавли' : 'Иерушалми']);
  }, []);

  const handleTalmudSederSelect = useCallback((seder: TalmudSeder) => {
    setTalmudSeder(seder);
    setSelectedTractate(null);
    setCurrentLocation(null);
    setLocationNav(null);
    setBreadcrumbs(['Талмуд', talmudEdition === 'Bavli' ? 'Бавли' : 'Иерушалми', TALMUD_SEDER_LABELS[seder]]);
  }, [talmudEdition]);

  const handleTalmudTractateSelect = useCallback(
    (tractate: CatalogWork) => {
      setSelectedTractate(tractate);
      setCurrentLocation(null);
      setLocationNav(null);
      setBreadcrumbs([
        'Талмуд',
        talmudEdition === 'Bavli' ? 'Бавли' : 'Иерушалми',
        getWorkDisplayTitle(tractate),
      ]);
    },
    [talmudEdition],
  );
  // removed activeTalmudDaf (no longer used)

  const handleTalmudDafSelect = useCallback((daf: string) => {
    if (!selectedTractate) {
      return;
    }
    const displayTitle = getWorkDisplayTitle(selectedTractate);
    const baseRef = `${selectedTractate.title} ${daf}`;
    setCurrentLocation({
      type: 'talmud',
      tractate: selectedTractate.title,
      tractateDisplay: displayTitle,
      daf,
      edition: talmudEdition,
      ref: baseRef,
    });
    const editionLabel = talmudEdition === 'Bavli' ? 'Бавли' : 'Иерушалми';
    const crumbs = ['Талмуд', editionLabel];
    if (talmudSeder) {
      crumbs.push(TALMUD_SEDER_LABELS[talmudSeder]);
    }
    crumbs.push(displayTitle, `Лист ${daf}`);
    setBreadcrumbs(crumbs);
    onSelectRef(`${baseRef}:1`);
    onClose();
  }, [selectedTractate, talmudEdition, talmudSeder, onSelectRef, onClose]);

  const handleTanakhSectionChange = useCallback((section: TanakhSection) => {
    setTanakhSection(section);
    setSelectedBook(null);
    setCurrentLocation(null);
    setLocationNav(null);
    setBreadcrumbs(buildTanakhBreadcrumbs(section, null, undefined));
  }, []);

  const handleSelectCorpus = useCallback(
    (corpusId: string, options?: { tanakhSection?: TanakhSection }) => {
      setActiveCorpus(corpusId);
      const mappedRoot = CORPUS_TO_ROOT_SECTION[corpusId];
      if (mappedRoot) {
        setRootSection(mappedRoot);
      } else {
        setRootSection(null);
      }

      if (corpusId === 'Tanakh') {
        const targetSection = options?.tanakhSection ?? tanakhSection ?? 'Torah';
        handleTanakhSectionChange(targetSection);
      } else if (corpusId === 'Talmud') {
        handleTalmudEditionChange('Bavli');
      } else if (corpusId === 'Mishnah') {
        setBreadcrumbs(['?????']);
      } else if (corpusId === 'Halakhah') {
        setBreadcrumbs([HALAKHAH_ROOT_LABEL]);
      } else {
        setBreadcrumbs([getCorpusLabel(corpusId)]);
      }

      if (corpusId !== 'Talmud') {
        setTalmudEdition('Bavli');
        setTalmudSeder(null);
      }

      setSelectedBook(null);
      setMishnahSection(null);
      setHalakhahSection(null);
      setHalakhahSubsection(null);
      setSelectedHalakhahContext(null);
      setHalakhahVerse(null);
      setBookTab('chapters');
      if (corpusId !== 'Tanakh') {
        setTanakhSection(null);
      }
      setSelectedTractate(null);
      setCurrentLocation(null);
      setLocationNav(null);
      setSearchQuery('');

      if (manifest && !isCategoryLoaded(corpusId)) {
        const entry = manifest.entries.find((item) => item.category === corpusId);
        if (entry) {
          void loadExtraCategory(entry);
        }
      }
    },
    [
      handleTanakhSectionChange,
      handleTalmudEditionChange,
      isCategoryLoaded,
      loadExtraCategory,
      manifest,
      tanakhSection,
    ],
  );
const handleMishnahSectionChange = useCallback((section: MishnahSection) => {
    setMishnahSection(section);
    setSelectedBook(null);
    setCurrentLocation(null);
    setLocationNav(null);
    setBreadcrumbs(['Мишна', getMishnahSectionLabel(section)]);
  }, []);

  const handleLocationNavigate = useCallback((ref: string) => {
    if (!ref) {
      return;
    }
    onSelectRef(ref);
    onClose();
  }, [onSelectRef, onClose]);

  useEffect(() => {
    if (!currentLocation || currentLocation.type !== 'tanakh') {
      setLocationChapterSizes(null);
      return;
    }
    const path = currentLocation.book.work.path;
    if (!path) {
      setLocationChapterSizes(null);
      return;
    }

    let cancelled = false;
    getChapterSizesForWork(path)
      .then((sizes) => {
        if (!cancelled) {
          setLocationChapterSizes(sizes);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLocationChapterSizes(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [currentLocation]);

  useEffect(() => {
    if (!currentLocation || currentLocation.type !== 'tanakh') {
      setLocationNav(null);
      return;
    }
    const chapterSizes =
      bookData?.chapterSizes?.length ? bookData.chapterSizes : locationChapterSizes;
    if (!chapterSizes?.length) {
      setLocationNav(null);
      return;
    }

    const chapter = currentLocation.chapter;
    const total = chapterSizes.length;
    const bookTitle = currentLocation.book.work.title;
    const prev = chapter > 1 ? `${bookTitle} ${chapter - 1}` : undefined;
    const next = chapter < total ? `${bookTitle} ${chapter + 1}` : undefined;
    setLocationNav(prev || next ? { prev, next } : null);
  }, [currentLocation, bookData, locationChapterSizes]);

  useEffect(() => {
    if (!selectedBook) {
      setActiveChapter(null);
      return;
    }
    if (!currentLocation || currentLocation.type !== 'tanakh') {
      return;
    }
    if (currentLocation.book.work.path && selectedBook.work.path) {
      if (currentLocation.book.work.path === selectedBook.work.path) {
        setActiveChapter(currentLocation.chapter);
      } else {
        setActiveChapter(null);
      }
      return;
    }
    if (currentLocation.book.work.title === selectedBook.work.title) {
      setActiveChapter(currentLocation.chapter);
    }
  }, [selectedBook, currentLocation]);

  const {
    tanakhCollections,
    mishnahCollections,
    tanakhEntries,
  } = useTanakhCollections(catalog, tanakhSeed);

  const halakhahSections = useMemo(
    () => buildHalakhahSections(catalog),
    [catalog],
  );
  const halakhahSectionData = halakhahSections.find((section) => section.id === halakhahSection) ?? null;
  const halakhahSectionItems = halakhahSections.map((section) => ({
    id: section.id,
    label: section.label,
  }));
  const halakhahSectionLabel = halakhahSectionData?.label ?? halakhahSectionItems[0]?.label ?? '';
  const expandHalakhahSection = useCallback(
    (sectionId: string) => {
      const sectionData = halakhahSections.find((section) => section.id === sectionId);
      if (!sectionData?.subsections.length) {
        setExpandedHalakhahSubsections((prev) => (prev.length ? [] : prev));
        setHalakhahSubsection((prev) => (prev !== null ? null : prev));
        return;
      }
      const subsectionIds = sectionData.subsections.map((subsection) => subsection.id);
      const defaultOpen =
        sectionData.id === 'Mishneh Torah' ? subsectionIds : subsectionIds.slice(0, 1);
      setExpandedHalakhahSubsections((prev) => {
        const sameLength = prev.length === defaultOpen.length;
        const sameValues = sameLength && prev.every((value, index) => value === defaultOpen[index]);
        return sameValues ? prev : defaultOpen;
      });
      setHalakhahSubsection((prev) => {
        const nextValue = subsectionIds[0] ?? null;
        if (prev && subsectionIds.includes(prev)) {
          return prev;
        }
        return nextValue;
      });
    },
    [halakhahSections],
  );
  const toggleHalakhahSubsection = useCallback((subsectionId: string) => {
    setExpandedHalakhahSubsections((prev) =>
      prev.includes(subsectionId) ? prev.filter((id) => id !== subsectionId) : [...prev, subsectionId],
    );
    setHalakhahSubsection(subsectionId);
  }, []);

  const handleHalakhahSectionChange = useCallback(
    (sectionId: string) => {
      setHalakhahSection(sectionId);
      expandHalakhahSection(sectionId);
      setSelectedBook(null);
      setCurrentLocation(null);
      setLocationNav(null);
    },
    [expandHalakhahSection],
  );

  useEffect(() => {
    if (!tanakhCollections) {
      return;
    }
    if (!tanakhSection) {
      setTanakhSection('Torah');
    }
  }, [tanakhCollections, tanakhSection]);

  useEffect(() => {
    if (!isHalakhahSelectedBook) {
      setHalakhahVerse(null);
    }
  }, [isHalakhahSelectedBook]);

  useEffect(() => {
    if (!mishnahCollections) {
      return;
    }
    if (!mishnahSection && rootSection === 'Mishnah') {
      // Автоматически выбираем первый седер с трактатами
      const sederMap: Record<string, MishnahSection> = {
        zeraim: 'Zeraim',
        moed: 'Moed',
        nashim: 'Nashim',
        nezikin: 'Nezikin',
        kodashim: 'Kodashim',
        taharot: 'Taharot',
      };
      for (const [key, seder] of Object.entries(sederMap)) {
        const collection = mishnahCollections[key as keyof typeof mishnahCollections];
        if (collection && collection.length > 0) {
          setMishnahSection(seder);
          setBreadcrumbs(['Мишна', getMishnahSectionLabel(seder)]);
          break;
        }
      }
    }
  }, [mishnahCollections, mishnahSection, rootSection]);

  useEffect(() => {
    if (rootSection !== 'Halakha' || halakhahSections.length === 0) {
      setExpandedHalakhahSubsections([]);
      setHalakhahSubsection(null);
      setHalakhahSection(null);
      setSelectedHalakhahContext(null);
      setHalakhahVerse(null);
      return;
    }

    const resolvedSection = halakhahSection ?? halakhahSections[0].id;
    if (resolvedSection !== halakhahSection) {
      setHalakhahSection(resolvedSection);
      return;
    }

    expandHalakhahSection(resolvedSection);
  }, [
    rootSection,
    halakhahSections,
    halakhahSection,
    expandHalakhahSection,
  ]);

  useEffect(() => {
    if (rootSection !== 'Halakha') {
      return;
    }
    if (selectedBook) {
      return;
    }
    const sectionData = halakhahSections.find((section) => section.id === halakhahSection);
    if (!sectionData) {
      setBreadcrumbs([HALAKHAH_ROOT_LABEL]);
      return;
    }
    const crumbs = [HALAKHAH_ROOT_LABEL, sectionData.label];
    if (halakhahSubsection) {
      const sub = sectionData.subsections.find((item) => item.id === halakhahSubsection);
      if (sub) {
        crumbs.push(sub.label);
      }
    }
    setBreadcrumbs(crumbs);
  }, [rootSection, selectedBook, halakhahSections, halakhahSection, halakhahSubsection]);

  useEffect(() => {
    if (!open || didInitFromRef) {
      return;
    }
    if (!currentRef) {
      setDidInitFromRef(true);
      return;
    }
    if (!tanakhEntries.length) {
      return;
    }

    const ref = currentRef.trim();
    if (!ref) {
      setDidInitFromRef(true);
      return;
    }

    const tanakhInfo = parseTanakhReference(ref);
    if (tanakhInfo) {
      const entry = findTanakhEntry(tanakhEntries, tanakhInfo.book);
      if (entry) {
        const section = resolveTanakhSection(entry) ?? 'Torah';
        setActiveCorpus('Tanakh');
        if (tanakhSection !== section) {
          setTanakhSection(section);
        }
        setSelectedBook(entry);
        setBookTab('chapters');
        setBreadcrumbs(buildTanakhBreadcrumbs(section, entry, tanakhInfo.chapter));
        setCurrentLocation({
          type: 'tanakh',
          book: entry,
          chapter: tanakhInfo.chapter,
          verse: tanakhInfo.verse,
          ref,
        });
        setDidInitFromRef(true);
        return;
      }
    }

    setDidInitFromRef(true);
  }, [open, didInitFromRef, currentRef, tanakhEntries, tanakhSection]);

  const showInitialLoading = (loadingCatalog || loadingManifest || loadingTanakhSeed) && !catalog;
  const showInitialError = !catalog && (catalogError || manifestError);

  if (showInitialLoading) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-50 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Навигация по библиотеке — загрузка"
          >
            <div
              className={clsx(
                'absolute inset-0 backdrop-blur-sm',
                theme === 'dark' ? 'bg-black/70' : 'bg-black/50',
              )}
            />
            <div
              className={clsx(
                'pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-800/20 via-transparent to-amber-500/25',
                theme === 'dark' ? 'opacity-90' : 'opacity-70',
              )}
            />

            <div className="relative mx-auto flex h-full max-w-none w-full flex-col px-6 py-8">
              <div className="mb-4 flex justify-end">
                <OverlayCloseButton onClose={onClose} theme={theme} />
              </div>
              <div className="relative flex-1 min-h-0 overflow-y-auto">
                <div className="pointer-events-auto relative z-10 mx-auto flex w-full max-w-none flex-col gap-4 pb-16">
                  <motion.section
                    key="loading"
                    variants={SECTION_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className={clsx(
                      'rounded-2xl border p-4 shadow-lg backdrop-blur-lg w-full',
                      theme === 'dark'
                        ? 'border-white/10 bg-white/10 shadow-black/20'
                        : 'border-gray-200 bg-white/20 shadow-gray-200/20',
                    )}
                  >
                    <div className="flex items-center justify-center py-8">
                      <div className="flex items-center gap-3">
                        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-amber-400" />
                        <p
                          className={clsx(
                            'text-sm',
                            theme === 'dark' ? 'text-white/70' : 'text-gray-600',
                          )}
                        >
                          Загружаем каталог библиотеки…
                        </p>
                      </div>
                    </div>
                  </motion.section>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (showInitialError) {
    return (
      <AnimatePresence>
        {open && (
          <motion.div
            ref={overlayRef}
            className="fixed inset-0 z-50 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-label="Навигация по библиотеке — ошибка"
          >
            <div
              className={clsx(
                'absolute inset-0 backdrop-blur-sm',
                theme === 'dark' ? 'bg-black/70' : 'bg-black/50',
              )}
            />
          <div
            className={clsx(
              'pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-800/20 via-transparent to-amber-500/25',
              theme === 'dark' ? 'opacity-90' : 'opacity-70',
            )}
          />

            <div className="relative mx-auto flex h-full max-w-none w-full flex-col px-6 py-8">
              <div className="mb-4 flex justify-end">
                <OverlayCloseButton onClose={onClose} theme={theme} />
              </div>
              <div className="relative flex-1 min-h-0 overflow-y-auto">
                <div className="pointer-events-auto relative z-10 mx-auto flex w-full max-w-none flex-col gap-4 pb-16">
                  <motion.section
                    key="error"
                    variants={SECTION_VARIANTS}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                    className={clsx(
                      'rounded-2xl border p-4 shadow-lg backdrop-blur-lg w-full',
                      theme === 'dark'
                        ? 'border-red-500/40 bg-red-500/10 text-red-200 shadow-black/20'
                        : 'border-red-300 bg-red-50 text-red-700 shadow-red-200/20',
                    )}
                  >
                    <h3 className="text-lg font-semibold">Не удалось загрузить каталог</h3>
                    <p className="mt-2 text-sm opacity-80">{catalogError ?? manifestError}</p>
                    <p className="mt-4 text-xs opacity-60">
                      Проверьте подключение к сети или попробуйте обновить страницу чуть позже.
                    </p>
                  </motion.section>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  if (!open || !catalog) {
    return null;
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          className="fixed inset-0 z-50 outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-label="Навигация по библиотеке"
        >
          <div
            className={clsx(
              'absolute inset-0 backdrop-blur-sm',
              theme === 'dark' ? 'bg-black/70' : 'bg-black/50',
            )}
          />
          <div
            className={clsx(
              'pointer-events-none absolute inset-0 bg-gradient-to-br from-emerald-800/20 via-transparent to-amber-500/25',
              theme === 'dark' ? 'opacity-90' : 'opacity-70',
            )}
          />

          <div className="relative mx-auto flex h-full max-w-none w-full flex-col px-6 py-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <Suspense fallback={null}>
                <BreadcrumbTrail items={breadcrumbs} theme={theme} variants={ITEM_VARIANTS} />
              </Suspense>
              <div className="flex items-center gap-3">
                <Suspense fallback={null}>
                  <GlobalSearchBar query={searchQuery} onQueryChange={setSearchQuery} theme={theme} />
                </Suspense>
                <OverlayCloseButton onClose={onClose} theme={theme} />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 gap-6 overflow-hidden">
              <Suspense fallback={null}>
                <CategorySidebar
                  categories={CATEGORY_STRUCTURE}
                  activeCorpus={activeCorpus}
                  activeTanakhSection={tanakhSection}
                  onSelectCorpus={handleSelectCorpus}
                  loadingExtra={loadingExtraCategory}
                  theme={theme}
                />
              </Suspense>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
                  <Suspense fallback={null}>
                    <CurrentLocationPanel
                      location={currentLocation}
                      nav={locationNav ?? undefined}
                      onNavigate={handleLocationNavigate}
                      theme={theme}
                      variants={SECTION_VARIANTS}
                    />
                  </Suspense>

                  {manifestError && (
                    <div
                      className={clsx(
                        'rounded-2xl border px-3 py-3 text-xs',
                        theme === 'dark'
                          ? 'border-red-500/40 bg-red-500/10 text-red-200'
                          : 'border-red-300 bg-red-50 text-red-700',
                      )}
                    >
                      {manifestError}
                    </div>
                  )}

                  <AnimatePresence initial={false}>
                    {rootSection === 'Tanakh' && (
                      <Suspense fallback={null}>
                        <TanakhSectionPanel
                          collections={tanakhCollections}
                          section={tanakhSection}
                          onSelectBook={handleBookSelect}
                          activeBookTitle={selectedBook?.work.title}
                          loadingSeed={loadingTanakhSeed}
                          theme={theme}
                          variants={SECTION_VARIANTS}
                          className="w-full"
                        />
                      </Suspense>
                    )}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {rootSection === 'Halakha' && halakhahSections.length > 0 && (
                      <motion.section
                        key="halakha"
                        variants={SECTION_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={clsx(
                          'rounded-2xl border p-4 shadow-lg backdrop-blur-lg w-full',
                          theme === 'dark'
                            ? 'border-white/10 bg-white/10 shadow-black/20'
                            : 'border-gray-200 bg-white/20 shadow-gray-200/20',
                        )}
                      >
                        <div className="space-y-4">
                          <h3
                            className={clsx(
                              'text-sm font-semibold uppercase tracking-wide',
                              theme === 'dark' ? 'text-amber-200/90' : 'text-amber-700',
                            )}
                          >
                            {HALAKHAH_ROOT_LABEL}
                          </h3>
                          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr),minmax(0,1.1fr)]">
                            <div>
                              <HalakhahSectionSelector
                                items={halakhahSectionItems}
                                active={halakhahSection}
                                onSelect={handleHalakhahSectionChange}
                                theme={theme}
                                variants={ITEM_VARIANTS}
                              />
                              <div className="mt-4 space-y-3">
                                {(halakhahSectionData?.subsections ?? []).map((subsection) => {
                                  const entries = subsection.works
                                    .slice()
                                    .sort((a, b) => a.title.localeCompare(b.title, 'ru'))
                                    .map(createHalakhahEntry);
                                  const isExpanded = expandedHalakhahSubsections.includes(subsection.id);

                                  return (
                                    <div
                                      key={subsection.id}
                                      className={clsx(
                                        'rounded-2xl border px-3 py-2 transition',
                                        theme === 'dark'
                                          ? 'border-white/15 bg-white/5'
                                          : 'border-gray-200 bg-white',
                                      )}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => toggleHalakhahSubsection(subsection.id)}
                                        className="flex w-full items-center justify-between text-left text-sm font-semibold"
                                      >
                                        <span>{subsection.label}</span>
                                        <span className="text-xs uppercase tracking-wide text-emerald-500">
                                          {isExpanded ? 'Свернуть' : 'Развернуть'}
                                        </span>
                                      </button>
                                      {isExpanded && entries.length > 0 && (
                                        <div className="mt-3 space-y-3">
                                          <BookList
                                            books={entries}
                                            onSelect={(book) =>
                                              handleHalakhahWorkSelect(book, halakhahSectionLabel, subsection.label)
                                            }
                                            activeTitle={selectedBook?.work.title}
                                            theme={theme}
                                          />
                                        </div>
                                      )}
                                      {isExpanded && entries.length === 0 && (
                                        <p
                                          className={clsx(
                                            'mt-2 text-xs italic',
                                            theme === 'dark' ? 'text-white/70' : 'text-gray-500',
                                          )}
                                        >
                                          Тем пока нет.
                                        </p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            <div className={bookPanelClassName}>
                              {shouldInlineHalakhahPanel && bookDetailContent ? (
                                bookDetailContent
                              ) : (
                                <div
                                  className={clsx(
                                    'flex min-h-[220px] items-center justify-center text-center text-sm',
                                    theme === 'dark' ? 'text-white/70' : 'text-gray-600',
                                  )}
                                >
                                  Выберите книгу слева, затем выберите главу и симан.
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.section>
                    )}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {shouldRenderBookPanel && (!isHalakhahSelectedBook || rootSection !== 'Halakha') && (
                      <motion.section
                        key="book"
                        variants={SECTION_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={bookPanelClassName}
                      >
                        {bookDetailContent}
                      </motion.section>
                    )}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {rootSection === 'Mishnah' && mishnahCollections && (
                      <motion.section
                        key="mishnah"
                        variants={SECTION_VARIANTS}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        className={clsx(
                          'rounded-2xl border p-4 shadow-lg backdrop-blur-lg w-full',
                          theme === 'dark'
                            ? 'border-white/10 bg-white/10 shadow-black/20'
                            : 'border-gray-200 bg-white/20 shadow-gray-200/20',
                        )}
                      >
                        <h3
                          className={clsx(
                            'mb-3 text-sm font-semibold uppercase tracking-wide',
                            theme === 'dark' ? 'text-amber-200/90' : 'text-amber-700',
                          )}
                        >
                          Разделы Мишны
                        </h3>
                        <Suspense fallback={null}>
                          <MishnahSectionSelector
                            active={mishnahSection}
                            onSelect={handleMishnahSectionChange}
                            theme={theme}
                            variants={ITEM_VARIANTS}
                          />
                        </Suspense>
                        <div className="mt-4 space-y-4">
                          {mishnahSection === 'Zeraim' && (
                            <Suspense fallback={null}>
                              <BookList
                                books={mishnahCollections.zeraim}
                                onSelect={handleBookSelect}
                                activeTitle={selectedBook?.work.title}
                                theme={theme}
                              />
                            </Suspense>
                          )}
                          {mishnahSection === 'Moed' && (
                            <Suspense fallback={null}>
                              <BookList
                                books={mishnahCollections.moed}
                                onSelect={handleBookSelect}
                                activeTitle={selectedBook?.work.title}
                                theme={theme}
                              />
                            </Suspense>
                          )}
                          {mishnahSection === 'Nashim' && (
                            <Suspense fallback={null}>
                              <BookList
                                books={mishnahCollections.nashim}
                                onSelect={handleBookSelect}
                                activeTitle={selectedBook?.work.title}
                                theme={theme}
                              />
                            </Suspense>
                          )}
                          {mishnahSection === 'Nezikin' && (
                            <Suspense fallback={null}>
                              <BookList
                                books={mishnahCollections.nezikin}
                                onSelect={handleBookSelect}
                                activeTitle={selectedBook?.work.title}
                                theme={theme}
                              />
                            </Suspense>
                          )}
                          {mishnahSection === 'Kodashim' && (
                            <Suspense fallback={null}>
                              <BookList
                                books={mishnahCollections.kodashim}
                                onSelect={handleBookSelect}
                                activeTitle={selectedBook?.work.title}
                                theme={theme}
                              />
                            </Suspense>
                          )}
                          {mishnahSection === 'Taharot' && (
                            <Suspense fallback={null}>
                              <BookList
                                books={mishnahCollections.taharot}
                                onSelect={handleBookSelect}
                                activeTitle={selectedBook?.work.title}
                                theme={theme}
                              />
                            </Suspense>
                          )}
                        </div>
                      </motion.section>
                    )}
                  </AnimatePresence>

                  <AnimatePresence initial={false}>
                    {rootSection === 'Talmud' && (
                      <Suspense fallback={null}>
                        <TalmudSectionPanel
                          edition={talmudEdition}
                          sedarim={talmudStructure.map}
                          sederOrder={talmudStructure.order}
                          selectedSeder={talmudSeder}
                          selectedTractate={selectedTractate}
                          onEditionChange={handleTalmudEditionChange}
                          onSelectSeder={handleTalmudSederSelect}
                          onSelectTractate={handleTalmudTractateSelect}
                          onSelectDaf={handleTalmudDafSelect}
                          theme={theme}
                          variants={SECTION_VARIANTS}
                          className="w-full"
                        />
                      </Suspense>
                    )}
                  </AnimatePresence>

                  {rootSection &&
                    rootSection !== 'Tanakh' &&
                    rootSection !== 'Talmud' &&
                    rootSection !== 'Mishnah' &&
                    rootSection !== 'Halakha' && (
                    <Suspense fallback={null}>
                      <ComingSoonPanel sectionName={rootSection} theme={theme} variants={SECTION_VARIANTS} className="w-full" />
                    </Suspense>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function OverlayCloseButton({
  onClose,
  theme,
}: {
  onClose: () => void;
  theme: 'dark' | 'light' | 'system';
}) {
  return (
    <button
      type="button"
      onClick={onClose}
      className={clsx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70',
        theme === 'dark'
          ? 'border-white/15 bg-white/10 text-white/70 hover:bg-white/20 hover:text-white'
          : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-900',
      )}
    >
      <X className="h-4 w-4" />
      <span className="sr-only">Закрыть навигацию</span>
    </button>
  );
}

function getCorpusLabel(corpusId: string): string {
  const group = CATEGORY_STRUCTURE.find((category) =>
    category.corpora.some((corpus) => corpus.id === corpusId),
  );
  if (!group) {
    return corpusId;
  }
  const corpus = group.corpora.find((entry) => entry.id === corpusId);
  return corpus?.label ?? corpusId;
}

function getMishnahSectionLabel(section: MishnahSection): string {
  switch (section) {
    case 'Zeraim':
      return 'Зераим';
    case 'Moed':
      return 'Моэд';
    case 'Nashim':
      return 'Нашим';
    case 'Nezikin':
      return 'Незикин';
    case 'Kodashim':
      return 'Кодашим';
    case 'Taharot':
      return 'Тахарот';
    default:
      return section;
  }
}

export default FocusNavOverlay;




