import { DocV1 } from '../types/text';
import { debugLog } from '../utils/debugLogger';
import { config } from '../config';
import { authorizedFetch } from '../lib/authorizedFetch';
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

const fallbackYiddishList: YiddishSichaListItem[] = [
  {
    id: 'ls10_miketz_b',
    title: 'Likkutei Sichos 10 · Miketz · B',
    meta: { work: 'Likkutei Sichos', volume: 10, parsha: 'Miketz', section: 'B', lang: 'yi' },
    progress_read_pct: 0,
    progress_vocab: 0,
    last_opened_ts: null,
  },
];
export interface Chat {
  session_id: string;
  name: string;
  last_modified: string;
  type: 'chat' | 'study' | 'daily';
  completed?: boolean; // For daily chats
  display_value?: string;
  display_value_he?: string;
  display_value_ru?: string;
  daily_category?: string;
   stale?: boolean;
  daily_stream?: {
    stream_id: string;
    units_total: number;
    unit_index_today: number;
  };
}

export interface DailyProgressEntry {
  session_id: string;
  category?: string | null;
  ref?: string | null;
  title?: string | null;
  ts?: string;
}

export interface DailyProgressDay {
  date: string;
  completed: boolean;
  entries: DailyProgressEntry[];
}

export interface DailyProgressResponse {
  today: string;
  streak: { current: number; best: number };
  history: DailyProgressDay[];
}

export interface XpProfile {
  xp_total: number;
  level: number;
  xp_in_level: number;
  xp_to_next: number;
  last_level_up_at?: number | null;
}

export interface XpEventPayload {
  source: 'chat' | 'focus' | 'workbench' | 'lexicon' | 'daily';
  verb?: string;
  session_id?: string;
  ref?: string;
  title?: string;
  chars?: number;
  duration_ms?: number;
  amount?: number;
  event_id?: string;
  ts?: number;
}

export interface XpEvent {
  source: string;
  verb?: string;
  amount: number;
  ref?: string | null;
  title?: string | null;
  ts?: number | null;
}

export interface Achievement {
  category: string;
  level: string;
  value: number;
  to_next: number | null;
}

export interface ProfileImage {
  url?: string;
  alt?: string;
}

export interface ProfileFacts {
  title_en?: string;
  title_he?: string;
  lifespan?: string;
  period?: string;
  compPlace?: string;
  pubPlace?: string;
  categories?: string[];
  authors?: string[] | string;
  links?: Record<string, string>;
  images?: ProfileImage[];
  generated_at?: string;
}

export interface ProfileResponse {
  ok: boolean;
  slug: string;
  title_en?: string;
  title_he?: string;
  summary_html?: string;
  summary_work_html?: string | null;
  summary_author_html?: string | null;
  facts?: { work?: any; author?: any };
  authors?: string[] | string | null;
  lifespan?: string | null;
  period?: string | null;
  comp_place?: string | null;
  pub_place?: string | null;
  json_raw?: any;
  error?: string;
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  source?: 'manual' | 'generated';
}

export interface ProfileListItem {
  slug: string;
  title_en?: string | null;
  title_he?: string | null;
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  updated_at?: string | null;
  source?: 'manual' | 'generated';
}

export interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'system' | 'source';
  content: string | DocV1 | null;
  content_type?: 'text.v1' | 'doc.v1' | 'thought.v1';
  timestamp: number | Date;
}

export interface ZmanimMethod {
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
}

export interface ZmanimMethodsResponse {
  methods: ZmanimMethod[];
}

export interface ZmanimCalculatePayload {
  date: string;
  timezone: string;
  location: {
    name?: string;
    lat: number;
    lon: number;
    elevation_m?: number | null;
  };
  methods: string[];
  use_elevation?: boolean;
  ateret_torah_sunset_offset?: number | null;
}

export interface ZmanimCalculateResponse {
  results: Record<string, string | number | null>;
  errors?: Record<string, string>;
}

export interface ElevationResponse {
  elevation_m: number | null;
  source?: string;
}

interface AdminUserApiKey {
  id: string;
  provider: 'openrouter' | 'openai';
  last_four: string;
  daily_limit: number | null;
  usage_today: number;
  last_reset_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  role: 'admin' | 'member';
  is_active: boolean;
  created_manually: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  api_keys: AdminUserApiKey[];
  phone_number: string | null;
  active_session_count: number;
  total_session_count: number;
}

interface CreateAdminUserPayload {
  username: string;
  password: string;
  role: 'admin' | 'member';
  is_active?: boolean;
}

interface UpdateAdminUserPayload {
  password?: string;
  role?: 'admin' | 'member';
  is_active?: boolean;
}

interface CreateApiKeyPayload {
  provider?: 'openrouter' | 'openai';
  api_key: string;
  daily_limit?: number | null;
}

interface UpdateApiKeyPayload {
  daily_limit?: number | null;
  is_active?: boolean;
}

export interface AdminUserSession {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string;
}

