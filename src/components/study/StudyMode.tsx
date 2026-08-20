import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { StudySnapshot } from '../../types/study';
import { ContinuousText, TextSegment, ChapterNavigation } from '../../types/text';
import { safeLazy } from '../../utils/safeLazy';
const FocusReader = safeLazy(() => import('./FocusReader'));
import { TraditionalTalmudDaf } from './TraditionalTalmudDaf';
import ChatViewport from '../chat/ChatViewport';
import MessageComposer from '../chat/MessageComposer';
import WorkbenchPanelInline from './WorkbenchPanelInline';
import { api } from '../../services/api';
import { authorizedFetch } from '../../lib/authorizedFetch';
import { fetchConceptHighlights, fetchSageHighlights } from '../../services/highlight';
import { ConceptHighlight, SageHighlight } from '../../types/highlight';
import { useLexiconStore } from '../../store/lexiconStore';
import { Message } from '../../services/api';
import { debugLog } from '../../utils/debugLogger';
import { parseRefSmart } from '../../utils/refUtils';
import { TANAKH_BOOKS } from '../../data/tanakh';
import { getChapterSizesForWork } from '../../lib/sefariaShapeCache';
import { buildStudyQuickActions } from '../../utils/studyQuickActions';
import { emitGamificationEvent } from '../../contexts/GamificationContext';
import { calcTextXp, docToPlainText } from '../../utils/xpUtils';
import { SugyaMapContainer } from './SugyaMapContainer';
import { cn } from '../../lib/utils';
import type { PanelActions, Persona } from '../../types/chat';

import { ChevronRight, MessageSquare, Network } from 'lucide-react';

