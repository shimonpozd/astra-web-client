import { useEffect, useMemo, useState } from 'react';
import { api, ProfileListItem } from '../../services/api';
import { Input } from '../../components/ui/input';
import { Loader2, RefreshCw, Search, ShieldCheck, ShieldAlert, ExternalLink } from 'lucide-react';
import ProfileInspectorModal from '../../components/study/ProfileInspectorModal';

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