export interface AdminUserLoginEvent {
  id: string;
  username: string | null;
  success: boolean;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

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

interface ChatHistoryResponse {
  history: Message[];
}

export interface ChatRequest {
  text: string;
  session_id?: string;
  agent_id?: string;
  context?: 'focus' | 'workbench-left' | 'workbench-right';
}

export interface StreamEvent<T = unknown> {
  type: string;
  data?: T;
}

export interface StreamHandler {
  onDraft?: (payload: any) => void;
  onChunk?: (chunk: string) => void;
  onDoc?: (doc: DocV1) => void;
  onBlockStart?: (blockData: any) => void;
  onBlockDelta?: (blockData: any) => void;
  onBlockEnd?: (blockData: any) => void;
  onEvent?: (event: StreamEvent) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

// Vite proxy will strip /api, so we call /api from frontend
const API_BASE = config.apiBaseUrl;


async function getChatList(): Promise<Chat[]> {
  try {
    // Combined sessions (chat, study, daily)
    const response = await authorizedFetch(`${API_BASE}/sessions`);
    if (!response.ok) {
      throw new Error(`Failed to fetch sessions: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch session list:', error);
    return [];
  }
}

export interface VirtualDailyChat {
  session_id: string;
  title: string;
  he_title: string;
  title_ru?: string;
  display_value: string;
  he_display_value: string;
  display_value_ru?: string;
  ref: string;
  category: string;
  order: number;
  date: string;
  exists: boolean;
  stream: {
    stream_id: string;
    title: {
      en?: string;
      he?: string;
    };
    units_total: number;
    unit_index_today: number;
  };
}

async function getDailyCalendar(): Promise<VirtualDailyChat[]> {
  try {
    // Get virtual daily chats from backend
    const response = await authorizedFetch(`${API_BASE}/daily/calendar`);
    if (!response.ok) {
      throw new Error(`Failed to get daily calendar: ${response.statusText}`);
    }
    const data = await response.json();
    return data.virtual_chats || [];
  } catch (error) {
    console.error("Failed to fetch daily calendar:", error);
    return [];
  }
}

async function createDailySessionLazy(sessionId: string): Promise<boolean> {
  try {
    const response = await authorizedFetch(`${API_BASE}/daily/create/${sessionId}`, {
      method: 'POST'
    });
    if (!response.ok) {
      throw new Error(`Failed to create daily session: ${response.statusText}`);
    }
    const result = await response.json();
    return result.created || false;
  } catch (error) {
    console.error("Failed to create daily session:", error);
    return false;
  }
}

async function markDailyComplete(sessionId: string, completed: boolean): Promise<{ streak?: { current: number; best: number }; date?: string }> {
  try {
    const response = await authorizedFetch(`${API_BASE}/daily/${sessionId}/complete?completed=${completed}`, {
      method: 'PATCH',
    });
    if (!response.ok) {
      throw new Error(`Failed to mark daily complete: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to mark daily complete:", error);
    throw error;
  }
}

async function getDailyProgress(days: number = 90): Promise<DailyProgressResponse> {
  try {
    const response = await authorizedFetch(`${API_BASE}/daily/progress?days=${days}`);
    if (!response.ok) {
      throw new Error(`Failed to get daily progress: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to get daily progress:", error);
    throw error;
  }
}

async function getDailySegments(sessionId: string): Promise<{
  session_id: string;
  segments: any[];
  total_segments: number;
  loaded_segments: number;
}> {
  try {
    const response = await authorizedFetch(`${API_BASE}/daily/${sessionId}/segments`);
    if (!response.ok) {
      throw new Error(`Failed to get daily segments: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Failed to get daily segments:", error);
    throw error;
  }
}

async function getChatHistory(sessionId: string): Promise<Message[]> {
  try {
    // Corresponds to backend endpoint GET /chats/{sessionId}
    const response = await authorizedFetch(`${API_BASE}/chats/${sessionId}`);
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.statusText}`);
    }
    const data: ChatHistoryResponse = await response.json();
    return data.history || [];
  } catch (error) {
    console.error(`Failed to fetch chat history for ${sessionId}:`, error);
    return [];
  }
}

async function deleteChat(sessionId: string): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/chats/${sessionId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error(`Failed to delete chat: ${response.statusText}`);
    }
  } catch (error) {
    console.error(`Failed to delete chat ${sessionId}:`, error);
    throw error;
  }
}

async function deleteSession(sessionId: string, sessionType: 'chat' | 'study' | 'daily'): Promise<void> {
  try {
    // Daily sessions use a different API endpoint
    if (sessionType === 'daily') {
      return await deleteDailySession(sessionId);
    }
    
    const url = `${API_BASE}/sessions/${sessionId}/${sessionType}`;
    debugLog('API deleteSession call:', {
      url,
      sessionId,
      sessionType,
      method: 'DELETE'
    });
    
    const response = await authorizedFetch(url, {
      method: 'DELETE',
    });
    
    debugLog('API deleteSession response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      url: response.url
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error details');
      console.error('❌ API deleteSession error response:', {
        status: response.status,
        statusText: response.statusText,
        errorText,
        url
      });
      throw new Error(`Failed to delete ${sessionType} session: ${response.status} ${response.statusText} - ${errorText}`);
    }
    
    debugLog('API deleteSession successful');
  } catch (error) {
    console.error(`Failed to delete ${sessionType} session ${sessionId}:`, error);
    throw error;
  }
}

// Convenience function for daily sessions
export async function deleteDailySession(sessionId: string): Promise<void> {
  try {
    // Daily sessions are virtual - they don't exist until created
    // We can't delete what doesn't exist, so we treat this as success
    debugLog('Daily session deletion:', {
      sessionId,
      note: 'Daily sessions are virtual and don\'t exist until created'
    });
    
    // For now, we'll just log that we're "deleting" a virtual session
    // In the future, if daily sessions get persisted, we can add actual deletion logic here
    debugLog('Daily session "deleted" (virtual session)');
  } catch (error) {
    console.error(`Failed to delete daily session ${sessionId}:`, error);
    throw error;
  }
}

async function getStudyState(sessionId: string): Promise<any> {
  try {
    const response = await authorizedFetch(`${API_BASE}/study/state?session_id=${sessionId}`);
    if (!response.ok) {
      throw new Error('Failed to get study state');
    }
    const result = await response.json();
    if (!result.ok || !result.state) {
      throw new Error('Invalid response from get study state');
    }
    return result.state;
  } catch (error) {
    console.error(`Failed to get study state for ${sessionId}:`, error);
    throw error;
  }
}

async function getLexicon(word: string): Promise<any> {
  try {
    const response = await authorizedFetch(`${API_BASE}/study/lexicon?word=${encodeURIComponent(word)}`);
    if (!response.ok) {
      throw new Error('Failed to get lexicon data');
    }
    return await response.json();
  } catch (error) {
    console.error(`Failed to get lexicon for ${word}:`, error);
    throw error;
  }
}

async function getBookshelfCategories(): Promise<Array<{name: string; color: string}>> {
  try {
    const response = await authorizedFetch(`${API_BASE}/study/categories`);
    if (!response.ok) {
      throw new Error('Failed to get bookshelf categories');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get bookshelf categories:', error);
    throw error;
  }
}

async function getBookshelfItems(sessionId: string, ref: string, category?: string): Promise<any> {
  try {
    const response = await authorizedFetch(`${API_BASE}/study/bookshelf`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_id: sessionId, ref, categories: category ? [category] : undefined }),
    });
    if (!response.ok) {
      throw new Error('Failed to get bookshelf items');
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to get bookshelf items:', error);
    throw error;
  }
}

async function getYiddishSichos(): Promise<YiddishSichaListItem[]> {
  try {
    const response = await authorizedFetch(`${API_BASE}/yiddish/sichos`);
    if (!response.ok) {
      throw new Error(`Failed to fetch yiddish sichos: ${response.statusText}`);
    }
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Failed to fetch yiddish sichos', error);
    return fallbackYiddishList;
  }
}

async function getYiddishSicha(id: string): Promise<YiddishSichaResponse> {
  try {
    const response = await authorizedFetch(`${API_BASE}/yiddish/sicha/${encodeURIComponent(id)}`);
    if (!response.ok) {
      const message = await response.text().catch(() => response.statusText);
      throw new Error(`Failed to fetch yiddish sicha ${id}: ${message}`);
    }
    return response.json();
  } catch (err) {
    console.warn('Falling back to static yiddish sicha', err);
    // Static demo fallback (served from /public/yiddish)
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

async function postYiddishAttestation(payload: YiddishAttestationRequest): Promise<YiddishAttestationResponse> {
  const response = await authorizedFetch(`${API_BASE}/yiddish/attestation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to save attestation: ${message}`);
  }
  return response.json();
}

async function updateYiddishQueue(payload: YiddishQueueUpdateRequest): Promise<YiddishQueueUpdateResponse> {
  const response = await authorizedFetch(`${API_BASE}/yiddish/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to update queue: ${message}`);
  }
  return response.json();
}

async function startYiddishExam(entries: YiddishQueueEntry[]): Promise<YiddishExamStartResponse> {
  const response = await authorizedFetch(`${API_BASE}/yiddish/exam/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lemmas: entries }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to start exam: ${message}`);
  }
  return response.json();
}

async function getZmanimMethods(): Promise<ZmanimMethodsResponse> {
  const response = await authorizedFetch(`${API_BASE}/zmanim/methods`);
  if (!response.ok) {
    throw new Error(`Failed to fetch zmanim methods: ${response.statusText}`);
  }
  return response.json();
}

async function calculateZmanim(payload: ZmanimCalculatePayload): Promise<ZmanimCalculateResponse> {
  const response = await authorizedFetch(`${API_BASE}/zmanim/calculate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to calculate zmanim: ${message}`);
  }
  return response.json();
}

async function getElevation(lat: number, lon: number): Promise<ElevationResponse> {
  const response = await authorizedFetch(`${API_BASE}/geo/elevation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lat, lon }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to fetch elevation: ${message}`);
  }
  return response.json();
}

async function generateYiddishMahjongExam(params?: { min_words?: number; max_words?: number }): Promise<YiddishMahjongSession> {
  const response = await authorizedFetch(`${API_BASE}/yiddish/exam/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      min_words: params?.min_words,
      max_words: params?.max_words,
    }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to generate mahjong exam: ${message}`);
  }
  return response.json();
}

async function getYiddishVocab(lemma: string): Promise<YiddishVocabEntry | null> {
  const response = await authorizedFetch(`${API_BASE}/yiddish/vocab/${encodeURIComponent(lemma)}`);
  if (!response.ok) {
    console.warn('Vocab not found or failed', response.statusText);
    return null;
  }
  return response.json();
}


async function getYiddishWordCard(params: {
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
  const search = new URLSearchParams({
    word: params.word,
  });
  if (params.context) search.set('context', params.context);
  if (params.lemma_guess) search.set('lemma_guess', params.lemma_guess);
  if (params.pos_guess) search.set('pos_guess', params.pos_guess);
  search.set('ui_lang', params.ui_lang || 'ru');
  if (params.include_evidence) search.set('include_evidence', '1');
  if (params.include_llm_output) search.set('include_llm_output', '1');
  if (params.force_refresh) search.set('force_refresh', '1');
  if (params.allow_llm_fallback) search.set('allow_llm_fallback', '1');

  const response = await authorizedFetch(`${API_BASE}/yiddish/wordcard?${search.toString()}`);
  if (!response.ok) {
    console.warn('Failed to fetch Yiddish wordcard', await response.text().catch(() => response.statusText));
    return null;
  }
  return response.json();
}

async function lookupYiddishWordcards(
  payload: { lemmas?: string[]; surfaces?: string[] },
  params?: { ui_lang?: string; version?: number },
): Promise<{ ok: boolean; items: YiddishWordCard[] }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();
  const response = await authorizedFetch(`${API_BASE}/yiddish/wordcards/lookup${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to lookup wordcards');
    throw new Error(message || 'Failed to lookup wordcards');
  }
  return response.json();
}

async function postYiddishTts(payload: YiddishTtsRequest): Promise<YiddishTtsResponse> {
  const response = await authorizedFetch(`${API_BASE}/yiddish/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to request TTS: ${message}`);
  }
  return response.json();
}

async function askYiddish(payload: {
  selected_text: string;
  sentence_before?: string;
  sentence_after?: string;
  meta: YiddishSichaMeta;
  task?: string;
  known_lemmas?: Array<{ lemma: string; sense_id?: string }>;
  anchor?: any;
  sicha_id?: string;
}): Promise<{ answer: string; task: string }> {
  const response = await authorizedFetch(`${API_BASE}/yiddish/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`Failed to ask Yiddish agent: ${message}`);
  }
  return response.json();
}

async function getProfile(slug: string): Promise<ProfileResponse> {
  const response = await authorizedFetch(`${API_BASE}/profile?slug=${encodeURIComponent(slug)}`);
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to load profile');
  }
  return response.json();
}

async function updateProfile(payload: { slug: string; summary_html?: string | null; facts?: any; title_en?: string; title_he?: string; title_ru?: string }): Promise<ProfileResponse> {
  const response = await authorizedFetch(`${API_BASE}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to update profile');
  }
  return response.json();
}

async function regenerateProfile(slug: string): Promise<ProfileResponse> {
  const response = await authorizedFetch(`${API_BASE}/profile/regenerate?slug=${encodeURIComponent(slug)}`, {
    method: 'POST',
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to regenerate profile');
  }
  return response.json();
}

async function deleteProfile(slug: string): Promise<void> {
  const response = await authorizedFetch(`${API_BASE}/profile?slug=${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to delete profile');
  }
}

async function listProfiles(params?: { q?: string; unverified?: boolean; limit?: number }): Promise<{ ok: boolean; items: ProfileListItem[] }> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.unverified) search.set('unverified', 'true');
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const response = await authorizedFetch(`${API_BASE}/profile/list${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    throw new Error('Failed to load profile list');
  }
  return response.json();
}


async function adminListUsers(): Promise<AdminUserSummary[]> {
  const response = await authorizedFetch(`${API_BASE}/users`);
  if (!response.ok) {
    throw new Error('Failed to fetch users');
  }
  return response.json();
}

async function adminListUserSessions(userId: string): Promise<AdminUserSession[]> {
  const response = await authorizedFetch(`${API_BASE}/users/${userId}/sessions`);
  if (!response.ok) {
    throw new Error('Failed to fetch user sessions');
  }
  return response.json();
}

async function adminRevokeSession(userId: string, sessionId: string): Promise<void> {
  const response = await authorizedFetch(`${API_BASE}/users/${userId}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to revoke session');
  }
}

async function getXpProfile(): Promise<XpProfile> {
  const response = await authorizedFetch(`${API_BASE}/xp/profile`);
  if (!response.ok) {
    throw new Error(`Failed to get XP profile: ${response.statusText}`);
  }
  return response.json();
}

async function postXpEvent(payload: XpEventPayload): Promise<XpProfile> {
  const response = await authorizedFetch(`${API_BASE}/xp/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Failed to record XP event: ${response.statusText}`);
  }
  return response.json();
}

async function getXpHistory(limit: number = 50): Promise<XpEvent[]> {
  const response = await authorizedFetch(`${API_BASE}/xp/history?limit=${limit}`);
  if (!response.ok) {
    throw new Error(`Failed to get XP history: ${response.statusText}`);
  }
  return response.json();
}

async function getAchievements(): Promise<Achievement[]> {
  const response = await authorizedFetch(`${API_BASE}/achievements`);
  if (!response.ok) {
    throw new Error(`Failed to get achievements: ${response.statusText}`);
  }
  return response.json();
}

async function adminListUserLoginEvents(
  userId: string,
  limit: number = 20,
): Promise<AdminUserLoginEvent[]> {
  const response = await authorizedFetch(`${API_BASE}/users/${userId}/login-events?limit=${limit}`);
  if (!response.ok) {
    throw new Error('Failed to fetch login events');
  }
  return response.json();
}

async function adminCreateUser(payload: CreateAdminUserPayload): Promise<AdminUserSummary> {
  const response = await authorizedFetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, created_manually: true }),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to create user');
    throw new Error(message || 'Failed to create user');
  }
  return response.json();
}

async function adminUpdateUser(userId: string, payload: UpdateAdminUserPayload): Promise<AdminUserSummary> {
  const response = await authorizedFetch(`${API_BASE}/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to update user');
    throw new Error(message || 'Failed to update user');
  }
  return response.json();
}

async function adminCreateUserApiKey(userId: string, payload: CreateApiKeyPayload): Promise<AdminUserApiKey> {
  const response = await authorizedFetch(`${API_BASE}/users/${userId}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to create API key');
    throw new Error(message || 'Failed to create API key');
  }
  return response.json();
}

async function adminUpdateUserApiKey(userId: string, keyId: string, payload: UpdateApiKeyPayload): Promise<AdminUserApiKey> {
  const response = await authorizedFetch(`${API_BASE}/users/${userId}/api-keys/${keyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to update API key');
    throw new Error(message || 'Failed to update API key');
  }
  return response.json();
}

async function adminDeleteUserApiKey(userId: string, keyId: string): Promise<void> {
  const response = await authorizedFetch(`${API_BASE}/users/${userId}/api-keys/${keyId}`, { method: 'DELETE' });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to delete API key');
    throw new Error(message || 'Failed to delete API key');
  }
}

async function adminListYiddishWordcards(params?: {
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
  const response = await authorizedFetch(`${API_BASE}/admin/yiddish/wordcards${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to fetch wordcards');
    throw new Error(message || 'Failed to fetch wordcards');
  }
  return response.json();
}

async function adminGetYiddishWordcard(
  lemma: string,
  params?: { ui_lang?: string; version?: number },
): Promise<{ ok: boolean; data: YiddishWordCard; evidence?: any }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();
  const response = await authorizedFetch(`${API_BASE}/admin/yiddish/wordcards/${encodeURIComponent(lemma)}${qs ? `?${qs}` : ''}`);
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to fetch wordcard');
    throw new Error(message || 'Failed to fetch wordcard');
  }
  return response.json();
}

async function adminUpdateYiddishWordcard(
  lemma: string,
  payload: { data: YiddishWordCard; evidence?: any },
  params?: { ui_lang?: string; version?: number },
): Promise<{ ok: boolean; data: YiddishWordCard }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();
  const response = await authorizedFetch(`${API_BASE}/admin/yiddish/wordcards/${encodeURIComponent(lemma)}${qs ? `?${qs}` : ''}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to update wordcard');
    throw new Error(message || 'Failed to update wordcard');
  }
  return response.json();
}

async function adminDeleteYiddishWordcard(
  lemma: string,
  params?: { ui_lang?: string; version?: number },
): Promise<{ ok: boolean; deleted: string }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();
  const response = await authorizedFetch(`${API_BASE}/admin/yiddish/wordcards/${encodeURIComponent(lemma)}${qs ? `?${qs}` : ''}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to delete wordcard');
    throw new Error(message || 'Failed to delete wordcard');
  }
  return response.json();
}

async function adminCreateYiddishWordcard(
  payload: { data: YiddishWordCard; evidence?: any },
  params?: { ui_lang?: string; version?: number },
): Promise<{ ok: boolean; data: YiddishWordCard }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();
  const response = await authorizedFetch(`${API_BASE}/admin/yiddish/wordcards${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to create wordcard');
    throw new Error(message || 'Failed to create wordcard');
  }
  return response.json();
}

async function adminBulkUpsertYiddishWordcards(
  payload: { items: Array<{ data?: YiddishWordCard; evidence?: any } | YiddishWordCard> },
  params?: { ui_lang?: string; version?: number },
): Promise<{ ok: boolean; created: number; updated: number; errors: Array<{ index: number; error: string }> }> {
  const search = new URLSearchParams();
  if (params?.ui_lang) search.set('ui_lang', params.ui_lang);
  if (params?.version) search.set('version', String(params.version));
  const qs = search.toString();
  const response = await authorizedFetch(`${API_BASE}/admin/yiddish/wordcards/batch${qs ? `?${qs}` : ''}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const message = await response.text().catch(() => 'Failed to upload wordcards');
    throw new Error(message || 'Failed to upload wordcards');
  }
  return response.json();
}


async function explainTerm(term: string, contextText: string, handler: StreamHandler): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/actions/explain-term`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, context_text: contextText }),
    });

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    // The stream is plain text, not NDJSON. Read it directly.
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        handler.onComplete?.();
        break;
      }
      if (value) {
        handler.onChunk?.(value);
      }
    }
  } catch (error) {
    console.error("Failed to explain term:", error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}

async function resolveRef(text: string): Promise<any> {
  const response = await authorizedFetch(`${API_BASE}/study/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    throw new Error('Failed to resolve reference');
  }
  return response.json();
}

async function setFocus(sessionId: string, ref: string, focusRef?: string): Promise<any> {
  const response = await authorizedFetch(`${API_BASE}/study/set_focus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      session_id: sessionId, 
      ref,
      focus_ref: focusRef ?? ref,
      window_size: 30, // Request a wider initial window to prime continuous reading
      navigation_type: "drill_down"
    }),
  });
  if (!response.ok) {
    throw new Error('Failed to set focus');
  }
  const result = await response.json();
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from set_focus');
  }
  return result.state;
}

