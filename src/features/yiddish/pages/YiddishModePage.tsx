import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge.tsx';
import TopBar from '@/components/layout/TopBar';
import { TextStudyReader } from '../components/TextStudyReader';
import { RightPanel } from '../components/RightPanel';
import { useYiddishStore, HighlightMode, PopupMode } from '../state/yiddishStore';
import type { YiddishPosTag, YiddishToken } from '@/types/yiddish';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { authStorage } from '@/lib/authStorage';
import { api } from '@/services/api';

const highlightOptions: Array<{ value: HighlightMode; label: string }> = [
  { value: 'off', label: 'Без подсветки' },
  { value: 'pos', label: 'Части речи' },
  { value: 'learned', label: 'Выученные' },
];

const popupOptions: Array<{ value: PopupMode; label: string }> = [
  { value: 'hover', label: 'Hover' },
  { value: 'click', label: 'Click' },
];

export default function YiddishModePage() {
  const [popover, setPopover] = useState<{ token: YiddishToken; rect: DOMRect } | null>(null);
  const [isWordcardOpen, setIsWordcardOpen] = useState(false);
  const [isAdminEditorOpen, setIsAdminEditorOpen] = useState(false);
  const [adminEditorValue, setAdminEditorValue] = useState('');
  const [adminSaving, setAdminSaving] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const {
    highlightMode,
    popupMode,
    detailLevel,
    sichos,
    selectedSichaId,
    currentSicha,
    isLoadingList,
    isLoadingSicha,
    selectedToken,
    selectedVocab,
    isLoadingVocab,
    selectedWordcard: wordcard,
    isLoadingWordcard,
    error,
    recentWords,
    wordcardCache,
    loadSichos,
    loadSicha,
    selectSicha,
    selectToken,
    setHighlightMode,
    setPopupMode,
    setDetailLevel,
    fetchWordcard,
    addRecentWord,
    askAnswer,
    isAsking,
    clearAskAnswer,
    selectedSnippet,
    setSnippet,
    askQuestion,
  } = useYiddishStore();

  const isAdmin = useMemo(() => authStorage.getUser()?.role === 'admin', []);

  const knownLemmas = useMemo(() => new Set(Object.keys(wordcardCache || {})), [wordcardCache]);
  const posOverrides = useMemo(() => {
    const map: Record<string, YiddishPosTag> = {};
    Object.values(wordcardCache || {}).forEach((card) => {
      const pos = card?.pos_default as YiddishPosTag | undefined;
      if (!pos) return;
      if (card.lemma) map[card.lemma] = pos;
      if (card.word_surface) map[card.word_surface] = pos;
    });
    return map;
  }, [wordcardCache]);

  const morphologyShort = useMemo(() => {
    if (!wordcard?.morphology) return '';
    const parts: string[] = [];
    if (wordcard.morphology.prefixes?.length) {
      parts.push(`Приставка: ${wordcard.morphology.prefixes.map((p) => `${p.form} — ${p.meaning_ru}`).join(', ')}`);
    }
    if (wordcard.morphology.suffixes?.length) {
      parts.push(`Суффикс: ${wordcard.morphology.suffixes.map((s) => `${s.form} — ${s.meaning_ru}`).join(', ')}`);
    }
    if (!parts.length && wordcard.morphology.summary_ru) {
      parts.push(wordcard.morphology.summary_ru);
    }
    return parts.join(' • ');
  }, [wordcard]);

  useEffect(() => {
    loadSichos();
  }, [loadSichos]);

  useEffect(() => {
    if (selectedSichaId) {
      loadSicha(selectedSichaId);
    }
  }, [selectedSichaId, loadSicha]);

  const currentMeta = currentSicha?.meta;

  const handleTokenSelect = useCallback(
    (token: YiddishToken, rect: DOMRect) => {
      addRecentWord(token);
      selectToken(token);
      setPopover({ token, rect });
    },
    [addRecentWord, selectToken],
  );

  const handleRecentOpen = useCallback(
    async (token: YiddishToken) => {
      await selectToken(token);
      setIsWordcardOpen(true);
    },
    [selectToken],
  );

  const openAdminEditor = useCallback(async () => {
    if (!wordcard?.lemma) return;
    setAdminError(null);
    setAdminSaving(false);
    try {
      const res = await api.adminGetYiddishWordcard(wordcard.lemma, { ui_lang: 'ru' });
      setAdminEditorValue(JSON.stringify(res.data, null, 2));
      setIsAdminEditorOpen(true);
    } catch (err: any) {
      setAdminError(err.message || 'Failed to load wordcard');
    }
  }, [wordcard]);

  const saveAdminEditor = useCallback(async () => {
    if (!wordcard?.lemma) return;
    setAdminSaving(true);
    setAdminError(null);
    try {
      const parsed = JSON.parse(adminEditorValue);
      await api.adminUpdateYiddishWordcard(wordcard.lemma, { data: parsed }, { ui_lang: 'ru' });
      setIsAdminEditorOpen(false);
      if (selectedToken) {
        await fetchWordcard(selectedToken, { forceRefresh: true });
      }
    } catch (err: any) {
      setAdminError(err.message || 'Failed to save wordcard');
    } finally {
      setAdminSaving(false);
    }
  }, [adminEditorValue, fetchWordcard, selectedToken, wordcard]);

  const sidebarContent = useMemo(() => {
    if (isLoadingList) {
      return <div className="text-xs text-muted-foreground">Загрузка списка...</div>;
    }
    if (sichos.length === 0) {
      return <div className="text-xs text-muted-foreground">Пока нет сих.</div>;
    }
    return (
      <div className="space-y-2">
        {sichos.map((item) => {
          const isActive = item.id === selectedSichaId;
          return (
            <button
              key={item.id}
              onClick={() => selectSicha(item.id)}
              className={`w-full text-left border rounded-lg px-3 py-2 transition shadow-sm ${
                isActive ? 'border-primary bg-primary/10' : 'border-border hover:bg-accent/50'
              }`}
            >
              <div className="font-semibold truncate">{item.title}</div>
              <div className="text-xs text-muted-foreground flex items-center gap-2">
                <span>
                  {item.meta.work} · {item.meta.parsha} · {item.meta.section}
                </span>
                {typeof item.progress_read_pct === 'number' ? (
                  <Badge variant="outline" className="text-[11px]">
                    {Math.round(item.progress_read_pct)}%
                  </Badge>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    );
  }, [isLoadingList, sichos, selectSicha, selectedSichaId]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <TopBar />
      <div className="flex flex-1 min-h-0">
        <aside className="w-72 border-r border-border bg-card/40 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm font-semibold">Сихи</div>
              <div className="text-xs text-muted-foreground">Режим идиш</div>
            </div>
            <Badge variant="outline">beta</Badge>
          </div>
          {sidebarContent}
        </aside>

        <main className="flex-1 flex flex-col min-w-0">
          <div className="border-b border-border/70 bg-card/40 px-6 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex flex-col min-w-0">
              <div className="text-sm font-semibold">
                {currentSicha?.id || 'Сиха не выбрана'}
              </div>
              {currentMeta ? (
                <div className="text-xs text-muted-foreground">
                  {currentMeta.work} · vol. {currentMeta.volume} · {currentMeta.parsha} · {currentMeta.section}
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Ожидание данных...</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              {highlightOptions.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={opt.value === highlightMode ? 'default' : 'outline'}
                  onClick={() => setHighlightMode(opt.value)}
                >
                  Highlight: {opt.label}
                </Button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {popupOptions.map((opt) => (
                <Button
                  key={opt.value}
                  size="sm"
                  variant={opt.value === popupMode ? 'default' : 'outline'}
                  onClick={() => setPopupMode(opt.value)}
                >
                  Поповер: {opt.label}
                </Button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Button
                size="sm"
                variant={detailLevel === 'minimal' ? 'default' : 'outline'}
                onClick={() => setDetailLevel(detailLevel === 'minimal' ? 'detailed' : 'minimal')}
              >
                Детализация: {detailLevel}
              </Button>
            </div>
          </div>

          {error ? (
            <div className="px-6 py-2 text-sm text-red-500 border-b border-border/70 bg-card/40">{error}</div>
          ) : null}

          <div className="flex-1 min-h-0 flex">
            <div className="flex-1 min-w-0">
              <TextStudyReader
                paragraphs={currentSicha?.paragraphs || []}
                tokens={currentSicha?.tokens || []}
                notes={currentSicha?.notes}
                highlightMode={highlightMode}
                popupMode={popupMode}
                onTokenSelect={handleTokenSelect}
                onTextSelect={setSnippet}
                isLoading={isLoadingSicha}
                learnedMap={currentSicha?.learned_map}
                knownLemmas={knownLemmas}
                posOverrides={posOverrides}
              />
              {popover ? (
                <Card
                  className="fixed z-50 border shadow-lg bg-card"
                  style={{
                    top: popover.rect.bottom + window.scrollY + 6,
                    left: popover.rect.left + window.scrollX,
                    maxWidth: 280,
                  }}
                >
                  <div className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-lg">
                          {wordcard?.word_surface || popover.token.surface}
                          {wordcard?.translit_ru ? ` · ${wordcard.translit_ru}` : ''}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {wordcard?.pos_ru_full || wordcard?.pos_ru_short || popover.token.pos}
                        </div>
                      </div>
                    </div>
                    <Separator />
                    {isLoadingVocab ? (
                      <div className="text-xs text-muted-foreground">Загрузка…</div>
                    ) : selectedVocab ? (
                      <div className="space-y-2">
                        <div className="space-y-1 text-sm">
                          {selectedVocab.senses.map((s) => (
                            <div key={s.sense_id} className="text-sm">
                              <div className="font-medium">{s.gloss_ru}</div>
                            </div>
                          ))}
                        </div>
                        {morphologyShort ? (
                          <div className="text-xs text-muted-foreground">{morphologyShort}</div>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="default"
                            disabled={isLoadingWordcard}
                            onClick={async () => {
                              setIsWordcardOpen(true);
                            }}
                          >
                            {isLoadingWordcard ? '...' : 'Подробнее'}
                          </Button>
                          <Button size="sm" variant="secondary" onClick={() => setPopover(null)}>Закрыть</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Нет данных. {popover.gloss || ''}
                      </div>
                    )}
                  </div>
                </Card>
              ) : null}
            </div>
            <aside className="w-80 border-l border-border bg-card/30 h-screen sticky top-0">
              <RightPanel
                recentWords={recentWords}
                wordcardCache={wordcardCache}
                selectedSnippet={selectedSnippet}
                askAnswer={askAnswer}
                isAsking={isAsking}
                onAskQuestion={(question) => askQuestion(question, currentSicha?.meta)}
                onClearAnswer={clearAskAnswer}
                onOpenWordcard={handleRecentOpen}
              />
            </aside>
          </div>
          <Dialog open={isWordcardOpen} onOpenChange={setIsWordcardOpen}>
            <DialogContent className="max-w-4xl w-full bg-background">
              <DialogHeader className="mb-2">
                <DialogTitle className="flex items-center gap-2">
                  <span>Карточка слова</span>
                  {wordcard ? (
                    <span className="text-sm text-muted-foreground">
                      {wordcard.word_surface} · {wordcard.translit_ru}
                    </span>
                  ) : null}
                </DialogTitle>
                {isAdmin && wordcard?.lemma ? (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={openAdminEditor}>
                      Edit JSON
                    </Button>
                    {adminError ? <span className="text-xs text-red-500">{adminError}</span> : null}
                  </div>
                ) : null}
              </DialogHeader>
              {!wordcard ? (
                <div className="text-sm text-muted-foreground">Нет данных карточки.</div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Слово</div>
                      <div className="mt-1 text-sm space-y-1">
                        <div><span className="font-medium">Форма:</span> {wordcard.word_surface}</div>
                        <div><span className="font-medium">Лемма:</span> {wordcard.lemma}</div>
                        <div><span className="font-medium">Транслит:</span> {wordcard.translit_ru || '—'}</div>
                        <div><span className="font-medium">Часть речи:</span> {wordcard.pos_ru_full || wordcard.pos_ru_short || '—'}</div>
                        <div>
                          <span className="font-medium">Источник:</span>{' '}
                          {wordcard.sources?.[0]?.title ? `Wiktionary (${wordcard.sources[0].title})` : 'Wiktionary'}
                        </div>
                      </div>
                    </div>
                    {wordcard.popup?.gloss_ru_short_list?.length ? (
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Коротко</div>
                        <div className="mt-1 text-sm space-y-1">
                          {wordcard.popup.gloss_ru_short_list.slice(0, 4).map((g, idx) => (
                            <div key={idx}>- {g}</div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {wordcard.grammar ? (
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Грамматика</div>
                        <div className="mt-1 text-sm space-y-1">
                          {wordcard.grammar.noun ? (
                            <div>Сущ.: {wordcard.grammar.noun.gender || '?'}; мн.ч.: {wordcard.grammar.noun.plural || '-'}</div>
                          ) : null}
                          {wordcard.grammar.verb ? (
                            <div>Глаг.: инф. {wordcard.grammar.verb.infinitive || '-'}</div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {wordcard.morphology ? (
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Морфология</div>
                        <div className="mt-1 text-sm space-y-1">
                          {wordcard.morphology.base_lemma ? (
                            <div><span className="font-medium">База:</span> {wordcard.morphology.base_lemma}</div>
                          ) : null}
                          {wordcard.morphology.prefixes?.length ? (
                            <div><span className="font-medium">Приставки:</span> {wordcard.morphology.prefixes.map((p) => `${p.form} — ${p.meaning_ru}`).join(', ')}</div>
                          ) : null}
                          {wordcard.morphology.suffixes?.length ? (
                            <div><span className="font-medium">Суффиксы:</span> {wordcard.morphology.suffixes.map((s) => `${s.form} — ${s.meaning_ru}`).join(', ')}</div>
                          ) : null}
                          {wordcard.morphology.summary_ru ? (
                            <div>{wordcard.morphology.summary_ru}</div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {wordcard.etymology?.summary_ru ? (
                      <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">Этимология</div>
                        <div className="mt-1 text-sm">{wordcard.etymology.summary_ru}</div>
                      </div>
                    ) : null}
                  </div>
                  <div className="space-y-3">
                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 max-h-[420px] overflow-auto">
                      <div className="text-xs uppercase tracking-wide text-muted-foreground">Значения</div>
                      <div className="mt-2 space-y-3 text-sm">
                        {wordcard.senses.length === 0 ? (
                          <div className="text-xs text-muted-foreground">Нет значений.</div>
                        ) : (
                          wordcard.senses.map((sense, idx) => (
                            <div key={sense.sense_id} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{idx + 1}</span>
                                <span className="font-medium">{sense.gloss_ru_short}</span>
                              </div>
                              {sense.gloss_ru_full ? (
                                <div className="text-sm">{sense.gloss_ru_full}</div>
                              ) : null}
                              {sense.usage_hints_ru?.length ? (
                                <div className="text-xs text-muted-foreground">Подсказки: {sense.usage_hints_ru.join('; ')}</div>
                              ) : null}
                              {sense.source_gloss_en ? (
                                <div className="text-xs text-muted-foreground">EN: {sense.source_gloss_en}</div>
                              ) : null}
                              {sense.examples?.length ? (
                                <div className="text-xs text-muted-foreground">Пример: {sense.examples[0].yi} / {sense.examples[0].ru}</div>
                              ) : null}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          <Dialog open={isAdminEditorOpen} onOpenChange={setIsAdminEditorOpen}>
            <DialogContent className="max-w-4xl w-full">
              <DialogHeader>
                <DialogTitle>Admin edit: WordCard JSON</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Textarea
                  value={adminEditorValue}
                  onChange={(e) => setAdminEditorValue(e.target.value)}
                  className="min-h-[360px] font-mono text-xs"
                  placeholder="WordCard JSON..."
                />
                {adminError ? <div className="text-xs text-red-500">{adminError}</div> : null}
                <div className="flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">{wordcard?.lemma}</div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" onClick={() => setIsAdminEditorOpen(false)} disabled={adminSaving}>
                      Close
                    </Button>
                    <Button onClick={saveAdminEditor} disabled={adminSaving || !adminEditorValue.trim()}>
                      {adminSaving ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </main>
      </div>
    </div>
  );
}
