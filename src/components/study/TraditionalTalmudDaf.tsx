import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  BookOpen, 
  Languages, 
  Type,
  Quote,
  Loader2,
  X,
  Copy,
  Maximize2
} from 'lucide-react';
import { api } from '../../services/api';
import { stripHebrewVowels, stripPunctuation } from '../../utils/hebrewUtils';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface TraditionalComment {
  ref: string;
  anchorRef: string;
  commentator: string;
  he: string;
  en: string;
  dh?: string;
}

interface TraditionalTalmudDafProps {
  dafRef: string;
  segments: any[];
  onSegmentClick?: (ref: string) => void;
  onLexiconDoubleClick?: (word: string) => void;
}

export const TraditionalTalmudDaf: React.FC<TraditionalTalmudDafProps> = ({
  dafRef,
  segments,
  onSegmentClick,
  onLexiconDoubleClick
}) => {
  const [comments, setComments] = useState<TraditionalComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSegmentRef, setActiveSegmentRef] = useState<string | null>(null);
  
  // Control States
  const [showVowels, setShowVowels] = useState(true);
  const [showPunctuation, setShowPunctuation] = useState(true);
  const [showTranslation, setShowTranslation] = useState(false);
  const [translationLang, setTranslationLang] = useState<'EN' | 'RU'>('EN');
  
  // Tosafot Column State
  const [tosafotViewMode, setTosafotViewMode] = useState<'tosafot' | 'translation'>('tosafot');

  const { translatedText, isTranslating, translate } = useTranslation({
    tref: activeSegmentRef || '',
  });

  const gemaraRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const rashiRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const tosafotRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Parse amud to determine column order
  const isAmudB = dafRef.endsWith('b');

  useEffect(() => {
    const fetchComments = async () => {
      setLoading(true);
      try {
        const result = await api.getTalmudComments(dafRef);
        if (result.ok) {
          setComments(result.comments);
        }
      } catch (error) {
        console.error('Failed to fetch Talmud comments:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [dafRef]);

  // Trigger translation when switching to RU
  useEffect(() => {
    if (showTranslation && translationLang === 'RU' && activeSegmentRef) {
      translate();
    }
  }, [translationLang, activeSegmentRef, translate, showTranslation]);

  // Also trigger translation if we are in translation view and switch to RU
  useEffect(() => {
    if (tosafotViewMode === 'translation' && translationLang === 'RU' && activeSegmentRef) {
      translate();
    }
  }, [translationLang, activeSegmentRef, translate, tosafotViewMode]);

  const handleSegmentClick = (ref: string) => {
    setActiveSegmentRef(ref);
    onSegmentClick?.(ref);

    // Scroll corresponding comments into view
    const rashi = comments.find(c => c.anchorRef === ref && c.commentator.toLowerCase().includes('rashi'));
    const tosafot = comments.find(c => c.anchorRef === ref && c.commentator.toLowerCase().includes('tosafot'));

    if (rashi && rashiRefs.current[rashi.ref]) {
      rashiRefs.current[rashi.ref]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    if (tosafot && tosafotRefs.current[tosafot.ref]) {
      tosafotRefs.current[tosafot.ref]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const processText = (text: string) => {
    let result = text;
    if (!showVowels) result = stripHebrewVowels(result);
    if (!showPunctuation) result = stripPunctuation(result);
    // Don't strip HTML tags here, let them render
    return result;
  };

  const rashiComments = useMemo(() => 
    comments.filter(c => c.commentator.toLowerCase().includes('rashi')), 
  [comments]);

  const tosafotComments = useMemo(() => 
    comments.filter(c => c.commentator.toLowerCase().includes('tosafot')), 
  [comments]);

  const leftColumn = isAmudB ? tosafotComments : rashiComments;
  const leftTitle = isAmudB ? 'Tosafot' : 'Rashi';
  const rightColumn = isAmudB ? rashiComments : tosafotComments;
  const rightTitle = isAmudB ? 'Rashi' : 'Tosafot';

  const renderComment = (comment: TraditionalComment, refs: React.MutableRefObject<Record<string, HTMLDivElement | null>>) => {
    const isActive = activeSegmentRef === comment.anchorRef;
    
    // Parse Dibbur Hamatkhil inline
    let dh = '';
    let restHtml = comment.he || '';
    
    const strippedHtml = restHtml.replace(/<\/?b>/gi, '').replace(/<\/?strong>/gi, '');
    const match = strippedHtml.match(/^(.*?)([-–—\.])(.*)$/s);
    
    if (match && match[1].length < 150) {
      dh = match[1].trim() + match[2];
      restHtml = match[3].trim();
    } else {
      restHtml = strippedHtml;
    }

    return (
      <div 
        key={comment.ref}
        ref={el => refs.current[comment.ref] = el}
        className={cn(
          "mb-3 p-1 transition-all font-rashi text-right text-lg leading-relaxed text-justify cursor-text select-text",
          isActive ? "bg-primary/10 opacity-100" : "opacity-70 hover:opacity-100"
        )}
        style={{ textAlignLast: 'right' }}
        dir="rtl"
        onDoubleClick={() => onLexiconDoubleClick?.(window.getSelection()?.toString() || '')}
      >
        {dh && (
          <strong className="font-bold text-amber-950 dark:text-amber-200 mr-1 font-rashi">{dh}</strong>
        )}
        <span className="font-rashi" dangerouslySetInnerHTML={{ __html: restHtml }} />
      </div>
    );
  };

  // Find the active segment data for the translation overlay
  const activeSegmentData = useMemo(() => {
    if (!activeSegmentRef) return null;
    return segments.find(s => s.ref === activeSegmentRef);
  }, [activeSegmentRef, segments]);

  const activeEnglishText = useMemo(() => {
    if (!activeSegmentData) return null;
    const hebrewText = activeSegmentData.he_text || activeSegmentData.heText || '';
    const candidateEnglish = activeSegmentData.en_text || activeSegmentData.enText || activeSegmentData.text || '';
    return candidateEnglish !== hebrewText ? candidateEnglish : null;
  }, [activeSegmentData]);

  const handleCopySegment = async () => {
    if (!activeSegmentData) return;
    
    // Quick helper to strip html for clipboard
    const stripHtml = (html: string) => {
      const doc = new DOMParser().parseFromString(html, 'text/html');
      return doc.body.textContent || "";
    };

    const hebrew = stripHtml(activeSegmentData.he_text || activeSegmentData.heText || '');
    const translationHtml = translationLang === 'EN' ? activeEnglishText : translatedText;
    const translation = stripHtml(translationHtml || '');
    
    const textToCopy = `Оригинал (${activeSegmentRef}):\n${hebrew}\n\nПеревод (${translationLang}):\n${translation || 'Недоступен'}`;
    
    try {
      await navigator.clipboard.writeText(textToCopy);
      // Optional: you could add a toast notification here
      console.log('Текст и перевод успешно скопированы!');
    } catch (err) {
      console.error('Не удалось скопировать:', err);
    }
  };

  // Helper to render the translation view inside the column
  const renderTranslationView = () => {
    if (!activeSegmentRef) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-muted-foreground opacity-50 p-6 text-center">
          <Languages className="w-8 h-8 mb-4" />
          <p>Выберите фрагмент текста, чтобы увидеть его перевод.</p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-muted/10 p-4 font-sans" dir="ltr">
        <div className="flex items-center justify-between mb-4 border-b border-border/50 pb-2">
           <span className="text-xs font-bold text-primary uppercase tracking-widest">{activeSegmentRef}</span>
           <div className="flex items-center gap-2">
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={handleCopySegment}
                title="Скопировать оригинал и перевод"
              >
                <Copy className="w-3.5 h-3.5" />
              </Button>
           </div>
        </div>
        
        <div className="text-foreground text-base md:text-lg leading-relaxed selection:bg-primary/30">
          {translationLang === 'EN' 
            ? (activeEnglishText ? <span dangerouslySetInnerHTML={{ __html: activeEnglishText }} /> : 
                <span className="opacity-50 italic">English translation is currently unavailable.</span>) 
            : (isTranslating ? 
                <div className="flex flex-col items-center gap-4 py-6 opacity-60 italic">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-sm">Переводим...</span>
                </div> 
                : (translatedText ? <span dangerouslySetInnerHTML={{ __html: translatedText }} /> : <span className="opacity-50 italic">Russian translation not available.</span>))
          }
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden relative">
      {/* Global Toolbar */}
      <div className="flex items-center justify-between px-6 py-2 bg-card border-b border-border shadow-sm z-10">
        <div className="flex items-center gap-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-bold font-vilna">{dafRef}</h2>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-md p-1 gap-1">
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2", !showVowels && "bg-primary/10")} 
              onClick={() => setShowVowels(!showVowels)}
              title="Vowels (Огласовки)"
            >
              <Type className={cn("w-4 h-4", showVowels ? "opacity-40" : "text-primary")} />
            </Button>
            
            <Button 
              variant="ghost" size="sm" 
              className={cn("h-7 px-2", !showPunctuation && "bg-primary/10")} 
              onClick={() => setShowPunctuation(!showPunctuation)}
              title="Punctuation (Пунктуация)"
            >
              <Quote className={cn("w-4 h-4", showPunctuation ? "opacity-40" : "text-primary")} />
            </Button>
          </div>

          <div className="flex items-center bg-muted rounded-md p-1 gap-1">
             <button 
                className={cn("px-3 py-1 text-xs rounded font-bold transition-all", 
                  translationLang === 'EN' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTranslationLang('EN')}
              >EN</button>
              <button 
                className={cn("px-3 py-1 text-xs rounded font-bold transition-all", 
                  translationLang === 'RU' ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                onClick={() => setTranslationLang('RU')}
              >RU</button>
          </div>

          <Button variant="ghost" size="sm" className="h-9">
            <Maximize2 className="w-4 h-4 opacity-40" />
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden p-0 gap-0">
        {/* Left Column (Tosafot or Rashi depending on Amud) */}
        <div className="w-[25%] flex flex-col border-r border-border/10">
           {/* If Tosafot is on the left, render the toggle tabs */}
           {leftTitle === 'Tosafot' ? (
              <div className="flex items-center border-b border-border/10 bg-muted/10">
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'tosafot' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('tosafot')}
                >
                  Tosafot
                </button>
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'translation' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('translation')}
                >
                  Translation
                </button>
              </div>
           ) : (
              <div className="text-center py-2 font-bold opacity-30 uppercase text-[10px] tracking-widest border-b border-border/10 bg-muted/10">
                {leftTitle}
              </div>
           )}
          
          <div className="flex-1 px-4 py-6 overflow-y-auto hide-scrollbar">
            {leftTitle === 'Tosafot' && tosafotViewMode === 'translation' 
              ? renderTranslationView() 
              : leftColumn.map(c => renderComment(c, leftTitle === 'Rashi' ? rashiRefs : tosafotRefs))
            }
          </div>
        </div>

        {/* Center Column (Gemara Flow) */}
        <div className="flex-1 flex flex-col bg-card/20 overflow-hidden relative">
          <div className="text-center py-2 bg-muted/20 border-b border-border/10 font-bold opacity-30 uppercase text-[10px] tracking-widest">
            Gemara
          </div>
          <div className="flex-1 px-4 py-8 overflow-y-auto hide-scrollbar">
            <div className="w-full max-w-[32ch] mx-auto text-right font-vilna text-2xl md:text-3xl leading-[2.2] md:leading-[1.6] lg:leading-[1.6] text-justify tracking-wide" style={{ textAlignLast: 'right' }} dir="rtl">
              {segments.map((segment, idx) => {
                const isActive = activeSegmentRef === segment.ref;
                const hebrewText = segment.he_text || segment.heText || '';
                const processed = processText(hebrewText);
                const htmlToRender = `${processed}${idx < segments.length - 1 ? ' ' : ''}`;

                return (
                  <span 
                    key={segment.ref}
                    ref={el => gemaraRefs.current[segment.ref] = el}
                    className={cn(
                      "cursor-pointer transition-all duration-300 select-text",
                      activeSegmentRef 
                        ? (isActive ? "opacity-100 bg-primary/10 rounded-sm" : "text-stone-400 dark:text-stone-500 opacity-80")
                        : "opacity-100 hover:bg-primary/5 rounded-sm"
                    )}
                    onClick={() => handleSegmentClick(segment.ref)}
                    onDoubleClick={() => onLexiconDoubleClick?.(window.getSelection()?.toString() || '')}
                    dangerouslySetInnerHTML={{ __html: htmlToRender }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (Rashi or Tosafot depending on Amud) */}
        <div className="w-[25%] flex flex-col border-l border-border/10">
           {/* If Tosafot is on the right, render the toggle tabs */}
           {rightTitle === 'Tosafot' ? (
              <div className="flex items-center border-b border-border/10 bg-muted/10">
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'tosafot' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('tosafot')}
                >
                  Tosafot
                </button>
                <button
                  className={cn("flex-1 text-center py-2 font-bold uppercase text-[10px] tracking-widest transition-all",
                    tosafotViewMode === 'translation' ? "text-primary border-b-2 border-primary" : "opacity-40 hover:opacity-80"
                  )}
                  onClick={() => setTosafotViewMode('translation')}
                >
                  Translation
                </button>
              </div>
           ) : (
              <div className="text-center py-2 font-bold opacity-30 uppercase text-[10px] tracking-widest border-b border-border/10 bg-muted/10">
                {rightTitle}
              </div>
           )}
          
          <div className="flex-1 px-4 py-6 overflow-y-auto hide-scrollbar">
            {rightTitle === 'Tosafot' && tosafotViewMode === 'translation' 
              ? renderTranslationView() 
              : rightColumn.map(c => renderComment(c, rightTitle === 'Rashi' ? rashiRefs : tosafotRefs))
            }
          </div>
        </div>
      </div>
    </div>
  );
};
