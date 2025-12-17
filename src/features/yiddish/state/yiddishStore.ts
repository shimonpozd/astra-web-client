import { create } from 'zustand';
import { api } from '@/services/api';
import {
  YiddishAttestationRequest,
  YiddishQueueEntry,
  YiddishQueueUpdateRequest,
  YiddishSichaListItem,
  YiddishSichaResponse,
  YiddishToken,
  YiddishVocabEntry,
  YiddishWordCard,
} from '@/types/yiddish';

export type HighlightMode = 'off' | 'pos' | 'learned';
export type PopupMode = 'hover' | 'click';
export type DetailLevel = 'minimal' | 'detailed';

interface YiddishState {
  highlightMode: HighlightMode;
  popupMode: PopupMode;
  detailLevel: DetailLevel;
  sichos: YiddishSichaListItem[];
  selectedSichaId: string | null;
  currentSicha: YiddishSichaResponse | null;
  isLoadingList: boolean;
  isLoadingSicha: boolean;
  selectedToken: YiddishToken | null;
  selectedVocab: YiddishVocabEntry | null;
  isLoadingVocab: boolean;
  selectedWordcard: YiddishWordCard | null;
  isLoadingWordcard: boolean;
  wordcardCache: Record<string, YiddishWordCard>;
  error: string | null;
  recentWords: YiddishToken[];
  queue: YiddishQueueEntry[];
  selectedSnippet: string;
  askAnswer: string | null;
  isAsking: boolean;
  loadSichos: () => Promise<void>;
  loadSicha: (id: string) => Promise<void>;
  selectSicha: (id: string) => void;
  selectToken: (token: YiddishToken) => Promise<void>;
  clearToken: () => void;
  setHighlightMode: (mode: HighlightMode) => void;
  setPopupMode: (mode: PopupMode) => void;
  setDetailLevel: (level: DetailLevel) => void;
  fetchWordcard: (token: YiddishToken, options?: { forceRefresh?: boolean }) => Promise<void>;
  addRecentWord: (token: YiddishToken) => void;
  addToQueue: (entry: YiddishQueueEntry) => Promise<void>;
  removeFromQueue: (entry: YiddishQueueEntry) => Promise<void>;
  saveAttestation: (payload: YiddishAttestationRequest) => Promise<void>;
  setSnippet: (text: string) => void;
  askQuestion: (question: string, meta: any) => Promise<void>;
  clearAskAnswer: () => void;
  loadGloss: (token: YiddishToken, meta: any) => Promise<string | null>;
}

const RECENT_LIMIT = 10;
const RECENT_STORAGE_KEY = 'yiddish.recentWords.v1';
const WORDCARD_STORAGE_KEY = 'yiddish.wordcardCache.v1';

const loadRecentWordsFromStorage = (): YiddishToken[] => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(RECENT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, RECENT_LIMIT);
  } catch {
    return [];
  }
};

const saveRecentWordsToStorage = (items: YiddishToken[]) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // ignore storage errors
  }
};

const loadWordcardCacheFromStorage = (): Record<string, YiddishWordCard> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(WORDCARD_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    return parsed as Record<string, YiddishWordCard>;
  } catch {
    return {};
  }
};

const saveWordcardCacheToStorage = (cache: Record<string, YiddishWordCard>) => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WORDCARD_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors
  }
};

const buildWordcardCacheUpdate = (
  cache: Record<string, YiddishWordCard>,
  card: YiddishWordCard,
  token?: YiddishToken,
) => {
  const next = { ...cache };
  if (card.lemma) next[card.lemma] = card;
  if (card.word_surface) next[card.word_surface] = card;
  if (token?.lemma) next[token.lemma] = card;
  if (token?.surface) next[token.surface] = card;
  return next;
};

