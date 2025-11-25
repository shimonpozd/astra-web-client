import { Suspense, lazy, useState, useEffect, useCallback, useMemo } from "react";
import { useParams, useLocation, useNavigate } from "react-router-dom";
import { useChat } from "../../hooks/useChat";
import { useStudyMode } from "../../hooks/useStudyMode";
import { useTextSelectionListener } from "../../hooks/useTextSelectionListener";
const BookshelfPanel = lazy(() => import("../study/BookshelfPanel"));
const StudyMode = lazy(() =>
  import("../study/StudyMode").then((m) => ({ default: m.default }))
);
const StudyChatPanel = lazy(() =>
  import("../study/StudyMode").then((m) => ({ default: m.StudyChatPanel }))
);
const ChatSidebar = lazy(() => import("./ChatSidebar"));
const ChatViewport = lazy(() => import("./ChatViewport"));
const MessageComposer = lazy(() => import("./MessageComposer"));
const StudyNavigator = lazy(() => import("../study/nav/FocusNavOverlay"));
import TopBar from "../layout/TopBar"; // Import the new TopBar
import { api } from "../../services/api"; // Import api for daily session creation
import { useLayout } from "../../contexts/LayoutContext";
import { debugLog } from '../../utils/debugLogger';
import { authorizedFetch } from '../../lib/authorizedFetch';
import { buildStudyQuickActions } from '../../utils/studyQuickActions';
import { normalizeRefForAPI } from "../../utils/refUtils";

