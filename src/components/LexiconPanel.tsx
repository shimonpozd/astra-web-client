import React, { useState, useMemo } from 'react';
import { useLexiconStore } from '../store/lexiconStore';
import { 
  X, 
  BookOpen, 
  Loader2, 
  Copy, 
  Check, 
  Volume2, 
  Search, 
  Dna, 
  Scale, 
  Sparkles,
  Maximize2,
  Minimize2,
  Quote
} from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';
import { copyToClipboard } from './study/TraditionalTalmudDaf/utils/clipboard';
import { useSpeechify } from '../hooks/useSpeechify';
import { useTTS } from '../hooks/useTTS';
import UnifiedMessageRenderer from './UnifiedMessageRenderer';

interface LexiconSection {
  number?: string;
  title: string;
  content: string;
  colorClass: {
    badge: string;
    border: string;
    bg: string;
    iconColor: string;
  };
  iconType: 'book' | 'search' | 'dna' | 'scale' | 'sparkles';
}

const SECTION_CONFIGS = [
  {
    matcher: /буквально|перевод|значение|literal|translation|определение/i,
    iconType: 'book' as const,
    badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    border: 'border-amber-500/20 dark:border-amber-500/10',
    bg: 'bg-amber-500/[0.03] dark:bg-amber-500/[0.02]',
    iconColor: 'text-amber-500',
  },
  {
    matcher: /контекст|в контексте|отрывок|применен|context|usage/i,
    iconType: 'search' as const,
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
    border: 'border-sky-500/20 dark:border-sky-500/10',
    bg: 'bg-sky-500/[0.03] dark:bg-sky-500/[0.02]',
    iconColor: 'text-sky-500',
  },
  {
    matcher: /структура|корень|грамматик|морфолог|этимолог|шореш|root|grammar|morphology/i,
    iconType: 'dna' as const,
    badge: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    border: 'border-purple-500/20 dark:border-purple-500/10',
    bg: 'bg-purple-500/[0.03] dark:bg-purple-500/[0.02]',
    iconColor: 'text-purple-500',
  },
  {
    matcher: /нюанс|употреблен|галах|традиц|истори|комментар|note|nuance|halakha/i,
    iconType: 'scale' as const,
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    border: 'border-emerald-500/20 dark:border-emerald-500/10',
    bg: 'bg-emerald-500/[0.03] dark:bg-emerald-500/[0.02]',
    iconColor: 'text-emerald-500',
  },
];

function parseLexiconExplanation(text: string): { isStructured: boolean; sections: LexiconSection[] } {
  if (!text) return { isStructured: false, sections: [] };

  // Match flexible patterns:
  // 1. "1. **Title:** Content" or "1. Title: Content"
  // 2. "- **Title:** Content" or "* **Title:** Content"
  // 3. "### Title\nContent" or "## Title\nContent"
  // 4. "**Title:** Content" at the start of a line
  const sectionPattern = /(?:^|\n)(?:(?:[\*\-]\s+)?(?:(\d+)[\.\)]\s+)?(?:\*\*([^*:\n]+)\*\*[:\s]*|###?\s+([^\n]+)\n)|(?:[\*\-]\s+)?\*\*([^*:\n]{3,40})\*\*[:\s]+)/g;
  const matches: { index: number; num?: string; title: string; length: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = sectionPattern.exec(text)) !== null) {
    const num = m[1];
    const title = (m[2] || m[3] || m[4] || '').trim();
    if (title && title.length < 50) {
      matches.push({
        index: m.index,
        num,
        title,
        length: m[0].length,
      });
    }
  }

  if (matches.length >= 2) {
    const sections: LexiconSection[] = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i];
      const startContent = current.index + current.length;
      const endContent = i < matches.length - 1 ? matches[i + 1].index : text.length;
      const content = text.slice(startContent, endContent).trim();

      const config = SECTION_CONFIGS.find(c => c.matcher.test(current.title)) || {
        iconType: 'sparkles' as const,
        badge: 'bg-primary/10 text-primary border-primary/20',
        border: 'border-border/40',
        bg: 'bg-muted/10',
        iconColor: 'text-primary',
      };

      sections.push({
        number: current.num,
        title: current.title.replace(/:$/, ''),
        content,
        colorClass: config,
        iconType: config.iconType,
      });
    }
    return { isStructured: true, sections };
  }

  return { isStructured: false, sections: [] };
}

