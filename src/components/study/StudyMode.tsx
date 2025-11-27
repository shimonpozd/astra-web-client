import { useState, useEffect, useCallback, useMemo, Suspense, lazy } from 'react';
import { StudySnapshot } from '../../types/study';
import { ContinuousText, TextSegment, ChapterNavigation } from '../../types/text';
const FocusReader = lazy(() => import('./FocusReader'));
import ChatViewport from '../chat/ChatViewport';
import MessageComposer from '../chat/MessageComposer';
import WorkbenchPanelInline from './WorkbenchPanelInline';
import { api } from '../../services/api';
import { useLexiconStore } from '../../store/lexiconStore';
import { Message } from '../../services/api';
import { debugLog } from '../../utils/debugLogger';
import { parseRefSmart } from '../../utils/refUtils';
import { TANAKH_BOOKS } from '../../data/tanakh';
import { getChapterSizesForWork } from '../../lib/sefariaShapeCache';
import { buildStudyQuickActions } from '../../utils/studyQuickActions';
import { emitGamificationEvent } from '../../contexts/GamificationContext';
import { calcTextXp, docToPlainText } from '../../utils/xpUtils';
import type { PanelActions, Persona } from '../../types/chat';

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
}: StudyChatPanelProps) {
  const containerClass = `flex flex-col min-h-0 ${className || ''}`;

  return (
    <div className={containerClass}>
      <div className="flex-1 min-h-0 overflow-y-auto panel-padding-sm">
        <ChatViewport messages={messages.map((m) => ({ ...m, id: String(m.id) }))} isLoading={isLoadingMessages} />
      </div>
      <div className="flex-shrink-0 panel-padding">
        <MessageComposer
          onSendMessage={async (message) => {
            if (!studySessionId) return;
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
  layoutVariant?: 'classic' | 'stacked';
  showChatPanel?: boolean;
  currentPersona?: Persona;
  availablePersonas?: Persona[];
  onPersonaChange?: (persona: Persona) => void;
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
  layoutVariant = 'classic',
  showChatPanel = true,
  currentPersona,
  availablePersonas,
  onPersonaChange,
}: StudyModeProps) {
  // Use props if provided, otherwise fall back to local state
  const [localSelectedPanelId, setLocalSelectedPanelId] = useState<string | null>(null);
  const selectedPanelId = propSelectedPanelId !== undefined ? propSelectedPanelId : localSelectedPanelId;
  const setSelectedPanelId = onSelectedPanelChange || setLocalSelectedPanelId;
  
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
  const handleLexiconDoubleClick = async (segment?: TextSegment) => {
    const selected = (window.getSelection()?.toString() || '').trim();
    const fallback = segment?.heText || segment?.text || '';
    const contextRaw = fallback || selected || '';
    const context = contextRaw
      ? contextRaw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      : '';

    const rawText = selected || fallback;
    if (!rawText) return;

    const cleanText = rawText
      .replace(/[֑-ׇ]/g, '')
      .replace(/["'""().,!?;:\-\[\]{}]/g, '')
      .trim();

    if (!cleanText) return;

    setSelection(cleanText, context || null);
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
    <div className="flex flex-col h-full panel-inner">
      <div className="flex flex-1 min-h-0 flex-col">
        <div className="flex flex-1 min-h-0 flex-col">
          <div
            className={
              showChatPanel
                ? 'min-h-0 flex-[1_1_50%] basis-1/2 panel-padding'
                : 'min-h-0 flex-1 panel-padding'
            }
          >
            {isStackedLayout ? (
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

          {showChatPanel && (
            <StudyChatPanel
              className="min-h-0 flex-[1_1_50%] basis-1/2 border-t border-border/20"
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
              panelActions={composerPanelActions}
              currentPersona={currentPersona}
              availablePersonas={availablePersonas}
              onPersonaChange={onPersonaChange}
              layoutMode={composerLayoutMode}
            />
          )}
        </div>
      </div>

      {/* Lexicon Modal removed - now using global LexiconPanel */}
    </div>
  );
}