interface StudyChatPanelProps {
  className?: string;
  studySessionId: string | null;
  messages: Message[];
  isLoadingMessages: boolean;
  isSending: boolean;
  setIsSending: (sending: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  refreshStudySnapshot: () => void;
  agentId: string;
  selectedPanelId: string | null;
  discussionFocusRef?: string | null;
  panelActions?: PanelActions;
  currentPersona?: Persona;
  availablePersonas?: Persona[];
  onPersonaChange?: (persona: Persona) => void;
  layoutMode?: 'horizontal' | 'vertical';
  currentRef?: string;
  segments?: TextSegment[];
  snapshot?: StudySnapshot | null;
  panelMode?: 'chat' | 'map';
  setPanelMode?: (mode: 'chat' | 'map') => void;
  onClose?: () => void;
}

export function StudyChatPanel({
  className,
  studySessionId,
  messages,
  isLoadingMessages,
  isSending,
  setIsSending,
  setMessages,
  refreshStudySnapshot,
  agentId,
  selectedPanelId,
  discussionFocusRef,
  panelActions,
  currentPersona,
  availablePersonas,
  onPersonaChange,
  layoutMode = 'horizontal',
  currentRef,
  segments,
  snapshot,
  panelMode: propPanelMode,
  setPanelMode: propSetPanelMode,
  onClose,
}: StudyChatPanelProps) {
  const [localPanelMode, setLocalPanelMode] = useState<'chat' | 'map'>('chat');
  const panelMode = propPanelMode !== undefined ? propPanelMode : localPanelMode;
  const setPanelMode = propSetPanelMode || setLocalPanelMode;
  const containerClass = `flex flex-col min-h-0 ${className || ''}`;

  const activeRef = currentRef || snapshot?.ref;
  const activeSegments = segments || snapshot?.segments;

  return (
    <div className={containerClass}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/20 px-3 py-2 bg-muted/20 flex-shrink-0">
        <div className="flex items-center gap-2 font-semibold text-xs text-foreground/80 select-none">
          {panelMode === 'chat' ? (
            <>
              <MessageSquare className="w-4 h-4 text-amber-500" />
              <span>ИИ-Хаврута</span>
            </>
          ) : (
            <>
              <Network className="w-4 h-4 text-blue-500" />
              <span>Карта Сугии</span>
            </>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            title="Свернуть панель чата"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {panelMode === 'map' ? (
        <div className="flex-1 min-h-0 overflow-hidden">
          <SugyaMapContainer currentRef={activeRef} segments={activeSegments} />
        </div>
      ) : (
        <>
          <div className="flex-1 min-h-0 overflow-y-auto panel-padding-sm">
            <ChatViewport messages={messages.map((m) => ({ ...m, id: String(m.id) }))} isLoading={isLoadingMessages} />
          </div>
          <div className="flex-shrink-0 panel-padding">
            <MessageComposer
              onSendMessage={async (message) => {
                if (!studySessionId) {
                  throw new Error('Сессия изучения не создана. Попробуйте обновить страницу.');
                }
                setIsSending(true);
                const assistantMessageId = crypto.randomUUID();
                const assistantMessage: any = {
                  id: assistantMessageId,
                  role: 'assistant',
                  content: '',
                  content_type: 'text.v1',
                  timestamp: Date.now(),
                };
                setMessages((prev) => [
                  ...prev,
                  {
                    id: crypto.randomUUID(),
                    role: 'user',
                    content: message,
                    content_type: 'text.v1',
                    timestamp: Date.now(),
                  },
                  assistantMessage,
                ]);

                let assistantText = '';
                let assistantDoc: any = null;

                // XP за вопрос
                const askAmount = calcTextXp(message);
                if (askAmount > 0) {
                  emitGamificationEvent({
                    amount: askAmount,
                    source: 'chat',
                    verb: 'ask',
                    label: `Вопрос · ${message.length} симв.`,
                    meta: {
                      session_id: studySessionId,
                      chars: message.length,
                      event_id: ['study', 'ask', studySessionId || '', Math.ceil(Date.now() / 5000)].join('|'),
                    },
                  });
                }
                if (discussionFocusRef && studySessionId) {
                  authorizedFetch('/api/study/chat/set_focus', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      session_id: studySessionId,
                      ref: discussionFocusRef,
                    }),
                  }).catch(() => {});
                }
                try {
                  await api.sendStudyMessage(
                    studySessionId,
                    message,
                    {
                      onChunk: (chunk) => {
                        assistantText += chunk;
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId
                              ? {
                                  ...msg,
                                  content: `${typeof msg.content === 'string' ? msg.content : ''}${chunk}`,
                                  content_type: 'text.v1',
                                }
                              : msg,
                          ),
                        );
                      },
                      onDoc: (doc) => {
                        assistantDoc = doc;
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId
                              ? { ...msg, content: doc, content_type: 'doc.v1' }
                              : msg,
                          ),
                        );
                      },
                      onComplete: () => {
                        setIsSending(false);
                        const replyText = assistantDoc ? docToPlainText(assistantDoc) : assistantText;
                        const amount = calcTextXp(replyText);
                        if (amount > 0) {
                          emitGamificationEvent({
                            amount,
                            source: 'chat',
                            verb: 'reply',
                            label: `Study чат · ${replyText.length} симв.`,
                            meta: {
                              session_id: studySessionId,
                              chars: replyText.length,
                              event_id: ['study', 'reply', studySessionId || '', Math.ceil(Date.now() / 5000)].join('|'),
                            },
                          });
                        }
                        refreshStudySnapshot();
                      },
                      onError: (error) => {
                        setMessages((prev) =>
                          prev.map((msg) =>
                            msg.id === assistantMessageId
                              ? { ...msg, content: `Error: ${error.message}`, content_type: 'text.v1' }
                              : msg,
                          ),
                        );
                        setIsSending(false);
                      },
                    },
                    agentId,
                    selectedPanelId ?? undefined,
                  );
                } catch (err) {
                  setIsSending(false);
                  throw err;
                }
              }}
              disabled={isSending}
              discussionFocusRef={discussionFocusRef ?? undefined}
              panelActions={panelActions}
              currentPersona={currentPersona}
              availablePersonas={availablePersonas}
              onPersonaChange={onPersonaChange}
              layoutMode={layoutMode}
            />
          </div>
        </>
      )}
    </div>
  );
}

