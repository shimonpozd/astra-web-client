
import { create } from 'zustand';
import { api } from '../services/api';
import { debugLog } from '../utils/debugLogger';

interface LexiconState {
  term: string | null;
  context: string | null;
  explanation: string;
  isLoading: boolean;
  isPanelOpen: boolean;
  error: string | null;
  setSelection: (term: string | null, context: string | null) => void;
  fetchExplanation: () => Promise<void>;
  closePanel: () => void;
}

export const useLexiconStore = create<LexiconState>((set, get) => ({
  term: null,
  context: null,
  explanation: '',
  isLoading: false,
  isPanelOpen: false,
  error: null,

  setSelection: (term, context) => {
    debugLog('[LexiconStore] setSelection:', term, context);
    set({ term, context });
  },

  fetchExplanation: async () => {
    const { term, context, isLoading } = get();
    debugLog('[LexiconStore] fetchExplanation called, term:', term, 'context:', context, 'isLoading:', isLoading);
    if (!term || isLoading) {
      debugLog('[LexiconStore] Skipping fetch: no term or already loading');
      return; // Prevent concurrent fetches
    }

    debugLog('[LexiconStore] Starting fetch, opening panel');
    set({ isLoading: true, explanation: '', error: null, isPanelOpen: true });

    try {
      let currentText = '';

      await api.explainTerm(term, context || '', {
        onChunk: (chunk: string) => {
          if (!chunk) {
            return;
          }
          currentText += chunk;
          set({ explanation: currentText });
        },
        onComplete: () => {
          debugLog('[LexiconStore] Fetch complete, explanation:', currentText);
          set({ explanation: currentText, isLoading: false });
        },
        onError: (error: Error) => {
          console.error('[LexiconStore] Failed to fetch explanation:', error);
          set({
            explanation: 'Failed to load explanation.',
            error: error.message,
            isLoading: false
          });
        }
      });
    } catch (error) {
      console.error('[LexiconStore] Failed to fetch explanation:', error);
      set({
        explanation: 'Failed to load explanation.',
        error: (error as Error).message,
        isLoading: false
      });
    }
  },

  closePanel: () => {
    set({
      isPanelOpen: false,
      explanation: '',
      term: null,
      context: null,
      isLoading: false,
      error: null,
    });
  },
}));
