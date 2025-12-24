import { useEffect, useMemo, useState } from 'react';
import { api, AdminYiddishWordcardItem } from '../../services/api';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Textarea } from '../../components/ui/textarea';

const LETTERS = [
  'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ', 'ק', 'ר', 'ש', 'ת',
];

const posCardClass: Record<string, string> = {
  NOUN: 'border-l-4 border-amber-400/70',
  VERB: 'border-l-4 border-emerald-400/70',
  ADJ: 'border-l-4 border-sky-400/70',
  ADV: 'border-l-4 border-indigo-400/70',
  PRON: 'border-l-4 border-rose-400/70',
  PREP: 'border-l-4 border-lime-400/70',
  CONJ: 'border-l-4 border-orange-400/70',
  PART: 'border-l-4 border-cyan-400/70',
  DET: 'border-l-4 border-cyan-400/70',
  HEB_LOAN: 'border-l-4 border-yellow-400/70',
};

export default function YiddishWordcardsAdmin() {
  const [items, setItems] = useState<AdminYiddishWordcardItem[]>([]);
  const [total, setTotal] = useState(0);
  const [prefix, setPrefix] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedLemma, setSelectedLemma] = useState<string | null>(null);
  const [editorValue, setEditorValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [batchValue, setBatchValue] = useState('');
  const [batchResult, setBatchResult] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const totalPages = useMemo(() => (limit ? Math.ceil(total / limit) : 1), [total, limit]);
  const pageIndex = useMemo(() => Math.floor(offset / limit) + 1, [offset, limit]);

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.adminListYiddishWordcards({
        prefix: prefix || undefined,
        q: query || undefined,
        limit,
        offset,
        ui_lang: 'ru',
      });
      setItems(res.items || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load wordcards');
    } finally {
      setLoading(false);
    }
  };

  const openEditor = async (lemma: string) => {
    setIsCreating(false);
    setSelectedLemma(lemma);
    setEditorOpen(true);
    try {
      const res = await api.adminGetYiddishWordcard(lemma, { ui_lang: 'ru' });
      setEditorValue(JSON.stringify(res.data, null, 2));
    } catch (err: any) {
      setEditorValue('');
      setError(err.message || 'Failed to load wordcard');
    }
  };

  const saveEditor = async () => {
    setSaving(true);
    try {
      const parsed = JSON.parse(editorValue);
      if (isCreating) {
        await api.adminCreateYiddishWordcard({ data: parsed }, { ui_lang: 'ru' });
      } else {
        if (!selectedLemma) throw new Error('No lemma selected');
        await api.adminUpdateYiddishWordcard(selectedLemma, { data: parsed }, { ui_lang: 'ru' });
      }
      setEditorOpen(false);
      await loadList();
    } catch (err: any) {
      setError(err.message || 'Failed to save wordcard');
    } finally {
      setSaving(false);
    }
  };

  const deleteEditor = async () => {
    if (!selectedLemma) return;
    const confirmed = window.confirm(`Delete wordcard "${selectedLemma}"? This cannot be undone.`);
    if (!confirmed) return;
    setDeleting(true);
    try {
      await api.adminDeleteYiddishWordcard(selectedLemma, { ui_lang: 'ru' });
      setEditorOpen(false);
      await loadList();
    } catch (err: any) {
      setError(err.message || 'Failed to delete wordcard');
    } finally {
      setDeleting(false);
    }
  };

  const parseBatchPayload = (payload: any) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return null;
  };

  const handleBatchFiles = async (files?: FileList | null) => {
    if (!files || !files.length) return;
    setBatchResult(null);
    try {
      const merged: any[] = [];
      for (const file of Array.from(files)) {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const items = parseBatchPayload(parsed);
        if (!items) {
          throw new Error(`Unsupported JSON structure in ${file.name}`);
        }
        merged.push(...items);
      }
      setBatchValue(JSON.stringify(merged, null, 2));
      setBatchResult(`Loaded ${files.length} file(s), ${merged.length} item(s)`);
    } catch (err: any) {
      setBatchResult(err.message || 'Failed to read batch files');
    }
  };

  const uploadBatch = async () => {
    setUploading(true);
    setBatchResult(null);
    try {
      const parsed = JSON.parse(batchValue);
      const items = parseBatchPayload(parsed);
      if (!items) {
        throw new Error('JSON must be an array or { items: [...] }');
      }
      const res = await api.adminBulkUpsertYiddishWordcards({ items }, { ui_lang: 'ru' });
      setBatchResult(`Created: ${res.created}, Updated: ${res.updated}, Errors: ${res.errors.length}`);
      await loadList();
    } catch (err: any) {
      setBatchResult(err.message || 'Failed to upload batch');
    } finally {
      setUploading(false);
    }
  };

  const openCreate = () => {
    setIsCreating(true);
    setSelectedLemma(null);
    setEditorValue(
      JSON.stringify(
        {
          schema: 'astra.yiddish.wordcard.v1',
          lang: 'yi',
          ui_lang: 'ru',
          word_surface: '',
          lemma: '',
          translit_ru: '',
          pos_default: '',
          pos_ru_short: '',
          pos_ru_full: '',
          popup: { gloss_ru_short_list: [] },
          senses: [],
          flags: { needs_review: true, evidence_missing: true },
          sources: [],
          version: 1,
        },
        null,
        2,
      ),
    );
    setEditorOpen(true);
  };

  useEffect(() => {
    void loadList();
  }, [prefix, query, limit, offset]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Yiddish Wordcards</h2>
          <p className="text-sm text-muted-foreground">Browse, filter, and edit stored wordcards.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <Button size="sm" onClick={openCreate}>New WordCard</Button>
          <span>Total: {total} · Page {pageIndex}/{Math.max(totalPages, 1)}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOffset(0);
          }}
          placeholder="Search lemma or surface"
          className="w-64"
        />
        <Input
          value={prefix}
          onChange={(e) => {
            setPrefix(e.target.value);
            setOffset(0);
          }}
          placeholder="Prefix (first letter)"
          className="w-40"
        />
        <Button
          variant="secondary"
          onClick={() => {
            setPrefix('');
            setQuery('');
            setOffset(0);
          }}
        >
          Reset
        </Button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={offset === 0}
            onClick={() => setOffset(Math.max(0, offset - limit))}
          >
            Prev
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={offset + limit >= total}
            onClick={() => setOffset(offset + limit)}
          >
            Next
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-muted/20 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-sm font-semibold">Batch upload</div>
            <div className="text-xs text-muted-foreground">
              Paste JSON array or load file. Items can be wordcards or {'{data, evidence}'}.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="file"
              accept=".json,application/json"
              multiple
              onChange={(e) => void handleBatchFiles(e.currentTarget.files)}
              className="max-w-[240px]"
            />
            <Button size="sm" onClick={uploadBatch} disabled={uploading || !batchValue.trim()}>
              {uploading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </div>
        <Textarea
          value={batchValue}
          onChange={(e) => setBatchValue(e.currentTarget.value)}
          className="min-h-[180px] font-mono text-xs"
          placeholder='[{"schema":"astra.yiddish.wordcard.v1",...}]'
        />
        {batchResult ? <div className="text-xs text-muted-foreground">{batchResult}</div> : null}
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        {LETTERS.map((letter) => (
          <button
            key={letter}
            type="button"
            onClick={() => {
              setPrefix(letter);
              setOffset(0);
            }}
            className={`px-2 py-1 rounded border ${prefix === letter ? 'bg-primary text-primary-foreground' : 'bg-muted/40 text-foreground'}`}
          >
            {letter}
          </button>
        ))}
      </div>

      {error ? <div className="text-sm text-red-500">{error}</div> : null}

      <div className="space-y-3">
        {loading ? <div className="text-sm text-muted-foreground">Loading...</div> : null}
        {!loading && items.length === 0 ? (
          <div className="text-sm text-muted-foreground">No wordcards found.</div>
        ) : null}
        {items.map((item) => {
          const posKey = (item.pos_default || '').toUpperCase();
          return (
            <div
              key={item.lemma}
              className={`rounded-xl border border-border/70 bg-muted/20 p-3 ${posCardClass[posKey] || 'border-l-4 border-transparent'}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-lg font-semibold">{item.word_surface || item.lemma}</div>
                  <div className="text-xs text-muted-foreground">{item.translit_ru ? `- ${item.translit_ru}` : item.lemma}</div>
                </div>
                <Badge variant="outline" className="uppercase text-[10px]">
                  {item.pos_default || '—'}
                </Badge>
              </div>
              {item.glosses?.length ? (
                <div className="mt-2 text-sm space-y-1">
                  {item.glosses.slice(0, 3).map((gloss, idx) => (
                    <div key={idx} className="text-sm">{gloss}</div>
                  ))}
                </div>
              ) : (
                <div className="mt-2 text-xs text-muted-foreground">No glosses.</div>
              )}
              <div className="mt-3 flex justify-end">
                <Button size="sm" variant="secondary" onClick={() => openEditor(item.lemma)}>
                  Edit JSON
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-w-4xl w-full">
          <DialogHeader>
            <DialogTitle>Edit WordCard JSON</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editorValue}
              onChange={(e) => setEditorValue(e.currentTarget.value)}
              className="min-h-[360px] font-mono text-xs"
              placeholder="WordCard JSON..."
            />
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">{isCreating ? 'New wordcard' : selectedLemma}</div>
              <div className="flex items-center gap-2">
                {!isCreating ? (
                  <Button variant="destructive" onClick={deleteEditor} disabled={saving || deleting}>
                    {deleting ? 'Deleting...' : 'Delete'}
                  </Button>
                ) : null}
                <Button variant="secondary" onClick={() => setEditorOpen(false)} disabled={saving}>
                  Close
                </Button>
                <Button onClick={saveEditor} disabled={saving || !editorValue.trim()}>
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