interface StudyModeProps {
  snapshot: StudySnapshot | null;
  onExit: () => void;
  onNavigateBack: () => void;
  onNavigateForward: () => void;
  isLoading: boolean;
  canNavigateBack: boolean;
  canNavigateForward: boolean;
  messages: Message[];
  isLoadingMessages: boolean;
  isSending: boolean;
  studySessionId: string | null;
  setIsSending: (sending: boolean) => void;
  setMessages: React.Dispatch<React.SetStateAction<any[]>>;
  agentId: string;
  onWorkbenchSet: (side: 'left' | 'right', ref: string, dragData?: {
    type: 'single' | 'group' | 'part';
    data?: any;
  }) => void;
  onWorkbenchClear?: (side: 'left' | 'right') => void;
  onWorkbenchFocus: (side: 'left' | 'right') => void;
  onWorkbenchDrop?: (side: 'left' | 'right', ref: string, dragData?: {
    type: 'single' | 'group' | 'part';
    data?: any;
  }) => void;
  onFocusClick?: () => void;
  onNavigateToRef?: (ref: string, segment?: TextSegment) => void;
  // onLexiconLookup removed - now using global lexicon store
  refreshStudySnapshot: () => void;
  // Panel selection props
  selectedPanelId?: string | null;
  onSelectedPanelChange?: (panelId: string | null) => void;
  // Background loading prop
  isBackgroundLoading?: boolean;
  showLeftPanel?: boolean;
  showRightPanel?: boolean;
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  layoutVariant?: 'classic' | 'stacked' | 'traditional';
  showChatPanel?: boolean;
  currentPersona?: Persona;
  availablePersonas?: Persona[];
  onPersonaChange?: (persona: Persona) => void;
  isTraditionalFullscreen?: boolean;
  onToggleTraditionalFullscreen?: () => void;
}

