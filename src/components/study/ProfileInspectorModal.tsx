import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, ExternalLink, BookOpen, Calendar, MapPin, Award, Pencil, RotateCcw, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { api, ProfileResponse } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { Region } from '@/types/timeline';

interface ProfileInspectorModalProps {
  slug: string | null;
  open: boolean;
  onClose: () => void;
  hideWorkSection?: boolean; // when true, не показываем блок произведения (для таймлайна персоналий)
}

const ALLOWED_TAGS = new Set(['p', 'h2', 'h3', 'ul', 'li', 'blockquote', 'img', 'small', 'a']);

const ERA_OPTIONS = [
  { value: 'torah', label: 'Период Пятикнижия', generations: 0, period: 'torah' },
  { value: 'torah_preflood', label: 'Эпоха допотопного человечества', generations: 10, period: 'torah', subPrefix: 'preflood_gen' },
  { value: 'torah_preflood_root', label: 'Допотоп — линия Адама', generations: 10, period: 'torah', subPrefix: 'preflood_root_gen' },
  { value: 'torah_preflood_cain', label: 'Допотоп — линия Каина', generations: 10, period: 'torah', subPrefix: 'preflood_cain_gen' },
  { value: 'torah_preflood_seth', label: 'Допотоп — линия Шета', generations: 10, period: 'torah', subPrefix: 'preflood_seth_gen' },
  { value: 'torah_flood', label: 'Эпоха Потопа', generations: 2, period: 'torah', subPrefix: 'flood_gen' },
  { value: 'postflood_nations', label: 'После Потопа (Ной → Авраам)', generations: 10, period: 'torah', subPrefix: 'postflood_gen' },
  { value: 'postflood_root', label: 'После Потопа — линия Ноя', generations: 2, period: 'torah', subPrefix: 'postflood_root_gen' },
  { value: 'postflood_line_shem', label: 'После Потопа — линия Шема', generations: 10, period: 'torah', subPrefix: 'postflood_line_shem_gen' },
  { value: 'postflood_line_ham', label: 'После Потопа — линия Хама', generations: 10, period: 'torah', subPrefix: 'postflood_line_ham_gen' },
  { value: 'postflood_line_japheth', label: 'После Потопа — линия Яфета', generations: 10, period: 'torah', subPrefix: 'postflood_line_japheth_gen' },
  { value: 'patriarchs', label: 'Эпоха праотцов', generations: 3, period: 'torah', subPrefix: 'patriarchs_gen' },
  { value: 'twelve_tribes', label: 'Эпоха 12 колен (ветви)', generations: 12, period: 'torah', subPrefix: 'tribe_' },
  { value: 'neviim', label: 'Период Пророков (Невиим)', generations: 0, period: 'neviim' },
  { value: 'great_assembly', label: 'Период Великого Собрания', generations: 0, period: 'great_assembly' },
  { value: 'shoftim', label: 'Шофтим', generations: 0, period: 'shoftim' },
  { value: 'shoftim_generations', label: 'Шофтим — поколения (1–13)', generations: 13, period: 'shoftim', subPrefix: 'shoftim_gen' },
  { value: 'melakhim_united', label: 'Млахим — Единое царство', generations: 0, period: 'malakhim_united' },
  { value: 'melakhim_divided_israel', label: 'Млахим — Разделённое (Израиль)', generations: 0, period: 'malakhim_divided', subPrefix: 'israel', region: Region.ERETZ_ISRAEL },
  { value: 'melakhim_divided_judah', label: 'Млахим — Разделённое (Иуда)', generations: 0, period: 'malakhim_divided', subPrefix: 'judah', region: Region.ERETZ_ISRAEL },
  { value: 'hasmoneans', label: 'Хашмонаим', generations: 0, period: 'hasmonean' },
  { value: 'zugot', label: 'Зугот', generations: 0, period: 'zugot' },
  { value: 'tanna_second', label: 'Таннаим (Второй Храм)', generations: 7, period: 'tannaim_temple', subPrefix: 'tanna_temple_gen' },
  { value: 'tanna_post', label: 'Таннаим (после разрушения)', generations: 5, period: 'tannaim_post_temple', subPrefix: 'tanna_post_gen' },
  { value: 'amora_eretz', label: 'Амораим — Эрец Исраэль', generations: 6, period: 'amoraim_israel', subPrefix: 'amora_israel_gen', region: Region.ERETZ_ISRAEL },
  { value: 'amora_bavel', label: 'Амораим — Вавилон', generations: 8, period: 'amoraim_babylonia', subPrefix: 'amora_bav_gen', region: Region.BABYLONIA },
  { value: 'savora_sura', label: 'Савораим — Сура', generations: 5, period: 'savoraim', subPrefix: 'savora_sura_gen', region: Region.BABYLONIA },
  { value: 'savora_pumbedita', label: 'Савораим — Пумбедита', generations: 5, period: 'savoraim', subPrefix: 'savora_pumbedita_gen', region: Region.BABYLONIA },
  { value: 'gaonim_sura', label: 'Гаоним — Сура', generations: 8, period: 'geonim', subPrefix: 'gaon_sura_gen', region: Region.BABYLONIA },
  { value: 'gaonim_pumbedita', label: 'Гаоним — Пумбедита', generations: 8, period: 'geonim', subPrefix: 'gaon_pumbedita_gen', region: Region.BABYLONIA },
  { value: 'gaonim_eretz', label: 'Гаоним — Эрец Исраэль', generations: 8, period: 'geonim', subPrefix: 'gaon_israel_gen', region: Region.ERETZ_ISRAEL },
  { value: 'rishonim_germany', label: 'Ришоним — Германия', generations: 0, period: 'rishonim', region: Region.GERMANY },
  { value: 'rishonim_france', label: 'Ришоним — Франция', generations: 0, period: 'rishonim', region: Region.FRANCE },
  { value: 'rishonim_england', label: 'Ришоним — Англия', generations: 0, period: 'rishonim', region: Region.ENGLAND },
  { value: 'rishonim_provence', label: 'Ришоним — Прованс', generations: 0, period: 'rishonim', region: Region.PROVENCE },
  { value: 'rishonim_sefarad', label: 'Ришоним — Сфарад', generations: 0, period: 'rishonim', region: Region.SEPHARAD },
  { value: 'rishonim_italy', label: 'Ришоним — Италия', generations: 0, period: 'rishonim', region: Region.ITALY },
  { value: 'rishonim_north_africa', label: 'Ришоним — Северная Африка', generations: 0, period: 'rishonim', region: Region.NORTH_AFRICA },
  { value: 'rishonim_kairouan', label: 'Ришоним — Кайруан', generations: 0, period: 'rishonim', region: Region.KAIROUAN },
  { value: 'rishonim_yemen', label: 'Ришоним — Йемен', generations: 0, period: 'rishonim', region: Region.YEMEN },
  { value: 'rishonim_egypt', label: 'Ришоним — Египет', generations: 0, period: 'rishonim', region: Region.EGYPT },
  { value: 'achronim', label: 'Ахроним', generations: 0, period: 'achronim' },
  { value: 'other', label: 'Другое/не указано', generations: 0, period: '' },
];