export function ChatLayout() {
  const navigate = useNavigate();
  const { sessionId: urlChatId } = useParams<{ sessionId: string }>();
  const location = useLocation();
  const [isSidebarVisible] = useState(true);
  const [isChatAreaVisible] = useState(true);
  const [agentId, setAgentId] = useState<string>(() => {
    return localStorage.getItem("astra_agent_id") || "default";
  });
  const [sidebarMode, setSidebarMode] = useState<'split' | 'compact'>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('astra_sidebar_mode') as 'split' | 'compact' | null;
        if (stored === 'compact') {
          return 'compact';
        }
      } catch (err) {}
    }
    return 'split';
  });

  // Study mode chat state
  const [studyMessages, setStudyMessages] = useState<any[]>([]);
  const [studyIsSending, setStudyIsSending] = useState(false);
  
  const selectedPanelId: string | null = null;

  const [leftWorkbenchVisible, setLeftWorkbenchVisible] = useState(true);
  const [rightWorkbenchVisible, setRightWorkbenchVisible] = useState(true);

  // Calculate current ref for bookshelf based on selected panel
  const getCurrentRefForBookshelf = () => {
    if (!studySnapshot) return undefined;
    
    // If a panel is selected (Iyun mode), use that panel's ref
    if (selectedPanelId) {
      switch (selectedPanelId) {
        case 'focus':
          return studySnapshot.ref;
        case 'left_workbench':
          // Extract ref string from BookshelfItem if needed
          const leftRef = studySnapshot.workbench?.left;
          return typeof leftRef === 'string' ? leftRef : leftRef?.ref;
        case 'right_workbench':
          // Extract ref string from BookshelfItem if needed
          const rightRef = studySnapshot.workbench?.right;
          return typeof rightRef === 'string' ? rightRef : rightRef?.ref;
        default:
          return studySnapshot.ref;
      }
    }
    
    // If no panel selected (Girsa mode), use discussion focus or main ref
    return studySnapshot.discussion_focus_ref || studySnapshot.ref;
  };

  const {
    isActive: isStudyActive,
    isLoading: isLoadingStudy,
    studySessionId,
    studySnapshot,
    startStudy,
    loadStudySession,
    exitStudy,
    navigateBack,
    navigateForward,
    canNavigateBack,
    canNavigateForward,
    isBackgroundLoading,
    workbenchSet,
    workbenchClear,
    workbenchFocus,
    focusMainText,
    navigateToRef,
    refreshStudySnapshot,
  } = useStudyMode();

  const {
    chats,
    isLoading: isLoadingChats,
    error: chatsError,
    messages,
    isLoadingMessages,
    selectedChatId,
    selectChat,
    createChat,
    sendMessage,
    isSending,
    deleteSession,
    completeDailySession,
    reloadChats,
    setSelectedChatId,
  } = useChat(agentId, urlChatId);
  const { mode } = useLayout();
  // Force GIRSA mode (temporarily disable IYUN)
  const studyUiMode: 'iyun' | 'girsa' = 'girsa';

  const studyQuickActions = useMemo(
    () =>
      buildStudyQuickActions({
        snapshot: studySnapshot,
        leftPanelVisible: leftWorkbenchVisible,
        rightPanelVisible: rightWorkbenchVisible,
      }),
    [studySnapshot, leftWorkbenchVisible, rightWorkbenchVisible]
  );



  useTextSelectionListener();

  // Function to load daily session as study mode
  const loadDailyAsStudy = async (dailySessionId: string) => {
    try {
      debugLog('Loading daily session as study:', dailySessionId);
      
      // Get daily session details
      const response = await authorizedFetch(`/api/sessions/${dailySessionId}`);
      if (!response.ok) {
        console.error('Failed to get daily session:', response.status);
        return;
      }
      
      const dailySession = await response.json();
      const textRef = dailySession.ref;
      
      if (textRef) {
        debugLog('Starting study with ref:', textRef, 'and daily session ID:', dailySessionId);
        // Start study mode with the calendar text using the existing daily session ID
        try {
          const sessionId = await startStudy(textRef, dailySessionId);
          debugLog('Study started successfully with session ID:', sessionId);
        } catch (error) {
          console.error('❌ Failed to start study:', error);
        }
      } else {
        console.error('No ref found in daily session:', dailySession);
      }
    } catch (error) {
      console.error('Failed to load daily session as study:', error);
    }
  };

  useEffect(() => {
    // If the URL is a study session URL, automatically load it.
    if (location.pathname.startsWith('/study/') && urlChatId) {
      loadStudySession(urlChatId);
    }
    
    // If the URL is a daily session URL, automatically load it as study.
    if (location.pathname.startsWith('/daily/') && urlChatId) {
      loadDailyAsStudy(urlChatId);
    }
  }, [location.pathname, urlChatId, loadStudySession, startStudy]);

  useEffect(() => {
    localStorage.setItem("astra_agent_id", agentId);
  }, [agentId]);

  useEffect(() => {
    if (studySnapshot && studySnapshot.chat_local) {
      // Only update messages if they're different to avoid overwriting local changes
      const snapshotMessages = studySnapshot.chat_local;
      if (JSON.stringify(snapshotMessages) !== JSON.stringify(studyMessages)) {
        // Only update if we have fewer messages locally (avoid overwriting new messages)
        if (studyMessages.length <= snapshotMessages.length) {
          setStudyMessages(snapshotMessages);
        }
      }
    }
  }, [studySnapshot, studyMessages]);

  const [isStudyNavigatorOpen, setIsStudyNavigatorOpen] = useState(false);
  const [studyNavigatorRef, setStudyNavigatorRef] = useState<string | undefined>(undefined);

  const handleStartStudy = useCallback(async (textRef: string) => {
    const normalizedRef = normalizeRefForAPI(textRef);
    if (!normalizedRef) {
      console.error('Cannot start study without a valid reference');
      return;
    }
    try {
      const newSessionId = await startStudy(normalizedRef);
      if (newSessionId) {
        navigate(`/study/${newSessionId}`);
        void reloadChats();
      }
    } catch (error) {
      console.error('Failed to create study session:', error);
    }
  }, [startStudy, navigate, reloadChats]);

  const handleOpenStudyNavigator = useCallback(() => {
    const preferredRef = studySnapshot?.discussion_focus_ref || studySnapshot?.ref;
    setStudyNavigatorRef(preferredRef ?? undefined);
    setIsStudyNavigatorOpen(true);
  }, [studySnapshot]);

  const handleCloseStudyNavigator = useCallback(() => {
    setIsStudyNavigatorOpen(false);
  }, []);

  const handleNavigateFromNavigator = useCallback(
    (ref: string) => {
      handleCloseStudyNavigator();
      void handleStartStudy(ref);
    },
    [handleCloseStudyNavigator, handleStartStudy]
  );

  const handleSelectSession = async (sessionId: string, type: 'chat' | 'study' | 'daily') => {
    debugLog('Chat clicked:', { sessionId, type });
    
    if (type === 'study') {
      // Just navigate. The useEffect hook will handle loading the session.
      navigate(`/study/${sessionId}`);
    } else if (type === 'daily') {
      // Lazy create daily session if needed, then navigate
      try {
        debugLog('Creating daily session:', sessionId);
        const created = await api.createDailySessionLazy(sessionId);
        debugLog('Daily session created:', created);
        
        debugLog('Navigating to:', `/daily/${sessionId}`);
        setSelectedChatId(sessionId);
        navigate(`/daily/${sessionId}`);
      } catch (error) {
        console.error('❌ Failed to create daily session:', error);
        setSelectedChatId(sessionId);
        navigate(`/daily/${sessionId}`);
      }
    } else {
      // Exiting study if active to reveal chat UI
      if (isStudyActive) {
        try { await exitStudy(); } catch (e) { console.warn('Failed to exit study cleanly:', e); }
      }
      selectChat(sessionId);
    }
  };

  const handleWorkbenchDrop = async (side: 'left' | 'right', ref: string, dragData?: {
    type: 'single' | 'group' | 'part';
    data?: any;
  }) => {
    try {
      debugLog('ChatLayout: handleWorkbenchDrop:', side, ref, dragData);
      
      if (dragData?.type === 'group') {
        debugLog('Handling group drop - all refs:', dragData.data?.refs);
        // TODO: Здесь можно добавить специальную логику для групп
        // Например, создать специальный UI для выбора конкретной части
        // Или добавить все части группы последовательно
        
        // Пока что используем первый ref для совместимости
        await workbenchSet(side, ref);
      } else {
        await workbenchSet(side, ref);
      }
    } catch (error) {
      console.error('Failed to handle workbench drop:', error);
    }
  };

  const handleToggleLeftWorkbench = useCallback(() => {
    setLeftWorkbenchVisible((visible) => {
      const next = !visible;
      if (!next && workbenchClear) {
        Promise.resolve(workbenchClear('left')).catch((error) => {
          console.error('Failed to clear left workbench when hiding:', error);
        });
      }
      return next;
    });
  }, [workbenchClear]);

  const handleToggleRightWorkbench = useCallback(() => {
    setRightWorkbenchVisible((visible) => {
      const next = !visible;
      if (!next && workbenchClear) {
        Promise.resolve(workbenchClear('right')).catch((error) => {
          console.error('Failed to clear right workbench when hiding:', error);
        });
      }
      return next;
    });
  }, [workbenchClear]);

  useEffect(() => {
    if (!isStudyActive) {
      setLeftWorkbenchVisible(true);
      setRightWorkbenchVisible(true);
    }
  }, [isStudyActive]);

  const sidebarColumnWidth = sidebarMode === 'compact' ? '64px' : '320px';
  const isVerticalLayout = mode === 'vertical_three' && isStudyActive;
  const cols: string[] = [];
  if (!isVerticalLayout) {
    if (isSidebarVisible) cols.push(sidebarColumnWidth);
    if (isChatAreaVisible) cols.push('1fr');
    if (isStudyActive && isChatAreaVisible) cols.push('400px');
  }
  const gridCols = cols.join(' ') || '1fr';
  const verticalColumns: string[] = [];
  if (isSidebarVisible) {
    verticalColumns.push(sidebarColumnWidth);
  }
  if (isChatAreaVisible) {
    verticalColumns.push('minmax(360px, 1fr)');
  }
  verticalColumns.push('minmax(560px, 1.25fr)');
  verticalColumns.push('400px');
  const verticalGridTemplate = verticalColumns.join(' ');

  return (
    <div className="h-screen w-full flex flex-col">
      <TopBar agentId={agentId} setAgentId={setAgentId} />

      {isVerticalLayout ? (
        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: verticalGridTemplate }}>
          {isSidebarVisible && (
            <div className="min-h-0 bg-background overflow-hidden h-full">
              <Suspense fallback={null}>
                <ChatSidebar
                  chats={chats}
                  isLoading={isLoadingChats}
                  error={chatsError}
                  selectedChatId={selectedChatId}
                  onSelectChat={handleSelectSession}
                  onCreateChat={createChat}
                  onCreateStudy={handleOpenStudyNavigator}
                  onDeleteSession={deleteSession}
                  onCompleteDaily={completeDailySession}
                  onModeChange={setSidebarMode}
                />
              </Suspense>
            </div>
          )}

          {isChatAreaVisible && (
            <div className="min-h-0 flex flex-col border-r border-border/20 bg-background">
              {isStudyActive ? (
                <Suspense fallback={null}>
                  <StudyChatPanel
                    className="flex-1"
                    studySessionId={studySessionId}
                    messages={studyMessages}
                    isLoadingMessages={false}
                    isSending={studyIsSending}
                    setIsSending={setStudyIsSending}
                    setMessages={setStudyMessages}
                    refreshStudySnapshot={refreshStudySnapshot}
                    agentId={agentId}
                    selectedPanelId={selectedPanelId}
                    discussionFocusRef={studySnapshot?.discussion_focus_ref}
                    studyMode={studyUiMode}
                    quickActions={studyQuickActions}
                  />
                </Suspense>
              ) : (
                <>
                  <div className="flex-1 min-h-0 overflow-y-auto panel-padding-sm">
                    <Suspense fallback={null}>
                      <ChatViewport
                        messages={messages.map((m) => ({ ...m, id: String(m.id) }))}
                        isLoading={isLoadingMessages}
                      />
                    </Suspense>
                  </div>
                  <div className="flex-shrink-0 panel-padding border-t border-border/20">
                    <Suspense fallback={null}>
                      <MessageComposer
                        onSendMessage={sendMessage}
                        disabled={isSending}
                        studyMode={studyUiMode}
                        selectedPanelId={selectedPanelId}
                      />
                    </Suspense>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="min-h-0 flex flex-col bg-background border-r border-border/20">
            <Suspense fallback={null}>
              <StudyMode
                snapshot={studySnapshot}
                onExit={exitStudy}
                onNavigateBack={navigateBack}
                onNavigateForward={navigateForward}
                isLoading={isLoadingStudy}
                canNavigateBack={canNavigateBack}
                canNavigateForward={canNavigateForward}
                messages={studyMessages}
                isLoadingMessages={false}
                isSending={studyIsSending}
                studySessionId={studySessionId}
                setIsSending={setStudyIsSending}
                setMessages={setStudyMessages}
                agentId={agentId}
                onWorkbenchSet={workbenchSet}
                onWorkbenchClear={workbenchClear}
                onWorkbenchFocus={workbenchFocus}
                onWorkbenchDrop={handleWorkbenchDrop}
                onFocusClick={focusMainText}
                onNavigateToRef={navigateToRef}
                refreshStudySnapshot={refreshStudySnapshot}
                selectedPanelId={selectedPanelId}
                onSelectedPanelChange={() => {}}
                isBackgroundLoading={isBackgroundLoading}
                layoutVariant="stacked"
                showChatPanel={false}
                showLeftPanel={leftWorkbenchVisible}
                showRightPanel={rightWorkbenchVisible}
                onToggleLeftPanel={handleToggleLeftWorkbench}
                onToggleRightPanel={handleToggleRightWorkbench}
              />
            </Suspense>
          </div>

          <div className="min-h-0 overflow-hidden bg-background">
            <Suspense fallback={null}>
              <BookshelfPanel
                sessionId={studySessionId || undefined}
                currentRef={getCurrentRefForBookshelf()}
                onDragStart={(ref) => debugLog('Dragging from bookshelf:', ref)}
                onItemClick={(item) => debugLog('Clicked bookshelf item:', item)}
                onAddToWorkbench={async (ref, side) => {
                  if (side) {
                    await workbenchSet(side, ref);
                  }
                }}
                studySnapshot={studySnapshot}
              />
            </Suspense>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid" style={{ gridTemplateColumns: gridCols }}>
          {isSidebarVisible && (
            <Suspense fallback={null}>
              <div className="h-full">
                <ChatSidebar
                  chats={chats}
                  isLoading={isLoadingChats}
                  error={chatsError}
                  selectedChatId={selectedChatId}
                  onSelectChat={handleSelectSession}
                  onCreateChat={createChat}
                  onCreateStudy={handleOpenStudyNavigator}
                  onDeleteSession={deleteSession}
                  onCompleteDaily={completeDailySession}
                  onModeChange={setSidebarMode}
                />
              </div>
            </Suspense>
          )}

          {isChatAreaVisible && (
            <main className="flex flex-col min-h-0 bg-background">
              <div className="flex-1 min-h-0">
                {isStudyActive ? (
                  <Suspense fallback={null}>
                    <StudyMode
                      snapshot={studySnapshot}
                      onExit={exitStudy}
                      onNavigateBack={navigateBack}
                      onNavigateForward={navigateForward}
                      isLoading={isLoadingStudy}
                      canNavigateBack={canNavigateBack}
                      canNavigateForward={canNavigateForward}
                      messages={studyMessages}
                      isLoadingMessages={false}
                      isSending={studyIsSending}
                      studySessionId={studySessionId}
                      setIsSending={setStudyIsSending}
                      setMessages={setStudyMessages}
                      agentId={agentId}
                      onWorkbenchSet={workbenchSet}
                      onWorkbenchClear={workbenchClear}
                      onWorkbenchFocus={workbenchFocus}
                      onWorkbenchDrop={handleWorkbenchDrop}
                      onFocusClick={focusMainText}
                      onNavigateToRef={navigateToRef}
                      refreshStudySnapshot={refreshStudySnapshot}
                      selectedPanelId={selectedPanelId}
                      onSelectedPanelChange={() => {}}
                      isBackgroundLoading={isBackgroundLoading}
                      layoutVariant="classic"
                      showLeftPanel={leftWorkbenchVisible}
                      showRightPanel={rightWorkbenchVisible}
                      onToggleLeftPanel={handleToggleLeftWorkbench}
                      onToggleRightPanel={handleToggleRightWorkbench}
                    />
                  </Suspense>
                ) : (
                  <div className="h-full flex flex-col min-h-0">
                    <div className="flex-1 min-h-0">
                      <Suspense fallback={null}>
                        <ChatViewport
                          messages={messages.map((m) => ({ ...m, id: String(m.id) }))}
                          isLoading={isLoadingMessages}
                        />
                      </Suspense>
                    </div>
                    <div className="flex-shrink-0 panel-padding">
                      <Suspense fallback={null}>
                        <MessageComposer onSendMessage={sendMessage} disabled={isSending} />
                      </Suspense>
                    </div>
                  </div>
                )}
              </div>
            </main>
          )}

          {isStudyActive && isChatAreaVisible && (
            <div className="min-h-0 overflow-hidden">
              <Suspense fallback={null}>
                <BookshelfPanel
                  sessionId={studySessionId || undefined}
                  currentRef={getCurrentRefForBookshelf()}
                  onDragStart={(ref) => debugLog('Dragging from bookshelf:', ref)}
                  onItemClick={(item) => debugLog('Clicked bookshelf item:', item)}
                  onAddToWorkbench={async (ref, side) => {
                    if (side) {
                      await workbenchSet(side, ref);
                    }
                  }}
                  studySnapshot={studySnapshot}
                />
              </Suspense>
            </div>
          )}
        </div>
      )}
      {isStudyNavigatorOpen && (
        <Suspense fallback={null}>
          <StudyNavigator
            open={isStudyNavigatorOpen}
            onClose={handleCloseStudyNavigator}
            onSelectRef={handleNavigateFromNavigator}
            currentRef={studyNavigatorRef}
          />
        </Suspense>
      )}
    </div>
  );
}