async function navigateBack(sessionId: string): Promise<any> {
  const response = await authorizedFetch(`${API_BASE}/study/back`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error('Failed to navigate back');
  }
  const result = await response.json();
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from back');
  }
  return result.state;
}

async function navigateForward(sessionId: string): Promise<any> {
  const response = await authorizedFetch(`${API_BASE}/study/forward`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!response.ok) {
    throw new Error('Failed to navigate forward');
  }
  const result = await response.json();
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from forward');
  }
  return result.state;
}

async function setDiscussionFocus(sessionId: string, ref: string): Promise<any> {
  const response = await authorizedFetch(`${API_BASE}/study/chat/set_focus`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, ref }),
  });
  if (!response.ok) {
    throw new Error('Failed to set discussion focus');
  }
  const result = await response.json();
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from set_discussion_focus');
  }
  return result.state;
}

async function sendMessage(request: ChatRequest, handler: StreamHandler): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    const idToIndex = new Map<string, number>();
    let nextIndex = 0;
    const extractObjects = (input: string): { objects: string[]; rest: string } => {
      const objects: string[] = [];
      let i = 0;
      let depth = 0;
      let inString = false;
      let escape = false;
      let start = -1;
      while (i < input.length) {
        const ch = input[i];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === '\\') {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          if (depth === 0) {
            start = i;
          }
          depth += 1;
        } else if (ch === '}') {
          depth -= 1;
          if (depth === 0 && start !== -1) {
            objects.push(input.slice(start, i + 1));
            start = -1;
          }
        }
        i += 1;
      }
      const rest = depth === 0 ? '' : start >= 0 ? input.slice(start) : input;
      return { objects, rest };
    };
  

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        handler.onComplete?.();
        break;
      }

      buffer += value;
      const chunks: string[] = [];
      if (buffer.includes('\n')) {
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) { const t = line.trim(); if (t) chunks.push(t); }
      }
      const extracted = extractObjects(buffer);
      if (extracted.objects.length) { chunks.push(...extracted.objects.map(s => s.trim())); buffer = extracted.rest; }

      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (trimmed === '' || !trimmed.startsWith('{') || trimmed.startsWith('```')) continue;
        try {
          const parsedAny = JSON.parse(trimmed);
          if (parsedAny && typeof parsedAny === 'object' && typeof parsedAny.op === 'string') {
            const op = parsedAny.op as string;
            if (op === 'add_block' && parsedAny.data && typeof parsedAny.data.id === 'string') {
              const { id, type, meta } = parsedAny.data as { id: string; type?: string; meta?: any };
              if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
              const block_index = idToIndex.get(id)!;
              const t = (type || 'p').toLowerCase();
              let block: any = { text: '' }, block_type_for_event = 'paragraph';
              if (t === 'h1') { block = { type: 'heading', level: 1, text: '', meta }; block_type_for_event = 'heading'; }
              else if (t === 'h2') { block = { type: 'heading', level: 2, text: '', meta }; block_type_for_event = 'heading'; }
              else if (t === 'quote') { block = { type: 'quote', text: '', meta }; block_type_for_event = 'quote'; }
              else if (t === 'hr') { block = { type: 'hr' }; block_type_for_event = 'hr'; }
              else { block = { type: 'paragraph', text: '', meta }; block_type_for_event = 'paragraph'; }
              handler.onBlockStart?.({ block_index, block_type: block_type_for_event, block_id: id, block });
              handler.onBlockDelta?.({ block_index, content: block, block: block, delta_type: 'replace' });
              handler.onEvent?.({ type: 'block_start', data: { block_index, block_type: block_type_for_event, block_id: id } });
              continue;
            }
            if (op === 'append_text' && parsedAny.data && typeof parsedAny.data.id === 'string') {
              const { id, text } = parsedAny.data as { id: string; text: string };
              if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
              const block_index = idToIndex.get(id)!;
              handler.onBlockDelta?.({ block_index, content: { text }, block: { text }, delta_type: 'append' });
              handler.onEvent?.({ type: 'block_delta', data: { block_index } });
              continue;
            }
            if (op === 'end') { handler.onComplete?.(); return; }
            continue;
          }
          const event = parsedAny as StreamEvent;
          switch (event.type) {
            case 'llm_chunk': {
              const chunk = typeof event.data === 'string' ? event.data : '';
              if (chunk) {
                handler.onChunk?.(chunk);
                handler.onDraft?.(event.data as any);
              }
              handler.onEvent?.(event);
              break;
            }
            case 'doc_v1': {
              handler.onDoc?.(event.data as DocV1);
              handler.onEvent?.(event);
              break;
            }
            case 'full_response': {
              // Handle full response as text content
              const text = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
              handler.onChunk?.(text);
              handler.onEvent?.(event);
              break;
            }
            case 'error': {
              handler.onEvent?.(event);
              const message = typeof event.data === 'string' ? event.data : 'Stream error';
              handler.onError?.(new Error(message));
              break;
            }
            default: {
              handler.onEvent?.(event);
              break;
            }
          }
        } catch (e) {
          console.error('Failed to parse stream event:', trimmed, e);
        }
      }
    }
  } catch (error) {
    console.error("Failed to send message:", error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}

async function sendMessageWithBlocks(request: ChatRequest, handler: StreamHandler): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/chat/stream-blocks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    const idToIndex = new Map<string, number>();
    let nextIndex = 0;
    const extractObjects = (input: string): { objects: string[]; rest: string } => {
      const objects: string[] = [];
      let i = 0;
      let depth = 0;
      let inString = false;
      let escape = false;
      let start = -1;
      while (i < input.length) {
        const ch = input[i];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === '\\') {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          if (depth === 0) {
            start = i;
          }
          depth += 1;
        } else if (ch === '}') {
          depth -= 1;
          if (depth === 0 && start !== -1) {
            objects.push(input.slice(start, i + 1));
            start = -1;
          }
        }
        i += 1;
      }
      const rest = depth === 0 ? '' : start >= 0 ? input.slice(start) : input;
      return { objects, rest };
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        handler.onComplete?.();
        break;
      }

      buffer += value;
      // Prefer newline framing, but also support brace-balanced framing
      const chunks: string[] = [];
      if (buffer.includes('\n')) {
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          const t = line.trim();
          if (t) chunks.push(t);
        }
      }
      // Extract any complete JSON objects left in buffer (for non-newline streams)
      const extracted = extractObjects(buffer);
      if (extracted.objects.length) {
        chunks.push(...extracted.objects.map(s => s.trim()));
        buffer = extracted.rest;
      }

      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (trimmed === '' || !trimmed.startsWith('{') || trimmed.startsWith('```')) continue;
        try {
          const parsed = JSON.parse(trimmed);

          // Translate NDJSON op protocol into existing block_* events
          if (parsed && typeof parsed === 'object' && typeof parsed.op === 'string') {
            const op = parsed.op as string;
            if (op === 'add_block' && parsed.data && typeof parsed.data.id === 'string') {
              const { id, type, meta } = parsed.data as { id: string; type?: string; meta?: any };
              if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
              const block_index = idToIndex.get(id)!;
              // Normalize NDJSON type to internal renderer schema
              const t = (type || 'p').toLowerCase();
              let block: any = { text: '' };
              let block_type_for_event = 'paragraph';
              if (t === 'h1') { block = { type: 'heading', level: 1, text: '', meta }; block_type_for_event = 'heading'; }
              else if (t === 'h2') { block = { type: 'heading', level: 2, text: '', meta }; block_type_for_event = 'heading'; }
              else if (t === 'quote') { block = { type: 'quote', text: '', meta }; block_type_for_event = 'quote'; }
              else if (t === 'hr') { block = { type: 'hr' }; block_type_for_event = 'hr'; }
              else { block = { type: 'paragraph', text: '', meta }; block_type_for_event = 'paragraph'; }

              handler.onBlockStart?.({ block_index, block_type: block_type_for_event, block_id: id, block });
              handler.onEvent?.({ type: 'block_start', data: { block_index, block_type: block_type_for_event, block_id: id } });
              // Also emit an initial delta to set the block type/structure for UIs that only handle deltas
              handler.onBlockDelta?.({ block_index, content: block, delta_type: 'replace' });
              continue;
            }
            if (op === 'append_text' && parsed.data && typeof parsed.data.id === 'string') {
              const { id, text } = parsed.data as { id: string; text: string };
              if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
              const block_index = idToIndex.get(id)!;
              // Provide both shapes for compatibility (content used by BrainChatWithBlocks)
              handler.onBlockDelta?.({ block_index, content: { text }, block: { text }, delta_type: 'append' });
              handler.onEvent?.({ type: 'block_delta', data: { block_index } });
              continue;
            }
            if (op === 'end') {
              handler.onComplete?.();
              return;
            }
            continue;
          }

          const event = parsed as StreamEvent;
          switch (event.type) {
            case 'block_start': {
              handler.onBlockStart?.(event.data as any);
              handler.onEvent?.(event);
              break;
            }
            case 'block_delta': {
              handler.onBlockDelta?.(event.data as any);
              handler.onEvent?.(event);
              break;
            }
            case 'block_end': {
              handler.onBlockEnd?.(event.data as any);
              handler.onEvent?.(event);
              break;
            }
            case 'llm_chunk': {
              const chunk = typeof event.data === 'string' ? event.data : '';
              if (chunk) {
                handler.onChunk?.(chunk);
                handler.onDraft?.(event.data as any);
              }
              handler.onEvent?.(event);
              break;
            }
            case 'doc_v1': {
              handler.onDoc?.(event.data as DocV1);
              handler.onEvent?.(event);
              break;
            }
            case 'full_response': {
              // Handle full response as text content
              const text = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
              handler.onChunk?.(text);
              handler.onEvent?.(event);
              break;
            }
            case 'error': {
              handler.onEvent?.(event);
              const message = typeof event.data === 'string' ? event.data : 'Stream error';
              handler.onError?.(new Error(message));
              break;
            }
            default: {
              handler.onEvent?.(event);
              break;
            }
          }
        } catch (e) {
          console.error('Failed to parse stream event:', trimmed, e);
        }
      }
    }
  } catch (error) {
    console.error("Failed to send message with blocks:", error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}

async function sendStudyMessage(
  sessionId: string, 
  text: string, 
  handler: StreamHandler, 
  agentId?: string,
  selectedPanelId?: string | null
): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/study/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        session_id: sessionId, 
        text,
        agent_id: agentId,
        selected_panel_id: selectedPanelId
      }),
    });

    if (!response.body) {
      throw new Error("Response body is empty");
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    const idToIndex = new Map<string, number>();
    let nextIndex = 0;
    const extractObjects = (input: string): { objects: string[]; rest: string } => {
      const objects: string[] = [];
      let i = 0;
      let depth = 0;
      let inString = false;
      let escape = false;
      let start = -1;
      while (i < input.length) {
        const ch = input[i];
        if (inString) {
          if (escape) {
            escape = false;
          } else if (ch === '\\') {
            escape = true;
          } else if (ch === '"') {
            inString = false;
          }
        } else if (ch === '"') {
          inString = true;
        } else if (ch === '{') {
          if (depth === 0) {
            start = i;
          }
          depth += 1;
        } else if (ch === '}') {
          depth -= 1;
          if (depth === 0 && start !== -1) {
            objects.push(input.slice(start, i + 1));
            start = -1;
          }
        }
        i += 1;
      }
      const rest = depth === 0 ? '' : start >= 0 ? input.slice(start) : input;
      return { objects, rest };
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        handler.onComplete?.();
        break;
      }

      buffer += value;
      const chunks: string[] = [];
      if (buffer.includes('\n')) {
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) { const t = line.trim(); if (t) chunks.push(t); }
      }
      const extracted = extractObjects(buffer);
      if (extracted.objects.length) { chunks.push(...extracted.objects.map(s => s.trim())); buffer = extracted.rest; }

      for (const chunk of chunks) {
        const trimmed = chunk.trim();
        if (trimmed === '' || !trimmed.startsWith('{') || trimmed.startsWith('```')) continue;
        try {
          const parsedAny = JSON.parse(trimmed);
          if (parsedAny && typeof parsedAny === 'object' && typeof parsedAny.op === 'string') {
            const op = parsedAny.op as string;
            if (op === 'add_block' && parsedAny.data && typeof parsedAny.data.id === 'string') {
              const { id, type, meta } = parsedAny.data as { id: string; type?: string; meta?: any };
              if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
              const block_index = idToIndex.get(id)!;
              const t = (type || 'p').toLowerCase();
              let block: any = { text: '' }, block_type_for_event = 'paragraph';
              if (t === 'h1') { block = { type: 'heading', level: 1, text: '', meta }; block_type_for_event = 'heading'; }
              else if (t === 'h2') { block = { type: 'heading', level: 2, text: '', meta }; block_type_for_event = 'heading'; }
              else if (t === 'quote') { block = { type: 'quote', text: '', meta }; block_type_for_event = 'quote'; }
              else if (t === 'hr') { block = { type: 'hr' }; block_type_for_event = 'hr'; }
              else { block = { type: 'paragraph', text: '', meta }; block_type_for_event = 'paragraph'; }
              handler.onBlockStart?.({ block_index, block_type: block_type_for_event, block_id: id, block });
              handler.onBlockDelta?.({ block_index, content: block, block: block, delta_type: 'replace' });
              handler.onEvent?.({ type: 'block_start', data: { block_index, block_type: block_type_for_event, block_id: id } });
              continue;
            }
            if (op === 'append_text' && parsedAny.data && typeof parsedAny.data.id === 'string') {
              const { id, text } = parsedAny.data as { id: string; text: string };
              if (!idToIndex.has(id)) idToIndex.set(id, nextIndex++);
              const block_index = idToIndex.get(id)!;
              handler.onBlockDelta?.({ block_index, content: { text }, block: { text }, delta_type: 'append' });
              handler.onEvent?.({ type: 'block_delta', data: { block_index } });
              continue;
            }
            if (op === 'end') { handler.onComplete?.(); return; }
            continue;
          }
          const event = parsedAny as StreamEvent;
          switch (event.type) {
            case 'llm_chunk': {
              const chunk = typeof event.data === 'string' ? event.data : '';
              if (chunk) {
                handler.onChunk?.(chunk);
                handler.onDraft?.(event.data as any);
              }
              handler.onEvent?.(event);
              break;
            }
            case 'doc_v1': {
              handler.onDoc?.(event.data as DocV1);
              handler.onEvent?.(event);
              break;
            }
            case 'full_response': {
              // Handle full response as text content
              const text = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
              handler.onChunk?.(text);
              handler.onEvent?.(event);
              break;
            }
            case 'error': {
              handler.onEvent?.(event);
              const message = typeof event.data === 'string' ? event.data : 'Stream error';
              handler.onError?.(new Error(message));
              break;
            }
            default: {
              handler.onEvent?.(event);
              break;
            }
          }
        } catch (e) {
          console.error('Failed to parse stream event:', trimmed, e);
        }
      }
    }
  } catch (error) {
    console.error("Failed to send study message:", error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}

export const api = {
  getChatList,
  getChatHistory,
  deleteChat,
  deleteSession,
  sendMessage,
  sendMessageWithBlocks,
  sendStudyMessage,
  resolveRef,
  setFocus,
  setDiscussionFocus,
  navigateBack,
  navigateForward,
  getStudyState,
  getLexicon,
  getBookshelfCategories,
  getBookshelfItems,
  getProfile,
  updateProfile,
  regenerateProfile,
  deleteProfile,
  listProfiles,
  getYiddishSichos,
  getYiddishSicha,
  postYiddishAttestation,
  updateYiddishQueue,
  startYiddishExam,
  generateYiddishMahjongExam,
  getYiddishVocab,
  getYiddishWordCard,
  lookupYiddishWordcards,
  postYiddishTts,
  askYiddish,
  explainTerm,
  getDailyCalendar,
  createDailySessionLazy,
  markDailyComplete,
  getDailyProgress,
  getDailySegments,
  getZmanimMethods,
  calculateZmanim,
  getElevation,
  getXpProfile,
  postXpEvent,
  getXpHistory,
  getAchievements,
  adminListUsers,
  adminCreateUser,
  adminUpdateUser,
  adminCreateUserApiKey,
  adminUpdateUserApiKey,
  adminDeleteUserApiKey,
  adminListUserSessions,
  adminRevokeSession,
  adminListUserLoginEvents,
  adminListYiddishWordcards,
  adminGetYiddishWordcard,
  adminUpdateYiddishWordcard,
  adminCreateYiddishWordcard,
  adminDeleteYiddishWordcard,
  adminBulkUpsertYiddishWordcards,
};

export type {
  AdminUserSummary,
  AdminUserSession,
  AdminUserLoginEvent,
  AdminYiddishWordcardItem,
  AdminYiddishWordcardListResponse,
  ProfileResponse,
  YiddishSichaListItem,
  YiddishSichaResponse,
};