function sanitizeProfileHtml(html: string): string {
  if (!html) return '';
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const allNodes = Array.from(doc.body.querySelectorAll('*'));

  for (const el of allNodes) {
    const tag = el.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      // unwrap disallowed tags but keep their children
      const fragment = document.createDocumentFragment();
      while (el.firstChild) fragment.appendChild(el.firstChild);
      el.replaceWith(fragment);
      continue;
    }

    // prune attributes
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      if (tag === 'a' && name === 'href') continue;
      if (tag === 'a' && name === 'title') continue;
      if (tag === 'img' && (name === 'src' || name === 'alt')) continue;
      el.removeAttribute(attr.name);
    }
  }

  // sanitize links/imgs
  doc.querySelectorAll('a').forEach((a) => {
    const href = a.getAttribute('href') || '';
    if (!href || href.trim().toLowerCase().startsWith('javascript:')) {
      a.removeAttribute('href');
    } else {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    }
  });
  doc.querySelectorAll('img').forEach((img) => {
    if (!img.getAttribute('src')) img.remove();
  });

  return doc.body.innerHTML;
}

function FactRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5 px-3 py-2 rounded-lg border border-border/60 bg-muted/40 shadow-[0_4px_12px_rgba(0,0,0,0.03)]">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground leading-snug">{value}</div>
    </div>
  );
}

