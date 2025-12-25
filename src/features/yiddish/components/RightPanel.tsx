import React from 'react';
import clsx from 'clsx';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge.tsx';
import { YiddishToken, YiddishWordCard } from '@/types/yiddish';

interface RightPanelProps {
  recentWords: YiddishToken[];
  wordcardCache: Record<string, YiddishWordCard>;
  selectedSnippet: string | null;
  askAnswer: string | null;
  isAsking: boolean;
  onAskQuestion: (question: string) => void;
  onClearAnswer: () => void;
  onOpenWordcard: (token: YiddishToken) => void;
  onStartMahjong?: () => void;
}

export const RightPanel: React.FC<RightPanelProps> = ({
  recentWords,
  wordcardCache,
  selectedSnippet,
  askAnswer,
  isAsking,
  onAskQuestion,
  onClearAnswer,
  onOpenWordcard,
  onStartMahjong,
}) => {
  const [questionText, setQuestionText] = React.useState('');

  const normalizeKey = (value: string | undefined | null) => {
    if (!value) return '';
    return value
      .replace(/[\u0591-\u05C7]/g, '')
      .replace(/['’ʼʹ′＇\u05f3]/g, '');
  };

  const resolveCard = (token: YiddishToken): YiddishWordCard | null => {
    const direct = wordcardCache[token.lemma] || wordcardCache[token.surface];
    if (direct) return direct;
    const normLemma = normalizeKey(token.lemma);
    const normSurface = normalizeKey(token.surface);
    return (
      (normLemma && wordcardCache[normLemma]) ||
      (normSurface && wordcardCache[normSurface]) ||
      null
    );
  };

  const resolveGlosses = (card: YiddishWordCard | null) => {
    if (!card) return [];
    const popup = card.popup?.gloss_ru_short_list || [];
    if (popup.length) return popup.slice(0, 4);
    const senses = (card.senses || [])
      .map((s) => s.gloss_ru_short || s.gloss_ru_full || '')
      .filter(Boolean);
    return senses.slice(0, 4);
  };

  const canAsk = Boolean(selectedSnippet) && !isAsking;
  const canClear = Boolean(askAnswer) || Boolean(questionText);

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

  const handleAsk = () => {
    if (!canAsk) return;
    onAskQuestion(questionText.trim() || 'Explain selection');
    setQuestionText('');
  };

  const handleClear = () => {
    setQuestionText('');
    onClearAnswer();
  };

  return (
    <div className="h-full flex flex-col gap-3 p-3 overflow-hidden">
      <section className="bg-card border border-border/60 rounded-lg p-3 shadow-sm">
        <div className="text-sm font-semibold mb-2">Ask</div>
        <div className="text-xs text-muted-foreground mb-2">
          Select text in the reader, then ask a short question.
        </div>
        <textarea
          className="w-full min-h-[70px] border rounded px-2 py-1 text-sm bg-background"
          placeholder={selectedSnippet ? 'Type your question' : 'Select text to ask'}
          disabled={!selectedSnippet || isAsking}
          value={questionText}
          onChange={(e) => setQuestionText(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              if (canAsk) handleAsk();
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground truncate">
            {selectedSnippet ? `Selected: ${selectedSnippet}` : 'No selection'}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={!canClear} onClick={handleClear}>
              Clear
            </Button>
            <Button size="sm" disabled={!canAsk} onClick={handleAsk}>
              {isAsking ? '...' : 'Ask'}
            </Button>
          </div>
        </div>
        {askAnswer ? (
          <div className="mt-2 max-h-[160px] overflow-auto text-xs text-foreground bg-muted/50 border border-border/60 rounded p-2 whitespace-pre-wrap">
            {askAnswer}
          </div>
        ) : null}
      </section>

      <section className="bg-card border border-border/60 rounded-lg p-3 shadow-sm flex-1 flex flex-col overflow-hidden">
        <div className="text-sm font-semibold mb-3">Recent words</div>
        {recentWords.length === 0 ? (
          <div className="text-xs text-muted-foreground">Tap words to add them here.</div>
        ) : (
          <div className="space-y-3 overflow-auto">
            {recentWords.map((w) => {
              const card = resolveCard(w);
              const glosses = resolveGlosses(card);
              const posKey = (card?.pos_default || w.pos || '').toUpperCase();
              return (
                <div
                  key={`${w.pid}-${w.start}-${w.end}`}
                  className={clsx(
                    'rounded-xl border border-border/70 bg-muted/20 p-3',
                    posCardClass[posKey] || 'border-l-4 border-transparent',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-lg font-semibold">{w.surface}</div>
                      <div className="text-xs text-muted-foreground">
                        {card?.translit_ru ? `- ${card.translit_ru}` : null}
                      </div>
                    </div>
                    <Badge variant="outline" className="uppercase text-[10px]">
                      {card?.pos_ru_short || card?.pos_ru_full || w.pos}
                    </Badge>
                  </div>
                  {glosses.length ? (
                    <div className="mt-2 text-sm space-y-1">
                      {glosses.map((gloss, idx) => (
                        <div key={idx} className="text-sm">{gloss}</div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-2 text-xs text-muted-foreground">No data.</div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <Button size="sm" variant="secondary" onClick={() => onOpenWordcard(w)}>
                      Подробнее
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        {onStartMahjong ? (
          <div className="pt-3 mt-3 border-t border-border/60">
            <div className="text-xs text-muted-foreground mb-2">Mini review</div>
            <Button size="sm" className="w-full" onClick={onStartMahjong}>
              Start Mahjong
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
};
