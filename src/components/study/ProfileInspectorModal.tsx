import { useEffect, useMemo, useState } from 'react';
import { Loader2, AlertTriangle, ExternalLink, BookOpen, Calendar, MapPin, Award, Pencil, RotateCcw, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { api, ProfileResponse } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface ProfileInspectorModalProps {
  slug: string | null;
  open: boolean;
  onClose: () => void;
}

const ALLOWED_TAGS = new Set(['p', 'h2', 'h3', 'ul', 'li', 'blockquote', 'img', 'small', 'a']);

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

export function ProfileInspectorModal({ slug, open, onClose }: ProfileInspectorModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftSummary, setDraftSummary] = useState('');
  const [draftSummaryAuthor, setDraftSummaryAuthor] = useState('');
  const [draftFactsWork, setDraftFactsWork] = useState('');
  const [draftFactsAuthor, setDraftFactsAuthor] = useState('');
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
      const factsWork = draftFactsWork ? JSON.parse(draftFactsWork) : null;
      const factsAuthor = draftFactsAuthor ? JSON.parse(draftFactsAuthor) : null;
      const mergedFacts: any = { work: factsWork || {}, author: factsAuthor || {} };
      mergedFacts.summary_work_html = draftSummary;
      mergedFacts.summary_author_html = draftSummaryAuthor;
      const res = await api.updateProfile({
        slug,
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
      setDraftFacts(res.facts ? JSON.stringify(res.facts, null, 2) : '');
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

  const facts = data?.facts || {};
  const factsWork = (facts as any)?.work || {};
  const factsAuthor = (facts as any)?.author || {};
  const linksWork = factsWork?.links || {};
  const linksAuthor = factsAuthor?.links || {};
  const authors =
    Array.isArray(factsWork?.authors) ? factsWork?.authors.join(', ') : (factsWork?.authors as string | undefined);
  const categories = Array.isArray(factsWork?.categories) ? factsWork.categories.join(', ') : undefined;
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

            <div className="rounded-lg border border-border/60 bg-muted/30 px-4 py-3 shadow-[0_6px_18px_rgba(0,0,0,0.04)] space-y-3">
              {editMode ? (
                <div className="space-y-3">
                  <label className="block text-xs font-medium text-muted-foreground">HTML — произведение (p,h2,h3,ul,li,blockquote,img,small,a)</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                    value={draftSummary}
                    onChange={(e) => setDraftSummary(e.target.value)}
                  />
                  <label className="block text-xs font-medium text-muted-foreground">HTML — автор</label>
                  <textarea
                    className="w-full min-h-[120px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                    value={draftSummaryAuthor}
                    onChange={(e) => setDraftSummaryAuthor(e.target.value)}
                  />
                  <label className="block text-xs font-medium text-muted-foreground">facts.work (JSON)</label>
                  <textarea
                    className="w-full min-h-[160px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                    value={draftFactsWork}
                    onChange={(e) => setDraftFactsWork(e.target.value)}
                  />
                  <label className="block text-xs font-medium text-muted-foreground">facts.author (JSON)</label>
                  <textarea
                    className="w-full min-h-[140px] rounded-lg border border-border/60 bg-background px-3 py-2 text-sm font-mono"
                    value={draftFactsAuthor}
                    onChange={(e) => setDraftFactsAuthor(e.target.value)}
                  />
                </div>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Произведение</h4>
                    {data?.summary_work_html ? (
                      <div className="prose prose-sm max-w-none leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: data.summary_work_html }} />
                    ) : (
                      <div className="text-sm text-muted-foreground">Нет описания.</div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold mb-1">Автор</h4>
                    {data?.summary_author_html ? (
                      <div className="prose prose-sm max-w-none leading-relaxed space-y-2" dangerouslySetInnerHTML={{ __html: data.summary_author_html }} />
                    ) : (
                      <div className="text-sm text-muted-foreground">Нет данных об авторе.</div>
                    )}
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
              <FactRow label="Период" value={(factsWork as any).period} />
              <FactRow label="Время жизни автора" value={(factsAuthor as any).lifespan} />
              <FactRow label="Дата/место создания" value={[(factsWork as any).compDate || '', (factsWork as any).compPlace || ''].filter(Boolean).join(' · ')} />
              <FactRow label="Дата/место публикации" value={[(factsWork as any).pubDate || '', (factsWork as any).pubPlace || ''].filter(Boolean).join(' · ')} />
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