const buildVocabFromWordcard = (card: YiddishWordCard, token: YiddishToken): YiddishVocabEntry => {
  const senses = (card.senses || []).map((s) => ({
    sense_id: s.sense_id,
    gloss_ru: s.gloss_ru_short || s.gloss_ru_full || '',
    examples: s.examples?.map((e) => `${e.yi} - ${e.ru}`),
  }));
  if (!senses.length && card.popup?.gloss_ru_short_list?.length) {
    return {
      lemma: card.lemma,
      pos: (card.pos_default as any) || token.pos,
      senses: card.popup.gloss_ru_short_list.map((gloss, idx) => ({
        sense_id: `${card.lemma || token.lemma}:${idx + 1}`,
        gloss_ru: gloss,
        examples: [],
      })),
    };
  }
  return {
    lemma: card.lemma,
    pos: (card.pos_default as any) || token.pos,
    senses,
  };
};

export const useYiddishStore = create<YiddishState>((set, get) => ({
  highlightMode: 'off',
  popupMode: 'click',
  detailLevel: 'minimal',
  sichos: [],
  selectedSichaId: null,
  currentSicha: null,
  isLoadingList: false,
  isLoadingSicha: false,
  selectedToken: null,
  selectedVocab: null,
  isLoadingVocab: false,
  selectedWordcard: null,
  isLoadingWordcard: false,
  wordcardCache: loadWordcardCacheFromStorage(),
  error: null,
  recentWords: loadRecentWordsFromStorage(),
  queue: [],
  selectedSnippet: '',
  askAnswer: null,
  isAsking: false,

  async loadSichos() {
    if (get().isLoadingList) return;
    set({ isLoadingList: true, error: null });
    try {
      const items = await api.getYiddishSichos();
      set({ sichos: items });
      if (items.length > 0 && !get().selectedSichaId) {
        set({ selectedSichaId: items[0].id });
      }
    } catch (err) {
      console.error('Failed to load sichos list', err);
      set({ error: 'Failed to load sichos list', sichos: [] });
    } finally {
      set({ isLoadingList: false });
    }
  },

  async loadSicha(id: string) {
    if (get().isLoadingSicha) return;
    set({ isLoadingSicha: true, error: null });
    try {
      const data = await api.getYiddishSicha(id);
      set({ currentSicha: data, selectedSichaId: id });
    } catch (err) {
      console.error('Failed to load sicha', err);
      set({ error: 'Failed to load sicha', currentSicha: null });
    } finally {
      set({ isLoadingSicha: false });
    }
  },

  selectSicha(id: string) {
    set({ selectedSichaId: id });
  },

  async selectToken(token) {
    const cache = get().wordcardCache;
    const cached = cache[token.lemma];
    if (cached) {
      set({
        selectedToken: token,
        selectedWordcard: cached,
        selectedVocab: buildVocabFromWordcard(cached, token),
        isLoadingVocab: false,
      });
      if (cached.morphology === undefined) {
        get().fetchWordcard(token, { forceRefresh: false });
      }
      return;
    }
    set({ selectedToken: token, isLoadingVocab: true, selectedVocab: null });
    await get().fetchWordcard(token, { forceRefresh: false });
  },

  clearToken() {
    set({ selectedToken: null, selectedVocab: null, isLoadingVocab: false });
  },

  setHighlightMode(mode) {
    set({ highlightMode: mode });
  },

  setPopupMode(mode) {
    set({ popupMode: mode });
  },

  setDetailLevel(level) {
    set({ detailLevel: level });
  },

  addRecentWord(token) {
    const existing = get().recentWords;
    const deduped = [token, ...existing.filter(t => `${t.pid}-${t.start}-${t.end}` !== `${token.pid}-${token.start}-${token.end}`)];
    const trimmed = deduped.slice(0, RECENT_LIMIT);
    set({ recentWords: trimmed });
    saveRecentWordsToStorage(trimmed);
  },

  async addToQueue(entry) {
    const current = get().queue;
    const key = `${entry.lemma}-${entry.sense_id}`;
    if (current.some(item => `${item.lemma}-${item.sense_id}` === key)) {
      return;
    }
    set({ queue: [entry, ...current] });
    try {
      const payload: YiddishQueueUpdateRequest = { ...entry, action: 'add' };
      await api.updateYiddishQueue(payload);
    } catch (err) {
      console.warn('Queue sync failed (add), keeping local only', err);
    }
  },

  async removeFromQueue(entry) {
    const filtered = get().queue.filter(
      item => !(item.lemma === entry.lemma && item.sense_id === entry.sense_id),
    );
    set({ queue: filtered });
    try {
      const payload: YiddishQueueUpdateRequest = { ...entry, action: 'remove' };
      await api.updateYiddishQueue(payload);
    } catch (err) {
      console.warn('Queue sync failed (remove), keeping local only', err);
    }
  },

  async saveAttestation(payload) {
    try {
      await api.postYiddishAttestation(payload);
      // Update learned_map locally so highlights react immediately
      const current = get().currentSicha;
      if (current) {
        const updatedMap = { ...(current.learned_map || {}) };
        const arr = updatedMap[payload.lemma] || [];
        if (!arr.includes(payload.sense_id)) {
          arr.push(payload.sense_id);
          updatedMap[payload.lemma] = arr;
          set({ currentSicha: { ...current, learned_map: updatedMap } });
        }
      }
    } catch (err) {
      console.warn('Attestation save failed (will stay local)', err);
    }
  },

  async askExplain(task) {
    // Deprecated
  },

  setSnippet(text) {
    set({ selectedSnippet: text });
  },

  clearAskAnswer() {
    set({ askAnswer: null });
  },

  async askQuestion(question, meta) {
    const snippet = get().selectedSnippet;
    const sicha = get().currentSicha;
    if (!snippet || !sicha) return;
    set({ isAsking: true, askAnswer: null });
    try {
      const resp = await api.askYiddish({
        selected_text: snippet,
        sentence_before: '',
        sentence_after: '',
        meta: meta || sicha.meta,
        task: question || 'Поясни фрагмент',
        known_lemmas: [],
        anchor: {},
        sicha_id: sicha.id,
      });
      set({ askAnswer: resp.answer, isAsking: false });
    } catch (err) {
      console.error('Yiddish ask failed', err);
      set({ askAnswer: 'Ошибка запроса к агенту', isAsking: false });
    }
  },

  async loadGloss() {
    return null;
  },
  async fetchWordcard(token, options) {
    const forceRefresh = options?.forceRefresh ?? false;
    const existing = get().selectedWordcard;
    if (!forceRefresh && existing && existing.lemma === token.lemma) {
      set({ isLoadingVocab: false });
      return;
    }
    set({ isLoadingWordcard: true, selectedWordcard: null });
    try {
      const card = await api.getYiddishWordCard({
        word: token.surface,
        lemma_guess: token.lemma,
        pos_guess: token.pos,
        ui_lang: 'ru',
        include_evidence: false,
        include_llm_output: false,
        force_refresh: forceRefresh,
        allow_llm_fallback: true,
      });
      if (card) {
        const normalizedCard = card.morphology === undefined ? { ...card, morphology: null } : card;
        set((state) => {
          const nextCache = buildWordcardCacheUpdate(state.wordcardCache, normalizedCard, token);
          saveWordcardCacheToStorage(nextCache);
          return {
            selectedWordcard: normalizedCard,
            selectedVocab: buildVocabFromWordcard(normalizedCard, token),
            wordcardCache: nextCache,
          };
        });
        return;
      }
      // fallback to stub vocab
      const vocab = await api.getYiddishVocab(token.lemma);
      set({ selectedVocab: vocab });
    } catch (err) {
      console.warn('Failed to load wordcard/vocab', err);
      try {
        const vocab = await api.getYiddishVocab(token.lemma);
        set({ selectedVocab: vocab });
      } catch (err2) {
        set({ selectedVocab: null });
      }
    } finally {
      set({ isLoadingWordcard: false, isLoadingVocab: false });
    }
  },
}));