function SectionIcon({ type, className }: { type: LexiconSection['iconType']; className?: string }) {
  switch (type) {
    case 'book':
      return <BookOpen className={className} />;
    case 'search':
      return <Search className={className} />;
    case 'dna':
      return <Dna className={className} />;
    case 'scale':
      return <Scale className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export const LexiconPanel: React.FC = () => {
  const { isPanelOpen, explanation, isLoading, error, closePanel, term, context } = useLexiconStore();
  const [copied, setCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { speechify, isLoading: isSpeechifying } = useSpeechify();
  const tts = useTTS({});

  const structuredData = useMemo(() => {
    return parseLexiconExplanation(explanation);
  }, [explanation]);

  if (!isPanelOpen) {
    return null;
  }

  const handleCopy = async () => {
    if (!explanation) return;
    const textToCopy = `Словарь (${term}):\n${explanation}`;
    const ok = await copyToClipboard(textToCopy);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleListen = async () => {
    if (!explanation || isSpeechifying) return;
    try {
      const speechText = await speechify({ text: `${term}. ${explanation}` });
      await tts.play(speechText, { language: 'ru' });
    } catch (e) {
      console.error('Failed to speechify lexicon explanation', e);
    }
  };

  return (
    <div 
      className={cn(
        "fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-3 fade-in duration-300 pointer-events-auto transition-all",
        isExpanded ? "w-[600px] max-w-[calc(100vw-3rem)]" : "w-[480px] max-w-[calc(100vw-2rem)]"
      )}
    >
      <div className="bg-card/95 dark:bg-card/90 backdrop-blur-xl border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transition-all">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 font-bold flex-shrink-0 shadow-sm">
              <BookOpen className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs uppercase tracking-wider font-bold text-muted-foreground/80 flex-shrink-0">
                Словарь
              </span>
              {term && (
                <span 
                  className="font-vilna text-xl font-bold text-foreground px-2 py-0.5 rounded-md bg-background/80 border border-border/50 truncate max-w-[200px]" 
                  dir="rtl"
                  title={term}
                >
                  {term}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            {explanation && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleListen}
                  disabled={isSpeechifying}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                  title="Озвучить пояснение"
                >
                  {isSpeechifying ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                  ) : (
                    <Volume2 className="w-3.5 h-3.5" />
                  )}
                </Button>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg"
                  title="Скопировать пояснение"
                >
                  {copied ? (
                    <Check className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg hidden sm:flex"
              title={isExpanded ? "Свернуть размер" : "Развернуть шире"}
            >
              {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={closePanel}
              className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Закрыть словарь"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Context snippet if available */}
        {context && (
          <div className="px-4 py-2 bg-muted/15 border-b border-border/20 flex items-center gap-2 text-xs text-muted-foreground">
            <Quote className="w-3.5 h-3.5 text-primary/60 flex-shrink-0" />
            <span className="truncate italic font-serif" dir="rtl">
              {context}
            </span>
          </div>
        )}

        {/* Content Area */}
        <div 
          className={cn(
            "p-4 overflow-y-auto hide-scrollbar space-y-3",
            isExpanded ? "max-h-[560px]" : "max-h-[420px]"
          )}
        >
          {isLoading && !explanation ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                <BookOpen className="w-4 h-4 text-primary absolute inset-0 m-auto" />
              </div>
              <span className="text-xs font-medium text-muted-foreground animate-pulse">
                Ищем значение и грамматику слова...
              </span>
            </div>
          ) : error ? (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 p-3.5 rounded-xl flex items-start gap-2.5">
              <span className="font-bold font-sans">!</span>
              <div>
                <p className="font-semibold text-xs">Не удалось получить значение слова</p>
                <p className="text-xs mt-0.5 opacity-80">{error}</p>
              </div>
            </div>
          ) : structuredData.isStructured ? (
            <div className="space-y-2.5">
              {structuredData.sections.map((sec, idx) => (
                <div 
                  key={idx}
                  className={cn(
                    "rounded-xl border p-3 transition-all",
                    sec.colorClass.border,
                    sec.colorClass.bg
                  )}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span 
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold border shadow-2xs",
                        sec.colorClass.badge
                      )}
                    >
                      <SectionIcon type={sec.iconType} className="w-3 h-3" />
                      <span>{sec.title}</span>
                    </span>
                  </div>
                  <div className="text-sm leading-relaxed text-foreground/90 pl-1">
                    <UnifiedMessageRenderer input={sec.content} />
                  </div>
                </div>
              ))}
            </div>
          ) : explanation ? (
            <div className="text-sm leading-relaxed text-foreground">
              <UnifiedMessageRenderer input={explanation} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic py-8 text-center">
              Значение слова не найдено
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
