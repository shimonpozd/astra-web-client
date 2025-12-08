import { useEffect, useMemo, useState } from 'react';
import { api, ProfileListItem } from '../../services/api';
import { createAuthorProfile } from '../../services/profileAdmin';
import { Input } from '../../components/ui/input';
import { Loader2, RefreshCw, Search, ShieldCheck, ShieldAlert, ExternalLink, Trash2 } from 'lucide-react';
import ProfileInspectorModal from '../../components/study/ProfileInspectorModal';
import { Region } from '@/types/timeline';

const StatusBadge = ({ item }: { item: ProfileListItem }) => {
  if (item.is_verified) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
        <ShieldCheck className="w-3.5 h-3.5" /> Verified
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-amber-100 text-amber-900 border border-amber-200">
      <ShieldAlert className="w-3.5 h-3.5" /> Draft
    </span>
  );
};

export default function ProfilesAdminPage() {
  const [items, setItems] = useState<ProfileListItem[]>([]);
  const [query, setQuery] = useState('');
  const [onlyUnverified, setOnlyUnverified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWiki, setNewWiki] = useState('');
  const [newPeriod, setNewPeriod] = useState('');
  const [newPeriodRu, setNewPeriodRu] = useState('');
  const [newRawText, setNewRawText] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newSubPeriod, setNewSubPeriod] = useState('');
  const [batchNames, setBatchNames] = useState('');
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchProgress, setBatchProgress] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

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
    { value: 'rishonim_yemen', label: 'Ришоним — Йемен', generations: 0, period: 'rishonim', region: Region.YEMEN },
    { value: 'rishonim_egypt', label: 'Ришоним — Египет', generations: 0, period: 'rishonim', region: Region.EGYPT },
    { value: 'achronim', label: 'Ахроним', generations: 0, period: 'achronim' },
    { value: 'other', label: 'Другое/не указано', generations: 0, period: '' },
  ];
  const [selectedEra, setSelectedEra] = useState<string>('other');
  const [selectedGen, setSelectedGen] = useState<number | null>(null);

  const applyEraPreset = (eraValue: string, generation: number | null) => {
    const preset = ERA_OPTIONS.find((o) => o.value === eraValue);
    const genLabel = generation ? ` • поколение ${generation}` : '';
    setSelectedEra(eraValue);
    setSelectedGen(generation);

    if (!preset) {
      setNewPeriod('');
      setNewPeriodRu('');
      setNewSubPeriod('');
      setNewRegion('');
      return;
    }

    setNewPeriod(preset.period || '');
    setNewRegion(preset.region || '');
    if (preset.generations && generation) {
      const sub = preset.subPrefix ? `${preset.subPrefix}${generation}` : '';
      setNewSubPeriod(sub);
      setNewPeriodRu(`${preset.label}${genLabel}`);
    } else {
      setNewSubPeriod(preset.subPrefix || '');
      setNewPeriodRu(preset.label);
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listProfiles({ q: query || undefined, unverified: onlyUnverified, limit: 200 });
      setItems(res.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    applyEraPreset('other', null);
  }, []);

  const deriveNameFromUrl = (url: string) => {
    try {
      const u = new URL(url);
      const last = u.pathname.split('/').filter(Boolean).pop() || '';
      const decoded = decodeURIComponent(last).replace(/_/g, ' ');
      return decoded || url;
    } catch {
      return url;
    }
  };

  const filtered = useMemo(() => items, [items]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Profiles</h2>
          <p className="text-sm text-muted-foreground">Модерация и правка профильных статей.</p>
        </div>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-sm hover:bg-accent/20 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Обновить
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по slug/title..."
            className="pl-9"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                void loadData();
              }
            }}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyUnverified}
            onChange={(e) => setOnlyUnverified(e.target.checked)}
          />
          Только непроверенные
        </label>
        <button
          type="button"
          onClick={loadData}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-sm hover:bg-accent/20 transition-colors"
        >
          Применить
        </button>
      </div>

      {/* Создание автора по имени (иврит) */}
      <div className="p-3 border border-border/60 rounded-lg space-y-2 bg-card/60">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold">Добавить мудреца/автора (иврит)</h4>
            <p className="text-xs text-muted-foreground">Введите имя на иврите, опционально ссылку и период.</p>
          </div>
          {creating && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <Input placeholder="Имя на иврите (slug)" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <Input placeholder="Ссылка на wiki (опционально)" value={newWiki} onChange={(e) => setNewWiki(e.target.value)} />
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Эра / поколение</label>
            <div className="flex gap-2">
              <select
                className="flex-1 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                value={selectedEra}
                onChange={(e) => {
                  const era = e.target.value;
                  const eraMeta = ERA_OPTIONS.find((o) => o.value === era);
                  const gen = eraMeta?.generations ? null : selectedGen;
                  applyEraPreset(era, gen || null);
                }}
              >
                {ERA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              {ERA_OPTIONS.find((o) => o.value === selectedEra)?.generations ? (
                <select
                  className="w-32 rounded-md border border-border/60 bg-background px-2 py-1 text-sm"
                  value={selectedGen || ''}
                  onChange={(e) => {
                    const gen = e.target.value ? Number(e.target.value) : null;
                    applyEraPreset(selectedEra, gen);
                  }}
                >
                  <option value="">поколение</option>
                  {Array.from({ length: ERA_OPTIONS.find((o) => o.value === selectedEra)?.generations || 0 }).map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>{idx + 1}</option>
                  ))}
                </select>
              ) : null}
            </div>
            <div className="text-[12px] text-muted-foreground space-y-1">
              <div>Период: <span className="font-mono">{newPeriod || '—'}</span></div>
              <div>Sub-period: <span className="font-mono">{newSubPeriod || '—'}</span></div>
              <div>Регион: <span className="font-mono">{newRegion || '—'}</span></div>
              <div>Заголовок: <span className="font-mono">{newPeriodRu || '—'}</span></div>
            </div>
          </div>
          <Input
            placeholder="Доп. текст (опционально)"
            value={newRawText}
            onChange={(e) => setNewRawText(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!newName || creating}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-sm hover:bg-accent/20 disabled:opacity-50"
            onClick={async () => {
              const payloadName = newName || (newWiki ? deriveNameFromUrl(newWiki) : '');
              if (!payloadName) return;
              setCreating(true);
              try {
                const res = await createAuthorProfile({
                  name: payloadName,
                  wiki_url: newWiki || undefined,
                  raw_text: newRawText || undefined,
                  period: newPeriod || undefined,
                  period_ru: newPeriodRu || undefined,
                  region: newRegion || undefined,
                  generation: selectedGen || undefined,
                  sub_period: newSubPeriod || undefined,
                });
                setItems((prev) => [{ slug: res.slug, title_en: res.title_en, title_he: res.title_he, is_verified: false, source: res.source }, ...prev]);
                setSelectedSlug(res.slug);
                setModalOpen(true);
              } catch (err: any) {
                alert(err.message || 'Не удалось создать профиль автора');
              } finally {
                setCreating(false);
              }
            }}
          >
            Создать профиль автора
          </button>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-3 p-3 border border-border/60 rounded-lg bg-card/40">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-semibold">Пакет авторов (по одному имени/slug на строку)</label>
          <textarea
            className="w-full min-h-[120px] rounded-md border border-border/60 bg-background px-3 py-2 text-sm font-mono"
            placeholder="Rabbi Akiva|https://he.wikipedia.org/wiki/...\nRav Ashi|https://en.wikipedia.org/wiki/..."
            value={batchNames}
            onChange={(e) => setBatchNames(e.target.value)}
            disabled={batchRunning}
          />
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Формат строки: <code>Имя|wiki_url</code> или просто <code>Имя</code>. Для каждой строки будет вызван author_only с выбранными period/sub_period/region/generation (формируются из выпадашек выше). Передавайте ссылку wiki, чтобы timeline_bio сразу взял HTML без поисков.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={!batchNames.trim() || batchRunning}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-border/60 text-sm hover:bg-accent/20 disabled:opacity-50"
              onClick={async () => {
                const lines = batchNames.split('\n').map((n) => n.trim()).filter(Boolean);
                if (!lines.length) return;
                setBatchRunning(true);
                setBatchProgress(`0/${lines.length}`);
                for (let i = 0; i < lines.length; i += 1) {
                  const line = lines[i];
                  const hasPipe = line.includes('|');
                  let wiki_url = '';
                  let name = '';
                  if (hasPipe) {
                    const [nameRaw, urlRaw] = line.split('|');
                    name = (nameRaw || '').trim();
                    wiki_url = (urlRaw || '').trim();
                  } else if (line.startsWith('http')) {
                    wiki_url = line;
                    name = deriveNameFromUrl(line);
                  } else {
                    // если не ссылка и без разделителя — пропускаем
                    continue;
                  }
                  if (!wiki_url) continue;
                  if (!name) name = deriveNameFromUrl(wiki_url);
                  try {
                    const res = await createAuthorProfile({
                      name,
                      wiki_url: wiki_url || undefined,
                      period: newPeriod || undefined,
                      period_ru: newPeriodRu || undefined,
                      region: newRegion || undefined,
                      generation: selectedGen || undefined,
                      sub_period: newSubPeriod || undefined,
                    });
                    setItems((prev) => [{ slug: res.slug, title_en: res.title_en, title_he: res.title_he, is_verified: false, source: res.source }, ...prev]);
                    setBatchProgress(`${i + 1}/${lines.length}: ${name}`);
                  } catch (err: any) {
                    setBatchProgress(`Ошибка на "${name}": ${err.message || err}`);
                    break;
                  }
                }
                setBatchRunning(false);
              }}
            >
              Запустить пакет
            </button>
            {batchProgress && <span className="text-xs text-muted-foreground">{batchProgress}</span>}
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-500">{error}</div>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Загружаем...
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-6 border border-border/60 rounded-lg">
              Ничего не найдено
            </div>
          )}
          {filtered.map((item) => (
            <div key={item.slug} className="border border-border/60 rounded-lg p-3 shadow-sm bg-card/60">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="font-mono text-[11px] text-muted-foreground">{item.slug}</div>
                  <div className="font-semibold">{item.title_en || '—'}</div>
                  {item.title_he && <div className="font-hebrew text-sm text-muted-foreground">{item.title_he}</div>}
                  <StatusBadge item={item} />
                  {item.verified_by && (
                    <div className="text-[11px] text-muted-foreground">by {item.verified_by}</div>
                  )}
                  {item.updated_at && (
                    <div className="text-[11px] text-muted-foreground">обновлено {new Date(item.updated_at).toLocaleString()}</div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    className="px-2 py-1 rounded-md border border-border/60 text-xs hover:bg-accent/20"
                    onClick={() => {
                      setSelectedSlug(item.slug);
                      setModalOpen(true);
                    }}
                  >
                    Edit
                  </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md border border-border/60 text-xs hover:bg-accent/20"
                        onClick={async () => {
                          await api.regenerateProfile(item.slug);
                          void loadData();
                        }}
                      >
                        Regen
                      </button>
                      <button
                        type="button"
                        className="px-2 py-1 rounded-md border border-destructive/60 text-xs text-destructive hover:bg-destructive/10"
                        onClick={async () => {
                          if (!window.confirm(`Удалить профиль ${item.slug}?`)) return;
                          await api.deleteProfile(item.slug);
                          setItems((prev) => prev.filter((p) => p.slug !== item.slug));
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                  {item.source === 'generated' && item.title_en && (
                    <a
                      className="p-1 rounded-md border border-border/60 text-xs hover:bg-accent/20 flex items-center gap-1"
                      href={`https://www.sefaria.org/${encodeURIComponent(item.title_en.replace(/\s+/g, '_'))}`}
                      target="_blank"
                      rel="noreferrer"
                      title="Открыть в Sefaria"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProfileInspectorModal
        slug={selectedSlug}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
      />
    </div>
  );
}
