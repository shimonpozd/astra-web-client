import type { YiddishWordCard } from '../../types/yiddish';
import { apiRequest } from '../client';

export interface AdminYiddishWordcardItem {
  lemma: string;
  word_surface?: string | null;
  pos_default?: string | null;
  ui_lang?: string;
  version?: number;
  retrieved_at?: string | null;
  translit_ru?: string | null;
  glosses?: string[];
}

export interface AdminYiddishWordcardListResponse {
  ok: boolean;
  total: number;
  items: AdminYiddishWordcardItem[];
}

export async function adminListYiddishWordcards(params?: {
  prefix?: string;
  q?: string;
  no_glosses?: boolean;
  limit?: number;
  offset?: number;
  ui_lang?: string;
  version?: number;
}): Promise<AdminYiddishWordcardListResponse> {
  const search = new URLSearchParams();
  if (params?.prefix) search.set('prefix', params.prefix);
  if (params?.q) search.set('q', params.q);
  if (params?.no_glosses) search.set('no_glosses', '1');
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.offset) search.set('offset', String(params.offset));
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();

  return apiRequest<AdminYiddishWordcardListResponse>(`/admin/yiddish/wordcards${qs ? `?${qs}` : ''}`);
}

export async function adminGetYiddishWordcard(
  lemma: string,
  params?: { ui_lang?: string; version?: number }
): Promise<{ ok: boolean; data: YiddishWordCard; evidence?: any }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();

  return apiRequest<{ ok: boolean; data: YiddishWordCard; evidence?: any }>(
    `/admin/yiddish/wordcards/${encodeURIComponent(lemma)}${qs ? `?${qs}` : ''}`
  );
}

export async function adminUpdateYiddishWordcard(
  lemma: string,
  payload: { data: YiddishWordCard; evidence?: any },
  params?: { ui_lang?: string; version?: number }
): Promise<{ ok: boolean; data: YiddishWordCard }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();

  return apiRequest<{ ok: boolean; data: YiddishWordCard }>(
    `/admin/yiddish/wordcards/${encodeURIComponent(lemma)}${qs ? `?${qs}` : ''}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}

export async function adminDeleteYiddishWordcard(
  lemma: string,
  params?: { ui_lang?: string; version?: number }
): Promise<{ ok: boolean; deleted: string }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();

  return apiRequest<{ ok: boolean; deleted: string }>(
    `/admin/yiddish/wordcards/${encodeURIComponent(lemma)}${qs ? `?${qs}` : ''}`,
    { method: 'DELETE' }
  );
}

export async function adminCreateYiddishWordcard(
  payload: { data: YiddishWordCard; evidence?: any },
  params?: { ui_lang?: string; version?: number }
): Promise<{ ok: boolean; data: YiddishWordCard }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();

  return apiRequest<{ ok: boolean; data: YiddishWordCard }>(`/admin/yiddish/wordcards${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminBulkUpsertYiddishWordcards(
  payload: { items: Array<{ data?: YiddishWordCard; evidence?: any } | YiddishWordCard> },
  params?: { ui_lang?: string; version?: number }
): Promise<{ ok: boolean; created: number; updated: number; errors: Array<{ index: number; error: string }> }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();

  return apiRequest<{ ok: boolean; created: number; updated: number; errors: Array<{ index: number; error: string }> }>(
    `/admin/yiddish/wordcards/batch${qs ? `?${qs}` : ''}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
}