export default function StudyMode({
  snapshot,
  onExit,
  onNavigateBack,
  onNavigateForward,
  isLoading,
  canNavigateBack,
  canNavigateForward,
  messages,
  isLoadingMessages,
  isSending,
  studySessionId,
  setIsSending,
  setMessages,
  agentId,
  onWorkbenchSet,
  onWorkbenchClear,
  onWorkbenchFocus,
  onWorkbenchDrop,
  onFocusClick,
  onNavigateToRef,
  // onLexiconLookup removed
  refreshStudySnapshot,
  selectedPanelId: propSelectedPanelId,
  onSelectedPanelChange,
  isBackgroundLoading = false,
  showLeftPanel,
  showRightPanel,
  onToggleLeftPanel,
  onToggleRightPanel,
  layoutVariant = 'traditional',
  showChatPanel = true,
  currentPersona,
  availablePersonas,
  onPersonaChange,
  isTraditionalFullscreen = false,
  onToggleTraditionalFullscreen
}: StudyModeProps) {
  // Use props if provided, otherwise fall back to local state
  const [localSelectedPanelId, setLocalSelectedPanelId] = useState<string | null>(null);
  const selectedPanelId = propSelectedPanelId !== undefined ? propSelectedPanelId : localSelectedPanelId;
  const setSelectedPanelId = onSelectedPanelChange || setLocalSelectedPanelId;

  const [sageHighlights, setSageHighlights] = useState<SageHighlight[]>([]);
  const [conceptHighlights, setConceptHighlights] = useState<ConceptHighlight[]>([]);

  const [activeRightTool, setActiveRightTool] = useState<'chat' | 'map' | null>(
    showChatPanel ? 'chat' : null
  );

  useEffect(() => {
    if (showChatPanel && activeRightTool === null) {
      setActiveRightTool('chat');
    }
  }, [showChatPanel]);

  const handleToolClick = useCallback((tool: 'chat' | 'map') => {
    setActiveRightTool((prev) => (prev === tool ? null : tool));
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [sages, concepts] = await Promise.all([fetchSageHighlights(), fetchConceptHighlights()]);
        console.log('[StudyMode] fetch result counts:', { sages: sages?.length, concepts: concepts?.length });
        if (!active) return;
        setSageHighlights(sages);
        setConceptHighlights(concepts);
      } catch (err) {
        console.warn('[StudyMode] Failed to load highlights:', err);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  
  // New lexicon system using global store
  const { setSelection, fetchExplanation } = useLexiconStore();

  // Panel selection handlers (с защитой от множественных кликов)
  const handlePanelClick = useCallback((panelId: string) => {
    // Предотвращаем множественные клики
    if (selectedPanelId === panelId) {
      // Deselect if clicking the same panel
      setSelectedPanelId(null);
    } else {
      // Select the clicked panel
      setSelectedPanelId(panelId);
    }
  }, [selectedPanelId, setSelectedPanelId]);

  // Visibility states for workbench panels
  const [internalLeftPanelVisible, setInternalLeftPanelVisible] = useState(true);
  const [internalRightPanelVisible, setInternalRightPanelVisible] = useState(true);

  const leftPanelIsVisible = showLeftPanel ?? internalLeftPanelVisible;
  const rightPanelIsVisible = showRightPanel ?? internalRightPanelVisible;

  const composerPanelActions = useMemo<PanelActions>(() => {
    return buildStudyQuickActions({
      snapshot,
      leftPanelVisible: leftPanelIsVisible,
      rightPanelVisible: rightPanelIsVisible,
    });
  }, [snapshot, leftPanelIsVisible, rightPanelIsVisible]);

  const handleToggleLeftPanel = useCallback(() => {
    if (onToggleLeftPanel) {
      onToggleLeftPanel();
      return;
    }
    setInternalLeftPanelVisible((visible) => {
      const next = !visible;
      if (!next) {
        onWorkbenchClear?.('left');
      }
      return next;
    });
  }, [onToggleLeftPanel, onWorkbenchClear]);

  const handleToggleRightPanel = useCallback(() => {
    if (onToggleRightPanel) {
      onToggleRightPanel();
      return;
    }
    setInternalRightPanelVisible((visible) => {
      const next = !visible;
      if (!next) {
        onWorkbenchClear?.('right');
      }
      return next;
    });
  }, [onToggleRightPanel, onWorkbenchClear]);

  const gridTemplate = leftPanelIsVisible && rightPanelIsVisible
    ? 'grid grid-cols-[300px_1fr_300px]'
    : leftPanelIsVisible && !rightPanelIsVisible
    ? 'grid grid-cols-[300px_1fr]'
    : !leftPanelIsVisible && rightPanelIsVisible
    ? 'grid grid-cols-[1fr_300px]'
    : 'grid grid-cols-1';
  const isStackedLayout = layoutVariant === 'stacked';
  const composerLayoutMode: 'horizontal' | 'vertical' = isStackedLayout ? 'vertical' : 'horizontal';

  // New lexicon double-click handler using global store
  const handleLexiconDoubleClick = async (
    target?: TextSegment | string,
    customContext?: string
  ) => {
    let selected = (window.getSelection()?.toString() || '').trim();
    let context = '';
    
    if (typeof target === 'object' && target !== null) {
      // It's a TextSegment (from FocusReader)
      const fallback = target.heText || target.text || '';
      context = fallback || selected || '';
    } else if (typeof target === 'string') {
      // It's a pre-extracted word (or target string)
      if (target.trim()) {
        selected = target.trim();
      }
      context = customContext || selected || '';
    } else {
      context = selected;
    }

    const contextClean = context
      ? context.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    const cleanText = selected
      .replace(/[֑-ׇ]/g, '')
      .replace(/["'""().,!?;:\-\[\]{}]/g, '')
      .trim();

    if (!cleanText) return;

    setSelection(cleanText, contextClean || null);
    await fetchExplanation();
  };

  // Listen for lexicon lookup events from Workbench
  useEffect(() => {
    const handleLexiconLookup = (event: CustomEvent<{ text?: string; context?: string }>) => {
      const text = event.detail?.text;
      if (text) {
        const cleanText = text
          .replace(/[֑-ׇ]/g, '') // Remove Hebrew punctuation
          .replace(/["'""().,!?;:\-\[\]{}]/g, '') // Remove general punctuation
          .trim();
        const context = event.detail?.context
          ?.replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim() || null;
        
        if (cleanText) {
          setSelection(cleanText, context);
          fetchExplanation();
        }
      }
    };

    window.addEventListener('lexicon-lookup', handleLexiconLookup as EventListener);
    return () => {
      window.removeEventListener('lexicon-lookup', handleLexiconLookup as EventListener);
    };
  }, [setSelection, fetchExplanation]);

  useEffect(() => {
    const handleRefNavigate = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      const refTarget = customEvent.detail;
      if (refTarget && onWorkbenchSet) {
        onWorkbenchSet('left', refTarget);
      }
    };
    window.addEventListener('study-navigate-ref', handleRefNavigate);
    return () => {
      window.removeEventListener('study-navigate-ref', handleRefNavigate);
    };
  }, [onWorkbenchSet]);
  // Конвертация snapshot в continuousText для нового FocusReader
  const [chapterNavigation, setChapterNavigation] = useState<ChapterNavigation | null>(null);

  useEffect(() => {
    if (!snapshot?.ref) {
      setChapterNavigation(null);
      return;
    }
    const parsed = parseRefSmart(snapshot.ref);
    if (!parsed || parsed.type !== 'tanakh') {
      setChapterNavigation(null);
      return;
    }
    const chapter = parsed.chapter;
    if (chapter == null) {
      setChapterNavigation(null);
      return;
    }
    const bookInfo = TANAKH_BOOKS[parsed.book];
    if (!bookInfo) {
      setChapterNavigation(null);
      return;
    }

    const formatChapterRef = (chapter: number) => `${parsed.book} ${chapter}:1`;

    const buildNavigation = (totalChapters: number) => {
      const prevChapter = chapter > 1 ? chapter - 1 : undefined;
      const nextChapter = chapter < totalChapters ? chapter + 1 : undefined;
      if (!prevChapter && !nextChapter) {
        return null;
      }
      return {
        prev: prevChapter ? formatChapterRef(prevChapter) : undefined,
        next: nextChapter ? formatChapterRef(nextChapter) : undefined,
      };
    };

    setChapterNavigation(buildNavigation(bookInfo.chapters));

    const sectionMap: Record<string, string> = {
      Torah: 'Torah',
      "Nevi'im": 'Prophets',
      Ketuvim: 'Writings',
    };
    const sectionFolder = sectionMap[bookInfo.section];
    if (!sectionFolder) {
      return;
    }

    const bookSlug = parsed.book
      .trim()
      .replace(/[^\w\s]/g, '')
      .replace(/\s+/g, '_');
    const workPath = `works/Tanakh/${sectionFolder}/${bookSlug}/`;

    let cancelled = false;
    getChapterSizesForWork(workPath)
      .then((sizes) => {
        if (cancelled) {
          return;
        }
        const totalChapters = sizes && sizes.length ? sizes.length : bookInfo.chapters;
        setChapterNavigation(buildNavigation(totalChapters));
      })
      .catch(() => {
        if (!cancelled) {
          setChapterNavigation(buildNavigation(bookInfo.chapters));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [snapshot?.ref]);

  const continuousText: ContinuousText | null = snapshot ? {
    segments: snapshot.segments || [],
    focusIndex: snapshot.focusIndex ?? 0,
    totalLength: snapshot.segments?.length || 0,
    title: snapshot.ref || '',
    collection: '', // This field is not critical for the reader component
    chapterNavigation,
  } : null;

  // Debug logging for segments
  debugLog('📖 StudyMode segments:', {
    hasSnapshot: !!snapshot,
    segmentsCount: snapshot?.segments?.length || 0,
    focusIndex: snapshot?.focusIndex,
    ref: snapshot?.ref,
    firstSegment: snapshot?.segments?.[0] ? {
      ref: snapshot.segments[0].ref,
      text: snapshot.segments[0].text?.substring(0, 50) + '...',
      heText: snapshot.segments[0].heText?.substring(0, 50) + '...'
    } : null,
    lastSegment: snapshot?.segments?.[snapshot.segments.length - 1]?.ref,
    continuousText: continuousText,
    navigationProps: {
      canBack: canNavigateBack,
      canForward: canNavigateForward,
      currentRef: snapshot?.ref
    }
  });

  return (
    <div className="flex flex-row h-full panel-inner min-h-0 overflow-hidden relative">
      {/* Main Reading & Workbenches Container */}
      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden panel-padding">
        {layoutVariant === 'traditional' ? (
          <div className="h-full w-full min-h-0 bg-card/60 rounded-lg overflow-hidden border border-border/60 shadow-sm">
            <Suspense fallback={null}>
              <TraditionalTalmudDaf
                dafRef={snapshot?.ref || ''}
                discussionFocusRef={snapshot?.discussion_focus_ref}
                segments={snapshot?.segments || []}
                onSegmentClick={(ref) => onNavigateToRef?.(ref)}
                onDafChange={(nextRef) => onNavigateToRef?.(nextRef)}
                onLexiconDoubleClick={handleLexiconDoubleClick as any}
                sageHighlights={sageHighlights}
                conceptHighlights={conceptHighlights}
                isFullscreen={isTraditionalFullscreen}
                onToggleFullscreen={onToggleTraditionalFullscreen}
                isAdmin={true}
              />
            </Suspense>
          </div>
        ) : isStackedLayout ? (
          <div className="h-full flex flex-col gap-spacious min-h-0">
            <div
              className={`flex-1 min-h-0 bg-card/60 rounded-lg overflow-hidden transition-all ${
                selectedPanelId === 'focus'
                  ? 'focus-reader-selected'
                  : snapshot?.discussion_focus_ref === snapshot?.ref
                  ? 'focus-reader-active'
                  : 'border border-border/60'
              }`}
              onClick={(e) => {
                handlePanelClick('focus');
                if (e.target === e.currentTarget) {
                  onFocusClick && onFocusClick();
                }
              }}
            >
              <Suspense fallback={null}>
                {layoutVariant === 'traditional' ? (
                  <TraditionalTalmudDaf
                    dafRef={snapshot?.ref || ''}
                    discussionFocusRef={snapshot?.discussion_focus_ref}
                    segments={snapshot?.segments || []}
                    onSegmentClick={(ref) => onNavigateToRef?.(ref)}
                    onDafChange={(nextRef) => onNavigateToRef?.(nextRef)}
                    onLexiconDoubleClick={handleLexiconDoubleClick as any}
                    sageHighlights={sageHighlights}
                    conceptHighlights={conceptHighlights}
                    isFullscreen={isTraditionalFullscreen}
                    onToggleFullscreen={onToggleTraditionalFullscreen}
                    isAdmin={true}
                  />
                ) : (
                  <FocusReader
                    continuousText={continuousText}
                    isLoading={isLoading}
                    onNavigateToRef={onNavigateToRef}
                    onLexiconDoubleClick={handleLexiconDoubleClick}
                    isDailyMode={studySessionId?.startsWith('daily-') || false}
                    isBackgroundLoading={isBackgroundLoading}
                    onBack={onNavigateBack}
                    onForward={onNavigateForward}
                    onExit={onExit}
                    currentRef={snapshot?.ref}
                    canBack={canNavigateBack}
                    canForward={canNavigateForward}
                    onToggleLeftPanel={handleToggleLeftPanel}
                    onToggleRightPanel={handleToggleRightPanel}
                    showLeftPanel={leftPanelIsVisible}
                    showRightPanel={rightPanelIsVisible}
                    sessionId={studySessionId}
                  />
                )}
              </Suspense>
            </div>

            {leftPanelIsVisible && (
              <div className="flex-none min-h-[240px] max-h-[60%] overflow-hidden bg-card/60 rounded-lg border border-border/60 transition-all">
                <WorkbenchPanelInline
                  title="Левая панель"
                  item={snapshot?.workbench?.left || null}
                  active={snapshot?.discussion_focus_ref === snapshot?.workbench?.left?.ref}
                  selected={selectedPanelId === 'left_workbench'}
                  sessionId={studySessionId}
                  onDropRef={(ref: string, dragData) => {
                    debugLog('StudyMode: Dropped on left workbench:', ref, dragData);
                    if (dragData?.type === 'group') {
                      debugLog('Group data:', dragData.data);
                    }
                    onWorkbenchDrop ? onWorkbenchDrop('left', ref, dragData) : onWorkbenchSet('left', ref, dragData);
                  }}
                  onPanelClick={() => {
                    handlePanelClick('left_workbench');
                  }}
                  onBorderClick={() => {
                    onWorkbenchFocus('left');
                  }}
                  onClear={snapshot?.workbench?.left ? () => onWorkbenchClear?.('left') : undefined}
                />
              </div>
            )}

            {rightPanelIsVisible && (
              <div className="flex-none min-h-[240px] max-h-[60%] overflow-hidden bg-card/60 rounded-lg border border-border/60 transition-all">
                <WorkbenchPanelInline
                  title="Правая панель"
                  item={snapshot?.workbench?.right || null}
                  active={snapshot?.discussion_focus_ref === snapshot?.workbench?.right?.ref}
                  selected={selectedPanelId === 'right_workbench'}
                  sessionId={studySessionId}
                  onDropRef={(ref: string, dragData) => {
                    debugLog('StudyMode: Dropped on right workbench:', ref, dragData);
                    if (dragData?.type === 'group') {
                      debugLog('Group data:', dragData.data);
                    }
                    onWorkbenchDrop ? onWorkbenchDrop('right', ref, dragData) : onWorkbenchSet('right', ref, dragData);
                  }}
                  onPanelClick={() => {
                    handlePanelClick('right_workbench');
                  }}
                  onBorderClick={() => {
                    onWorkbenchFocus('right');
                  }}
                  onClear={snapshot?.workbench?.right ? () => onWorkbenchClear?.('right') : undefined}
                />
              </div>
            )}
          </div>
        ) : (
          <div className={`h-full ${gridTemplate} gap-spacious min-h-0`}>
            {leftPanelIsVisible && (
              <div className="min-h-0 max-h-full overflow-hidden">
                <WorkbenchPanelInline
                  title="Левая панель"
                  item={snapshot?.workbench?.left || null}
                  active={snapshot?.discussion_focus_ref === snapshot?.workbench?.left?.ref}
                  selected={selectedPanelId === 'left_workbench'}
                  sessionId={studySessionId}
                  onDropRef={(ref: string, dragData) => {
                    debugLog('StudyMode: Dropped on left workbench:', ref, dragData);
                    if (dragData?.type === 'group') {
                      debugLog('Group data:', dragData.data);
                    }
                    onWorkbenchDrop ? onWorkbenchDrop('left', ref, dragData) : onWorkbenchSet('left', ref, dragData);
                  }}
                  onPanelClick={() => {
                    handlePanelClick('left_workbench');
                  }}
                  onBorderClick={() => {
                    onWorkbenchFocus('left');
                  }}
                  onClear={snapshot?.workbench?.left ? () => onWorkbenchClear?.('left') : undefined}
                />
              </div>
            )}

            <div
              className={`bg-card/60 rounded-lg overflow-hidden transition-all min-h-0 ${
                selectedPanelId === 'focus'
                  ? 'focus-reader-selected'
                  : snapshot?.discussion_focus_ref === snapshot?.ref
                  ? 'focus-reader-active'
                  : 'border border-border/60'
              }`}
              onClick={(e) => {
                handlePanelClick('focus');
                if (e.target === e.currentTarget) {
                  onFocusClick && onFocusClick();
                }
              }}
            >
              <Suspense fallback={null}>
                {layoutVariant === 'traditional' ? (
                  <TraditionalTalmudDaf
                    dafRef={snapshot?.ref || ''}
                    discussionFocusRef={snapshot?.discussion_focus_ref}
                    segments={snapshot?.segments || []}
                    onSegmentClick={(ref) => onNavigateToRef?.(ref)}
                    onDafChange={(nextRef) => onNavigateToRef?.(nextRef)}
                    onLexiconDoubleClick={handleLexiconDoubleClick as any}
                    sageHighlights={sageHighlights}
                    conceptHighlights={conceptHighlights}
                    isFullscreen={isTraditionalFullscreen}
                    onToggleFullscreen={onToggleTraditionalFullscreen}
                    isAdmin={true}
                  />
                ) : (
                  <FocusReader
                    continuousText={continuousText}
                    isLoading={isLoading}
                    onNavigateToRef={onNavigateToRef}
                    onLexiconDoubleClick={handleLexiconDoubleClick}
                    isDailyMode={studySessionId?.startsWith('daily-') || false}
                    isBackgroundLoading={isBackgroundLoading}
                    onBack={onNavigateBack}
                    onForward={onNavigateForward}
                    onExit={onExit}
                    currentRef={snapshot?.ref}
                    canBack={canNavigateBack}
                    canForward={canNavigateForward}
                    onToggleLeftPanel={handleToggleLeftPanel}
                    onToggleRightPanel={handleToggleRightPanel}
                    showLeftPanel={leftPanelIsVisible}
                    showRightPanel={rightPanelIsVisible}
                    sessionId={studySessionId}
                  />
                )}
              </Suspense>
            </div>

            {rightPanelIsVisible && (
              <div className="min-h-0">
                <WorkbenchPanelInline
                  title="Правая панель"
                  item={snapshot?.workbench?.right || null}
                  active={snapshot?.discussion_focus_ref === snapshot?.workbench?.right?.ref}
                  selected={selectedPanelId === 'right_workbench'}
                  sessionId={studySessionId}
                  onDropRef={(ref: string, dragData) => {
                    debugLog('StudyMode: Dropped on right workbench:', ref, dragData);
                    if (dragData?.type === 'group') {
                      debugLog('Group data:', dragData.data);
                    }
                    onWorkbenchDrop ? onWorkbenchDrop('right', ref, dragData) : onWorkbenchSet('right', ref, dragData);
                  }}
                  onPanelClick={() => {
                    handlePanelClick('right_workbench');
                  }}
                  onBorderClick={() => {
                    onWorkbenchFocus('right');
                  }}
                  onClear={snapshot?.workbench?.right ? () => onWorkbenchClear?.('right') : undefined}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Side Expanded Tool Panel */}
      {activeRightTool !== null && (
        <div className="w-[380px] sm:w-[480px] lg:w-[560px] xl:w-[640px] max-w-[48vw] flex-shrink-0 h-full border-l border-border/20 bg-background/95 backdrop-blur flex flex-col shadow-sm transition-all duration-300">
          <StudyChatPanel
            className="h-full min-h-0"
            studySessionId={studySessionId}
            messages={messages}
            isLoadingMessages={isLoadingMessages}
            isSending={isSending}
            setIsSending={setIsSending}
            setMessages={setMessages}
            refreshStudySnapshot={refreshStudySnapshot}
            agentId={agentId}
            selectedPanelId={selectedPanelId}
            discussionFocusRef={snapshot?.discussion_focus_ref}
            snapshot={snapshot}
            panelActions={composerPanelActions}
            currentPersona={currentPersona}
            availablePersonas={availablePersonas}
            onPersonaChange={onPersonaChange}
            layoutMode={composerLayoutMode}
            panelMode={activeRightTool}
            setPanelMode={(mode) => setActiveRightTool(mode)}
            onClose={() => setActiveRightTool(null)}
          />
        </div>
      )}

      {/* Right Vertical Tool Dock / Rail */}
      <div className="w-12 flex-shrink-0 h-full border-l border-border/20 bg-muted/20 dark:bg-muted/10 flex flex-col items-center py-3 gap-2.5 z-20 select-none">
        {/* Tool 1: AI Chat */}
        <button
          type="button"
          onClick={() => handleToolClick('chat')}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group",
            activeRightTool === 'chat'
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/25 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
          )}
          title="Чат ИИ-Хаврута"
        >
          <MessageSquare className="w-4 h-4" />
          <span className="absolute right-12 px-2.5 py-1 bg-popover text-popover-foreground text-xs font-semibold rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border/40">
            Чат ИИ
          </span>
        </button>

        {/* Tool 2: Sugya Map */}
        <button
          type="button"
          onClick={() => handleToolClick('map')}
          className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all cursor-pointer relative group",
            activeRightTool === 'map'
              ? "bg-blue-500 text-white shadow-md shadow-blue-500/25 font-bold"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
          )}
          title="Карта Сугии"
        >
          <Network className="w-4 h-4" />
          <span className="absolute right-12 px-2.5 py-1 bg-popover text-popover-foreground text-xs font-semibold rounded-md shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 border border-border/40">
            Карта Сугии
          </span>
        </button>
      </div>
    </div>
  );
}
