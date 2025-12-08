import React, { useEffect, useMemo, useState } from 'react';
import { TalmudicConcept } from '../../types/highlight';
import {
  deleteConcept,
  generateConceptContent,
  listConcepts,
  saveConcept,
} from '../../services/talmudicConcepts';

const emptyConcept: TalmudicConcept = {
  slug: '',
  term_he: '',
  search_patterns: [],
  short_summary_html: '',
  full_article_html: '',
  status: 'draft',
};

const TalmudicConcepts: React.FC = () => {
  const [items, setItems] = useState<TalmudicConcept[]>([]);
  const [current, setCurrent] = useState<TalmudicConcept>(emptyConcept);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.slug.localeCompare(b.slug)),
    [items],
  );

  useEffect(() => {
    void refresh();
  }, []);

  const refresh = async () => {
    try {
      const loaded = await listConcepts();
      setItems(loaded);
    } catch (err: any) {
      setError(err?.message || 'Failed to load concepts');
    }
  };

  const handleSelect = (slug: string) => {
    const found = items.find((c) => c.slug === slug);
    if (found) {
      setCurrent({ ...found });
    }
  };

  const handleNew = () => {
    setCurrent(emptyConcept);
  };

  const handleChange = (field: keyof TalmudicConcept, value: any) => {
    setCurrent((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    if (!current.slug || !current.term_he) {
      setError('Slug и term_he обязательны');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const exists = items.some((c) => c.slug === current.slug);
      const saved = await saveConcept(current, { update: exists });
      setCurrent(saved);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to save concept');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!current.slug) return;
    setIsSaving(true);
    setError(null);
    try {
      await deleteConcept(current.slug);
      setCurrent(emptyConcept);
      await refresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to delete concept');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerate = async () => {
    if (!current.term_he) {
      setError('Введите term_he перед генерацией');
      return;
    }
    setIsGenerating(true);
    setError(null);
    try {
      const generated = await generateConceptContent(current.term_he);
      setCurrent((prev) => ({
        ...prev,
        short_summary_html: generated.short_summary_html,
        full_article_html: generated.full_article_html,
        search_patterns: generated.search_patterns || prev.search_patterns,
      }));
    } catch (err: any) {
      setError(err?.message || 'LLM generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const patternsText = (current.search_patterns || []).join('\n');

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Talmudic Concepts</h2>
          <p className="text-sm text-muted-foreground">
            Управляйте словарём понятий для подсветки и всплывающих подсказок.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 rounded-md bg-muted hover:bg-muted/80 text-sm"
            onClick={handleNew}
          >
            + Новый
          </button>
          <button
            className="px-3 py-2 rounded-md bg-primary text-primary-foreground text-sm disabled:opacity-60"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить'}
          </button>
          {current.slug && (
            <button
              className="px-3 py-2 rounded-md bg-destructive text-destructive-foreground text-sm disabled:opacity-60"
              onClick={handleDelete}
              disabled={isSaving}
            >
              Удалить
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

      <div className="grid grid-cols-12 gap-4 flex-1 min-h-0">
        <div className="col-span-3 border rounded-lg overflow-hidden flex flex-col">
          <div className="border-b px-3 py-2 text-sm font-semibold bg-muted/30">Список</div>
          <div className="flex-1 overflow-y-auto">
            {sortedItems.map((item) => (
              <button
                key={item.slug}
                onClick={() => handleSelect(item.slug)}
                className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-muted/50 ${item.slug === current.slug ? 'bg-primary/10 border-primary/40' : 'border-border/60'}`}
              >
                <div className="font-medium">{item.slug}</div>
                <div className="text-xs text-muted-foreground truncate">{item.term_he}</div>
                <div className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{item.status}</div>
              </button>
            ))}
            {sortedItems.length === 0 && (
              <div className="p-3 text-sm text-muted-foreground">Нет понятий</div>
            )}
          </div>
        </div>

        <div className="col-span-9 border rounded-lg p-4 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <label className="space-y-1">
              <span className="text-sm font-medium">Slug</span>
              <input
                type="text"
                value={current.slug}
                onChange={(e) => handleChange('slug', e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
                placeholder="unique-id"
              />
            </label>
            <label className="space-y-1">
              <span className="text-sm font-medium">Статус</span>
              <select
                value={current.status}
                onChange={(e) => handleChange('status', e.target.value as TalmudicConcept['status'])}
                className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              >
                <option value="draft">draft</option>
                <option value="published">published</option>
              </select>
            </label>
          </div>

          <label className="space-y-1 block">
            <span className="text-sm font-medium">Term (Hebrew)</span>
            <input
              type="text"
              value={current.term_he}
              onChange={(e) => handleChange('term_he', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background"
              placeholder="שבת"
            />
          </label>

          <div className="flex items-center gap-2">
            <div className="text-sm font-medium">Поисковые шаблоны</div>
            <button
              type="button"
              className="px-2 py-1 rounded-md border text-xs"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'LLM…' : 'Сгенерировать контент LLM'}
            </button>
          </div>
          <textarea
            value={patternsText}
            onChange={(e) => handleChange('search_patterns', e.target.value.split(/\n+/).map((s) => s.trim()).filter(Boolean))}
            className="w-full rounded-md border px-3 py-2 text-sm font-mono bg-background h-24"
            placeholder="Регулярные выражения, по одному в строке"
          />

          <label className="space-y-1 block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Краткое описание (HTML)</span>
            </div>
            <textarea
              value={current.short_summary_html || ''}
              onChange={(e) => handleChange('short_summary_html', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background h-28"
            />
          </label>

          <label className="space-y-1 block">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Полная статья (HTML)</span>
            </div>
            <textarea
              value={current.full_article_html || ''}
              onChange={(e) => handleChange('full_article_html', e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm bg-background h-48"
            />
          </label>
        </div>
      </div>
    </div>
  );
};

export default TalmudicConcepts;