function RenderProfileHtml({ html }: { html?: string | null }) {
  const safe = useMemo(() => sanitizeProfileHtml(html || ''), [html]);
  if (!safe) return <div className="text-sm text-muted-foreground">Нет данных.</div>;
  return (
    <div
      className="prose prose-sm dark:prose-invert max-w-none leading-relaxed space-y-2 prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-h3:mt-3 prose-h3:mb-1 prose-ul:list-disc prose-ul:pl-5 prose-li:my-1 prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:text-muted-foreground dark:prose-blockquote:text-slate-200"
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}

export function ProfileInspectorModal({ slug, open, onClose, hideWorkSection = false }: ProfileInspectorModalProps) {
  const hasHebrew = (value?: string | null) => Boolean(value && /[\u0590-\u05FF]/.test(value));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftSummary, setDraftSummary] = useState('');
  const [draftSummaryAuthor, setDraftSummaryAuthor] = useState('');
  const [draftFactsWork, setDraftFactsWork] = useState('');
  const [draftFactsAuthor, setDraftFactsAuthor] = useState('');
  const [selectedEra, setSelectedEra] = useState<string>('other');
  const [selectedGen, setSelectedGen] = useState<number | null>(null);
  const [draftPeriod, setDraftPeriod] = useState('');
  const [draftSubPeriod, setDraftSubPeriod] = useState('');
  const [draftRegion, setDraftRegion] = useState('');
  const [draftGeneration, setDraftGeneration] = useState<number | null>(null);
  const [draftPeriodLabel, setDraftPeriodLabel] = useState('');
  const [draftTitleEn, setDraftTitleEn] = useState('');
  const [draftTitleHe, setDraftTitleHe] = useState('');
  const [draftTitleRu, setDraftTitleRu] = useState('');
  const [draftBirthYear, setDraftBirthYear] = useState<string>('');
  const [draftDeathYear, setDraftDeathYear] = useState<string>('');
  const [draftBirthPlace, setDraftBirthPlace] = useState<string>('');
  const [draftDeathPlace, setDraftDeathPlace] = useState<string>('');
  const [draftBurialPlace, setDraftBurialPlace] = useState<string>('');
  const [draftTeachers, setDraftTeachers] = useState<string>('');
  const [draftStudents, setDraftStudents] = useState<string>('');
  const [draftChildren, setDraftChildren] = useState<string>('');
  const [draftParents, setDraftParents] = useState<string>('');
  const [draftColleagues, setDraftColleagues] = useState<string>('');
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!open || !slug) return;
    setLoading(true);
    setError(null);
    api
      .getProfile(slug)
      .then((res) => {
        if (res && res.ok === false) {
          throw new Error(res.error || 'Profile not found');
        }
        setData(res);
        setDraftSummary(res.summary_work_html || res.summary_html || '');
        setDraftSummaryAuthor(res.summary_author_html || '');
        setDraftFactsWork(res.facts?.work ? JSON.stringify(res.facts.work, null, 2) : '');
        setDraftFactsAuthor(res.facts?.author ? JSON.stringify(res.facts.author, null, 2) : '');
        const authorFacts = res.facts?.author || {};
        setDraftPeriod(authorFacts.period || '');
        setDraftSubPeriod(authorFacts.sub_period || '');
        setDraftRegion(authorFacts.region || '');
        setDraftGeneration(authorFacts.generation ?? null);
        setDraftPeriodLabel(authorFacts.display?.period_ru || authorFacts.period_ru || '');
        setDraftTitleEn(res.title_en || '');
        setDraftTitleHe(res.title_he || (hasHebrew(res.title_en) ? res.title_en : ''));
        setDraftTitleRu(authorFacts.display?.name_ru || authorFacts.display?.title_ru || '');
        const birthYear = authorFacts.birth_year ?? authorFacts.lifespan_range?.start;
        const deathYear = authorFacts.death_year ?? authorFacts.lifespan_range?.end;
        setDraftBirthYear(birthYear ? String(birthYear) : '');
        setDraftDeathYear(deathYear ? String(deathYear) : '');
        setDraftBirthPlace(authorFacts.birth_place || '');
        setDraftDeathPlace(authorFacts.death_place || '');
        setDraftBurialPlace(authorFacts.burial_place || '');
        setDraftTeachers(Array.isArray(authorFacts.teachers) ? authorFacts.teachers.join(', ') : '');
        setDraftStudents(Array.isArray(authorFacts.students) ? authorFacts.students.join(', ') : '');
        setDraftChildren(Array.isArray(authorFacts.children) ? authorFacts.children.join(', ') : '');
        setDraftParents(Array.isArray(authorFacts.parents) ? authorFacts.parents.join(', ') : '');
        setDraftColleagues(Array.isArray(authorFacts.colleagues) ? authorFacts.colleagues.join(', ') : '');
        // try to set preset
        const match = ERA_OPTIONS.find((o) => {
          const samePeriod = o.period === authorFacts.period;
          if (!samePeriod) return false;
          if (o.subPrefix && authorFacts.sub_period) return authorFacts.sub_period.startsWith(o.subPrefix);
          return true;
        });
        setSelectedEra(match?.value || 'other');
        if (match?.generations) {
          const genFromSub = authorFacts.sub_period ? Number(authorFacts.sub_period.replace(/\D+/g, '')) : authorFacts.generation;
          setSelectedGen(genFromSub || null);
        }
      })
      .catch((err) => {
        console.error('Profile load failed', err);
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => setLoading(false));
  }, [open, slug]);

  const handleSave = async () => {
    if (!slug) return;
    setSaving(true);
    try {
      const effectiveTitleHe = draftTitleHe || (hasHebrew(draftTitleEn) ? draftTitleEn : '');
      const factsWork = draftFactsWork ? JSON.parse(draftFactsWork) : null;
      const factsAuthor = draftFactsAuthor ? JSON.parse(draftFactsAuthor) : null;
      const splitToList = (value: string) =>
        value
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
      const mergedFacts: any = { work: factsWork || {}, author: factsAuthor || {} };
      mergedFacts.author = mergedFacts.author || {};
      mergedFacts.author.period = draftPeriod || mergedFacts.author.period;
      mergedFacts.author.sub_period = draftSubPeriod || mergedFacts.author.sub_period;
      mergedFacts.author.region = draftRegion || mergedFacts.author.region;
      mergedFacts.author.generation = draftGeneration ?? mergedFacts.author.generation;
      mergedFacts.author.birth_year = draftBirthYear ? Number(draftBirthYear) : mergedFacts.author.birth_year;
      mergedFacts.author.death_year = draftDeathYear ? Number(draftDeathYear) : mergedFacts.author.death_year;
      mergedFacts.author.birth_place = draftBirthPlace || mergedFacts.author.birth_place;
      mergedFacts.author.death_place = draftDeathPlace || mergedFacts.author.death_place;
      mergedFacts.author.burial_place = draftBurialPlace || mergedFacts.author.burial_place;
      mergedFacts.author.teachers = draftTeachers ? splitToList(draftTeachers) : mergedFacts.author.teachers;
      mergedFacts.author.students = draftStudents ? splitToList(draftStudents) : mergedFacts.author.students;
      mergedFacts.author.children = draftChildren ? splitToList(draftChildren) : mergedFacts.author.children;
      mergedFacts.author.parents = draftParents ? splitToList(draftParents) : mergedFacts.author.parents;
      mergedFacts.author.colleagues = draftColleagues ? splitToList(draftColleagues) : mergedFacts.author.colleagues;
      mergedFacts.author.display = mergedFacts.author.display || {};
      if (draftPeriodLabel) mergedFacts.author.display.period_ru = draftPeriodLabel;
      if (draftTitleRu) mergedFacts.author.display.name_ru = draftTitleRu;
      mergedFacts.author.period_ru = draftPeriodLabel || mergedFacts.author.period_ru;
      // сохраняем имена также в facts (на случай старых данных)
      if (draftTitleEn) mergedFacts.author.title_en = draftTitleEn;
      if (effectiveTitleHe) mergedFacts.author.title_he = effectiveTitleHe;
      if (!hideWorkSection) {
        mergedFacts.summary_work_html = draftSummary;
      }
      mergedFacts.summary_author_html = draftSummaryAuthor;
      const res = await api.updateProfile({
        slug,
        title_en: draftTitleEn || undefined,
        title_he: effectiveTitleHe || undefined,
        summary_html: draftSummary + draftSummaryAuthor,
        facts: mergedFacts,
      });
      setData(res);
      setEditMode(false);
    } catch (err: any) {
      alert(err.message || 'Не удалось сохранить профиль');
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerate = async () => {
    if (!slug) return;
    setSaving(true);
    try {
      const res = await api.regenerateProfile(slug);
      setData(res);
      setDraftSummary(res.summary_html || '');
      setDraftSummaryAuthor(res.summary_author_html || '');
      setDraftFactsWork(res.facts?.work ? JSON.stringify(res.facts.work, null, 2) : '');
      setDraftFactsAuthor(res.facts?.author ? JSON.stringify(res.facts.author, null, 2) : '');
      const authorFacts = res.facts?.author || {};
      setDraftPeriod(authorFacts.period || '');
      setDraftSubPeriod(authorFacts.sub_period || '');
      setDraftRegion(authorFacts.region || '');
      setDraftGeneration(authorFacts.generation ?? null);
      setDraftPeriodLabel(authorFacts.display?.period_ru || authorFacts.period_ru || '');
      setDraftTitleEn(res.title_en || '');
      setDraftTitleHe(res.title_he || (hasHebrew(res.title_en) ? res.title_en : ''));
      const birthYear = authorFacts.birth_year ?? authorFacts.lifespan_range?.start;
      const deathYear = authorFacts.death_year ?? authorFacts.lifespan_range?.end;
      setDraftBirthYear(birthYear ? String(birthYear) : '');
      setDraftDeathYear(deathYear ? String(deathYear) : '');
      setDraftBirthPlace(authorFacts.birth_place || '');
      setDraftDeathPlace(authorFacts.death_place || '');
      setDraftBurialPlace(authorFacts.burial_place || '');
      setDraftTeachers(Array.isArray(authorFacts.teachers) ? authorFacts.teachers.join(', ') : '');
      setDraftStudents(Array.isArray(authorFacts.students) ? authorFacts.students.join(', ') : '');
      setDraftChildren(Array.isArray(authorFacts.children) ? authorFacts.children.join(', ') : '');
      setDraftParents(Array.isArray(authorFacts.parents) ? authorFacts.parents.join(', ') : '');
      setDraftColleagues(Array.isArray(authorFacts.colleagues) ? authorFacts.colleagues.join(', ') : '');
      setEditMode(false);
    } catch (err: any) {
      alert(err.message || 'Не удалось перегенерировать профиль');
    } finally {
      setSaving(false);
    }
  };

  const sanitizedSummary = useMemo(
    () => sanitizeProfileHtml(data?.summary_html || ''),
    [data?.summary_html]
  );

  const applyEraPreset = (eraValue: string, generation: number | null) => {
    const preset = ERA_OPTIONS.find((o) => o.value === eraValue);
    setSelectedEra(eraValue);
    setSelectedGen(generation);
    if (!preset) {
      setDraftPeriod('');
      setDraftSubPeriod('');
      setDraftRegion('');
      setDraftPeriodLabel('');
      setDraftGeneration(null);
      return;
    }

    setDraftPeriod(preset.period || '');
    setDraftRegion(preset.region || '');
    setDraftGeneration(generation);
    if (preset.generations && generation) {
      const sub = preset.subPrefix ? `${preset.subPrefix}${generation}` : '';
      setDraftSubPeriod(sub);
      setDraftPeriodLabel(`${preset.label}, ${generation} поколение`);
    } else {
      setDraftSubPeriod(preset.subPrefix || '');
      setDraftPeriodLabel(preset.label);
    }
  };

  const facts = data?.facts || {};
  const factsWork = (facts as any)?.work || {};
  const factsAuthor = (facts as any)?.author || {};
  const displayAuthor = (factsAuthor as any)?.display || {};
  const birthYear = factsAuthor?.birth_year ?? factsAuthor?.lifespan_range?.start;
  const deathYear = factsAuthor?.death_year ?? factsAuthor?.lifespan_range?.end;
  const birthPlace = factsAuthor?.birth_place;
  const deathPlace = factsAuthor?.death_place;
  const burialPlace = factsAuthor?.burial_place;
  const teachers = factsAuthor?.teachers;
  const students = factsAuthor?.students;
  const children = factsAuthor?.children;
  const parents = factsAuthor?.parents;
  const colleagues = factsAuthor?.colleagues;
  const linksWork = factsWork?.links || {};
  const linksAuthor = factsAuthor?.links || {};
  const authors =
    factsWork?.display?.author_name_ru ||
    (Array.isArray(factsWork?.authors) ? factsWork?.authors.join(', ') : (factsWork?.authors as string | undefined));
  const categories =
    factsWork?.display?.categories_ru ||
    (Array.isArray(factsWork?.categories) ? factsWork.categories.join(', ') : undefined);
  const images = Array.isArray(factsWork?.images) ? factsWork.images : [];
  const heroImage = images[0];
  const secondaryImages = images.slice(1, 4);

  return (
    <Dialog open={open} onOpenChange={(v) => (!v ? onClose() : null)} className="z-[60]">
      <DialogContent className="max-w-3xl w-full bg-background">
        <DialogHeader className="mb-2">
          <DialogTitle className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-semibold leading-tight truncate">
              {data?.title_en || slug}
            </span>
            {data?.title_he && <span className="font-hebrew text-base text-muted-foreground">{data.title_he}</span>}
            {data?.is_verified && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs border border-emerald-300">
                ✓ Проверено {data?.verified_by ? `(${data.verified_by})` : ''}
              </span>
            )}
            {data && !data.is_verified && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-800 text-xs border border-amber-300">
                Черновик
              </span>
            )}
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-3 justify-between">
            {slug && <div className="text-xs text-muted-foreground truncate">Slug: {slug}</div>}
            {isAdmin && data && (
              <div className="flex items-center gap-2">
                {!editMode && (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-sm hover:bg-accent/20 transition-colors"
                  >
                    <Pencil className="w-4 h-4" /> Редактировать
                  </button>
                )}
                {editMode && (
                  <>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
                    >
                      <Check className="w-4 h-4" /> Сохранить
                    </button>
                      <button
                        type="button"
                      onClick={() => {
                        setDraftSummary(data.summary_work_html || data.summary_html || '');
                        setDraftSummaryAuthor(data.summary_author_html || '');
                        setDraftFactsWork(data.facts?.work ? JSON.stringify(data.facts.work, null, 2) : '');
                        setDraftFactsAuthor(data.facts?.author ? JSON.stringify(data.facts.author, null, 2) : '');
                        setEditMode(false);
                      }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-sm hover:bg-accent/20 transition-colors"
                      >
                        Отменить
                      </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={saving}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-sm hover:bg-accent/20 transition-colors"
                  title="Перегенерировать и сбросить правки"
                >
                  <RotateCcw className="w-4 h-4" /> Перегенерировать
                </button>
              </div>
            )}
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/5 border border-red-200 rounded-md px-3 py-2">
            <AlertTriangle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
              {heroImage && (
                <div className="relative overflow-hidden rounded-xl border border-border/70 bg-muted/30 shadow-[0_12px_30px_rgba(0,0,0,0.08)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(heroImage as any).url}
                  alt={(heroImage as any).alt || 'Hero'}
                  className="w-full h-56 object-cover"
                />
                {(heroImage as any).alt && (
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs px-3 py-2">
                    {(heroImage as any).alt}
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2 text-xs">
              {(facts as any).lifespan && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/20 text-foreground border border-border/60">
                  <Calendar className="w-3.5 h-3.5" /> {(facts as any).lifespan}
                </span>
              )}
              {(facts as any).period && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground border border-border/60">
                  <Award className="w-3.5 h-3.5" /> {(facts as any).period}
                </span>
              )}
              {(facts as any).compPlace && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground border border-border/60">
                  <MapPin className="w-3.5 h-3.5" /> {(facts as any).compPlace}
                </span>
              )}
              {categories && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-muted text-foreground border border-border/60">
                  <BookOpen className="w-3.5 h-3.5" /> {categories}
                </span>
              )}
            </div>
            {!editMode && (
              <div className="grid md:grid-cols-2 gap-2">
                <FactRow label="Имя (RU)" value={displayAuthor?.name_ru} />
                <FactRow label="Период (RU)" value={displayAuthor?.period_ru} />
                <FactRow label="Годы жизни" value={factsAuthor?.lifespan} />
                <FactRow label="Рождение" value={[birthYear, birthPlace].filter(Boolean).join(' · ')} />
                <FactRow label="Смерть" value={[deathYear, deathPlace].filter(Boolean).join(' · ')} />
                <FactRow label="Погребение" value={burialPlace} />
                <FactRow label="Регион" value={factsAuthor?.region} />
                <FactRow label="Поколение" value={factsAuthor?.generation ? String(factsAuthor.generation) : undefined} />
                <FactRow label="Sub-period" value={factsAuthor?.sub_period || factsAuthor?.subPeriod} />
                <FactRow label="Учителя" value={Array.isArray(teachers) ? teachers.join(', ') : undefined} />
                <FactRow label="Ученики" value={Array.isArray(students) ? students.join(', ') : undefined} />
                <FactRow label="Дети" value={Array.isArray(children) ? children.join(', ') : undefined} />
                <FactRow label="Родители" value={Array.isArray(parents) ? parents.join(', ') : undefined} />
                <FactRow label="Коллеги" value={Array.isArray(colleagues) ? colleagues.join(', ') : undefined} />
              </div>
            )}

            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.04)] space-y-3">
              {editMode ? (
                <div className="space-y-3">
                  <div className="grid md:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Имя (EN)</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftTitleEn}
                        onChange={(e) => setDraftTitleEn(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Имя (HE)</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftTitleHe}
                        onChange={(e) => setDraftTitleHe(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Имя (RU)</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftTitleRu}
                        onChange={(e) => setDraftTitleRu(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Эра / период</label>
                      <select
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={selectedEra}
                        onChange={(e) => {
                          const era = e.target.value;
                          const meta = ERA_OPTIONS.find((o) => o.value === era);
                          const gen = meta?.generations ? null : selectedGen;
                          applyEraPreset(era, gen);
                        }}
                      >
                        {ERA_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    {ERA_OPTIONS.find((o) => o.value === selectedEra)?.generations ? (
                      <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">Поколение</label>
                        <select
                          className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                          value={selectedGen || ''}
                          onChange={(e) => {
                            const gen = e.target.value ? Number(e.target.value) : null;
                            applyEraPreset(selectedEra, gen);
                          }}
                        >
                          <option value="">—</option>
                          {Array.from({ length: ERA_OPTIONS.find((o) => o.value === selectedEra)?.generations || 0 }).map((_, idx) => (
                            <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <div className="grid md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                    <div>period: <span className="font-mono">{draftPeriod || '—'}</span></div>
                    <div>sub_period: <span className="font-mono">{draftSubPeriod || '—'}</span></div>
                    <div>region: <span className="font-mono">{draftRegion || '—'}</span></div>
                    <div>generation: <span className="font-mono">{draftGeneration ?? '—'}</span></div>
                    <div className="md:col-span-2">period_ru: <span className="font-mono">{draftPeriodLabel || '—'}</span></div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Год рождения</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftBirthYear}
                        onChange={(e) => setDraftBirthYear(e.target.value)}
                        placeholder="например, 135"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Год смерти</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftDeathYear}
                        onChange={(e) => setDraftDeathYear(e.target.value)}
                        placeholder="например, 210"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Место рождения</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftBirthPlace}
                        onChange={(e) => setDraftBirthPlace(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Место смерти</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftDeathPlace}
                        onChange={(e) => setDraftDeathPlace(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Место погребения</label>
                    <input
                      className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                      value={draftBurialPlace}
                      onChange={(e) => setDraftBurialPlace(e.target.value)}
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Учителя (через запятую)</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftTeachers}
                        onChange={(e) => setDraftTeachers(e.target.value)}
                        placeholder="Учитель 1, Учитель 2"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Ученики (через запятую)</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftStudents}
                        onChange={(e) => setDraftStudents(e.target.value)}
                        placeholder="Ученик 1, Ученик 2"
                      />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Дети (через запятую)</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftChildren}
                        onChange={(e) => setDraftChildren(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Родители (через запятую)</label>
                      <input
                        className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                        value={draftParents}
                        onChange={(e) => setDraftParents(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Коллеги (через запятую)</label>
                    <input
                      className="w-full rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                      value={draftColleagues}
                      onChange={(e) => setDraftColleagues(e.target.value)}
                    />
                  </div>
                  {!hideWorkSection && (
                    <>
                      <label className="block text-xs font-medium text-muted-foreground">HTML — произведение (p,h2,h3,ul,li,blockquote,img,small,a)</label>
                      <textarea
                        className="w-full min-h-[140px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                        value={draftSummary}
                        onChange={(e) => setDraftSummary(e.target.value)}
                      />
                    </>
                  )}
                  <label className="block text-xs font-medium text-muted-foreground">HTML — автор</label>
                  <textarea
                    className="w-full min-h-[120px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                    value={draftSummaryAuthor}
                    onChange={(e) => setDraftSummaryAuthor(e.target.value)}
                  />
                  {!hideWorkSection && (
                    <>
                      <label className="block text-xs font-medium text-muted-foreground">facts.work (JSON)</label>
                      <textarea
                        className="w-full min-h-[160px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                        value={draftFactsWork}
                        onChange={(e) => setDraftFactsWork(e.target.value)}
                      />
                    </>
                  )}
                  <label className="block text-xs font-medium text-muted-foreground">facts.author (JSON)</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                    value={draftFactsAuthor}
                    onChange={(e) => setDraftFactsAuthor(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  {!hideWorkSection && (
                    <div>
                      <h4 className="text-sm font-semibold mb-1">Произведение</h4>
                      <RenderProfileHtml html={data?.summary_work_html} />
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Автор</h4>
                    <RenderProfileHtml html={data?.summary_author_html} />
                  </div>
                </>
              )}
            </div>

            {secondaryImages.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {secondaryImages.map((img, idx) => (
                  <div key={`${img.url || idx}`} className="rounded-md overflow-hidden border border-border/60 bg-muted/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={(img as any).url} alt={(img as any).alt || 'Image'} className="w-full h-28 object-cover" />
                    {(img as any).alt && (
                      <div className="text-[11px] text-muted-foreground px-2 py-1 border-t border-border/60">
                        {(img as any).alt}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-2">
              <FactRow label="Авторы" value={authors} />
              <FactRow label="Категории" value={categories} />
              <FactRow label="Период" value={factsWork.display?.period_ru || (factsWork as any).period} />
              <FactRow label="Время жизни автора" value={(factsAuthor as any).lifespan} />
              <FactRow label="Дата/место создания" value={[(factsWork.display?.compPlace_ru || factsWork.compPlace || ''), (factsWork.compDate || '')].filter(Boolean).join(' · ')} />
              <FactRow label="Дата/место публикации" value={[(factsWork.display?.pubPlace_ru || factsWork.pubPlace || ''), (factsWork.pubDate || '')].filter(Boolean).join(' · ')} />
            </div>

            {(linksWork?.sefaria || linksWork?.wikipedia || linksAuthor?.wikipedia) && (
              <div className="flex flex-wrap gap-3 text-sm">
                {linksWork?.sefaria && (
                  <a
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 hover:bg-accent/20 transition-colors"
                    href={linksWork.sefaria}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> Sefaria
                  </a>
                )}
                {linksWork?.wikipedia && (
                  <a
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 hover:bg-accent/20 transition-colors"
                    href={linksWork.wikipedia}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> Wikipedia (произведение)
                  </a>
                )}
                {linksAuthor?.wikipedia && (
                  <a
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 hover:bg-accent/20 transition-colors"
                    href={linksAuthor.wikipedia}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink className="w-4 h-4" /> Wikipedia (автор)
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProfileInspectorModal;
