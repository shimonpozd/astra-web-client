import type {
  YiddishAttestationRequest,
  YiddishAttestationResponse,
  YiddishExamStartResponse,
  YiddishMahjongSession,
  YiddishQueueEntry,
  YiddishQueueUpdateRequest,
  YiddishQueueUpdateResponse,
  YiddishSichaListItem,
  YiddishSichaMeta,
  YiddishSichaResponse,
  YiddishTtsRequest,
  YiddishTtsResponse,
  YiddishWordCard,
  YiddishVocabEntry,
} from '../types/yiddish';
import { apiRequest } from './client';

export const fallbackYiddishList: YiddishSichaListItem[] = [
  {
    id: 'ls10_miketz_b',
    title: 'Likkutei Sichos 10 · Miketz · B',
    meta: { work: 'Likkutei Sichos', volume: 10, parsha: 'Miketz', section: 'B', lang: 'yi' },
    progress_read_pct: 0,
    progress_vocab: 0,
    last_opened_ts: null,
  },
];

export async function getYiddishSichos(): Promise<YiddishSichaListItem[]> {
  const data = await apiRequest<{ items: YiddishSichaListItem[] }>('/yiddish/sichos', {
    fallback: { items: fallbackYiddishList },
  });
  return data.items || fallbackYiddishList;
}

export async function getYiddishSicha(id: string): Promise<YiddishSichaResponse> {
  try {
    return await apiRequest<YiddishSichaResponse>(`/yiddish/sicha/${encodeURIComponent(id)}`);
  } catch (err) {
    console.warn('Falling back to static yiddish sicha', err);
    const res = await fetch('/yiddish/page_0001.json');
    if (!res.ok) {
      throw err instanceof Error ? err : new Error('Failed to fetch yiddish sicha');
    }
    const data = await res.json();
    return {
      id: data.sicha_id || 'ls10_miketz_b',
      meta: data.meta,
      paragraphs: data.paragraphs,
      tokens: data.tokens || [],
      notes: data.notes || [],
      learned_map: {},
    };
  }
}

export async function postYiddishAttestation(payload: YiddishAttestationRequest): Promise<YiddishAttestationResponse> {
  return apiRequest<YiddishAttestationResponse>('/yiddish/attestation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function updateYiddishQueue(payload: YiddishQueueUpdateRequest): Promise<YiddishQueueUpdateResponse> {
  return apiRequest<YiddishQueueUpdateResponse>('/yiddish/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function startYiddishExam(entries: YiddishQueueEntry[]): Promise<YiddishExamStartResponse> {
  return apiRequest<YiddishExamStartResponse>('/yiddish/exam/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lemmas: entries }),
  });
}

export async function generateYiddishMahjongExam(params?: {
  min_words?: number;
  max_words?: number;
}): Promise<YiddishMahjongSession> {
  return apiRequest<YiddishMahjongSession>('/yiddish/exam/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      min_words: params?.min_words,
      max_words: params?.max_words,
    }),
  });
}

export async function getYiddishVocab(lemma: string): Promise<YiddishVocabEntry | null> {
  return apiRequest<YiddishVocabEntry | null>(`/yiddish/vocab/${encodeURIComponent(lemma)}`, { fallback: null });
}

export async function getYiddishWordCard(params: {
  word: string;
  context?: string;
  lemma_guess?: string;
  pos_guess?: string;
  ui_lang?: string;
  include_evidence?: boolean;
  include_llm_output?: boolean;
  force_refresh?: boolean;
  allow_llm_fallback?: boolean;
}): Promise<YiddishWordCard | null> {
  const search = new URLSearchParams({ word: params.word });
  if (params.context) search.set('context', params.context);
  if (params.lemma_guess) search.set('lemma_guess', params.lemma_guess);
  if (params.pos_guess) search.set('pos_guess', params.pos_guess);
  search.set('ui_lang', params.ui_lang || 'ru');
  if (params.include_evidence) search.set('include_evidence', '1');
  if (params.include_llm_output) search.set('include_llm_output', '1');
  if (params.force_refresh) search.set('force_refresh', '1');
  if (params.allow_llm_fallback) search.set('allow_llm_fallback', '1');

  return apiRequest<YiddishWordCard | null>(`/yiddish/wordcard?${search.toString()}`, { fallback: null });
}

export async function lookupYiddishWordcards(
  payload: { lemmas?: string[]; surfaces?: string[] },
  params?: { ui_lang?: string; version?: number }
): Promise<{ ok: boolean; items: YiddishWordCard[] }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();

  return apiRequest<{ ok: boolean; items: YiddishWordCard[] }>(`/yiddish/wordcards/lookup${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function postYiddishTts(payload: YiddishTtsRequest): Promise<YiddishTtsResponse> {
  return apiRequest<YiddishTtsResponse>('/yiddish/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function askYiddish(payload: {
  selected_text: string;
  sentence_before?: string;
  sentence_after?: string;
  meta: YiddishSichaMeta;
  task?: string;
  known_lemmas?: Array<{ lemma: string; sense_id?: string }>;
  anchor?: any;
  sicha_id?: string;
}): Promise<{ answer: string; task: string }> {
  return apiRequest<{ answer: string; task: string }>('/yiddish/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
