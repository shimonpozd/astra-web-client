import { useState, useCallback, useRef } from 'react';
import { api } from '../services/api';
import { StudySnapshot } from '../types/study';
import { TextSegment } from '../types/text';
import { normalizeRefForAPI } from '../utils/refUtils';
import { debugLog } from '../utils/debugLogger';
import { authorizedFetch } from '../lib/authorizedFetch';

export function useStudyMode() {
  const [isActive, setIsActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studySessionId, setStudySessionId] = useState<string | null>(null);
  const [studySnapshot, setStudySnapshot] = useState<StudySnapshot | null>(null);
  const [canNavigateBack, setCanNavigateBack] = useState(true);
  const [canNavigateForward, setCanNavigateForward] = useState(true);
  const [isBackgroundLoading, setIsBackgroundLoading] = useState(false);
  const [segmentPollingInterval, setSegmentPollingInterval] = useState<NodeJS.Timeout | null>(null);
  const [preferredFocusRef, setPreferredFocusRef] = useState<string | null>(null);
  const preferredFocusRefRef = useRef<string | null>(null);

  const normalizeRef = useCallback((value?: string | null) => {
    if (!value) return '';
    return normalizeRefForAPI(value)
      .replace(/\s+/g, ' ')
      .replace(/[–—]/g, '-')
      .trim()
      .toLowerCase();
  }, []);

  const applyLocalFocus = useCallback(
    (state: StudySnapshot | null | undefined, ref: string, segment?: TextSegment) => {
      if (!state?.segments?.length) {
        return state || null;
      }

      const targetNormalized = normalizeRef(ref);
      const index = state.segments.findIndex(
        (item) => normalizeRef(item.ref) === targetNormalized,
      );

      if (index === -1) {
        return state;
      }

      const nextSegment = segment ?? state.segments[index];

      if (
        state.focusIndex === index &&
        state.ref === nextSegment.ref &&
        state.discussion_focus_ref === nextSegment.ref
      ) {
        return state;
      }

      return {
        ...state,
        focusIndex: index,
        ref: nextSegment.ref,
        discussion_focus_ref: nextSegment.ref,
      };
    },
    [normalizeRef],
  );

  const setLocalFocus = useCallback(
    (ref: string, segment?: TextSegment) => {
      setStudySnapshot((prev) => applyLocalFocus(prev, ref, segment));
    },
    [applyLocalFocus],
  );

  const applyPreferredFocus = useCallback(
    (state: StudySnapshot | null | undefined, fallbackRef?: string | null, segment?: TextSegment) => {
      if (!state) return state;
      const targetRef = fallbackRef ?? preferredFocusRefRef.current;
      if (!targetRef) {
        return state;
      }
      return applyLocalFocus(state, targetRef, segment);
    },
    [applyLocalFocus],
  );

  const updatePreferredFocus = useCallback((value: string | null) => {
    preferredFocusRefRef.current = value;
    setPreferredFocusRef(value);
  }, []);

  const startStudy = useCallback(async (textRef: string, existingSessionId?: string) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const sessionId = existingSessionId || crypto.randomUUID();
      setStudySessionId(sessionId);

      const snapshot = await api.setFocus(sessionId, textRef);
      debugLog('🔍 API setFocus response:', snapshot);
      const focusRef = snapshot?.ref || textRef || null;
      setStudySnapshot(snapshot);
      updatePreferredFocus(focusRef);
      setCanNavigateBack(true);
      setCanNavigateForward(true);
      setIsActive(true);

      // For Daily Mode, start background loading indicator and polling
      if (sessionId.startsWith('daily-')) {
        setIsBackgroundLoading(true);
        
        // Start polling for new segments
        const interval = setInterval(async () => {
          try {
            const segmentsData = await api.getDailySegments(sessionId);
            debugLog('📊 Polling segments:', segmentsData.loaded_segments, '/', segmentsData.total_segments);
            
            if (segmentsData.loaded_segments > 0) {
              // Update study snapshot with new segments
              setStudySnapshot(prev => {
                if (!prev) return prev;
                return applyPreferredFocus({
                  ...prev,
                  segments: segmentsData.segments
                });
              });
              
              // Stop polling if all segments are loaded
              if (segmentsData.loaded_segments >= segmentsData.total_segments) {
                debugLog('✅ All segments loaded, stopping polling');
                clearInterval(interval);
                setIsBackgroundLoading(false);
                setSegmentPollingInterval(null);
              }
            }
          } catch (error) {
            console.error('Failed to poll segments:', error);
            // Stop polling on error
            clearInterval(interval);
            setIsBackgroundLoading(false);
            setSegmentPollingInterval(null);
          }
        }, 1000); // Poll every second
        
        setSegmentPollingInterval(interval);
        
        // Stop polling after 30 seconds max
        setTimeout(() => {
          if (interval) {
            clearInterval(interval);
            setIsBackgroundLoading(false);
            setSegmentPollingInterval(null);
          }
        }, 30000);
      }

      return sessionId; // Return the session ID

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to start study mode';
      setError(msg);
      console.error(msg, e);
      throw e; // Re-throw the error so the caller can catch it
    } finally {
      setIsLoading(false);
    }
  }, [applyPreferredFocus, updatePreferredFocus]);

  const exitStudy = useCallback(() => {
    setIsActive(false);
    setStudySnapshot(null);
    setStudySessionId(null);
    setError(null);
    updatePreferredFocus(null);
    
    // Clear polling interval if exists
    if (segmentPollingInterval) {
      clearInterval(segmentPollingInterval);
      setSegmentPollingInterval(null);
    }
    setIsBackgroundLoading(false);
  }, [segmentPollingInterval]);

  const navigateBack = useCallback(async () => {
    if (!studySessionId) return;
    try {
      setIsLoading(true);
      const snapshot = await api.navigateBack(studySessionId);
      setStudySnapshot(snapshot);
      updatePreferredFocus(snapshot?.ref || null);
      setCanNavigateBack(true);
      setCanNavigateForward(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to navigate back';
      setError(msg);
      setCanNavigateBack(false);
    } finally {
      setIsLoading(false);
    }
  }, [studySessionId, updatePreferredFocus]);

  const navigateForward = useCallback(async () => {
    if (!studySessionId) return;
    try {
      setIsLoading(true);
      const snapshot = await api.navigateForward(studySessionId);
      setStudySnapshot(snapshot);
      updatePreferredFocus(snapshot?.ref || null);
      setCanNavigateBack(true);
      setCanNavigateForward(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to navigate forward';
      setError(msg);
      setCanNavigateForward(false);
    } finally {
      setIsLoading(false);
    }
  }, [studySessionId, updatePreferredFocus]);

  const workbenchSet = useCallback(async (side: 'left' | 'right', ref: string) => {
    if (!studySessionId) return;
    const preservedRef = preferredFocusRefRef.current || studySnapshot?.ref || null;
    try {
      setIsLoading(true);
      const response = await authorizedFetch('/api/study/workbench/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: studySessionId,
          slot: side,
          ref: ref,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to set workbench');
      }
      const result = await response.json();
      if (result.ok && result.state) {
        const stableRef = preservedRef || result.state?.ref || null;
        let nextState = applyPreferredFocus(result.state, stableRef);
        // Жёстко фиксируем ссылку, чтобы drop в workbench не трогал FocusReader
        if (stableRef) {
          nextState = {
            ...nextState,
            ref: stableRef,
            discussion_focus_ref: stableRef,
          };
        }
        setStudySnapshot(nextState);
        updatePreferredFocus(stableRef);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to set workbench';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [applyPreferredFocus, studySessionId, studySnapshot, updatePreferredFocus]);

  const workbenchClear = useCallback(async (side: 'left' | 'right') => {
    if (!studySessionId) return;
    const preservedRef = preferredFocusRefRef.current || studySnapshot?.ref || null;
    try {
      setIsLoading(true);
      const response = await authorizedFetch('/api/study/workbench/set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: studySessionId,
          slot: side,
          ref: null,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to clear workbench');
      }
      const result = await response.json();
      if (result?.ok && result?.state) {
        const nextState = applyPreferredFocus(result.state, preservedRef);
        setStudySnapshot(nextState);
        updatePreferredFocus(preservedRef || result.state?.ref || null);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to clear workbench';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [applyPreferredFocus, studySessionId, studySnapshot, updatePreferredFocus]);

  const workbenchFocus = useCallback(async (side: 'left' | 'right') => {
    if (!studySessionId) return;
    const ref = side === 'left' ? studySnapshot?.workbench?.left?.ref : studySnapshot?.workbench?.right?.ref;
    if (!ref) return;
    try {
      setIsLoading(true);
      const response = await authorizedFetch('/api/study/chat/set_focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: studySessionId,
          ref: ref,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to set focus');
      }
      const result = await response.json();
      if (result.ok && result.state) {
        const nextState = applyLocalFocus(result.state, ref);
        setStudySnapshot(nextState);
        updatePreferredFocus(ref);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to focus workbench';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [applyLocalFocus, studySessionId, studySnapshot, updatePreferredFocus]);

  const focusMainText = useCallback(async () => {
    if (!studySessionId || !studySnapshot?.ref) return;
    const targetRef = studySnapshot.ref;
    try {
      setIsLoading(true);
      const response = await authorizedFetch('/api/study/chat/set_focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: studySessionId,
          ref: studySnapshot.ref,
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to set focus');
      }
      const result = await response.json();
      if (result.ok && result.state) {
        const nextState = applyLocalFocus(result.state, targetRef);
        setStudySnapshot(nextState);
        updatePreferredFocus(targetRef);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to focus main text';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [applyLocalFocus, studySessionId, studySnapshot, updatePreferredFocus]);

  const navigateToRef = useCallback(async (ref: string, segment?: TextSegment) => {
    if (!studySessionId) return;

    const targetRefNormalized = normalizeRef(ref);
    const segments = studySnapshot?.segments || [];
    const existingIndex = segments.findIndex(item => normalizeRef(item.ref) === targetRefNormalized);
    const isLocalNavigation = existingIndex !== -1;
    const fallbackSegment = segment ?? (isLocalNavigation ? segments[existingIndex] : undefined);
    const pendingRef = fallbackSegment?.ref || ref;

    updatePreferredFocus(pendingRef);

    if (fallbackSegment) {
      setLocalFocus(pendingRef, fallbackSegment);
    }

    const nearWindowEdge =
      isLocalNavigation &&
      (existingIndex <= 1 || existingIndex >= Math.max(segments.length - 2, 0));
    // Если нужный отрывок уже есть в текущем окне и мы не на краю окна — не дергаем бэк
    if (isLocalNavigation && !nearWindowEdge) {
      return;
    }

    try {
      setIsLoading(true);

      debugLog('🧭 NavigateToRef:', { 
        studySessionId, 
        ref, 
        isDaily: studySessionId.startsWith('daily-'),
        isLocalNavigation,
        nearWindowEdge
      });
      
      const response = await authorizedFetch('/api/study/set_focus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: studySessionId,
          ref: ref,
          navigation_type: 'advance',
        }),
      });
      if (!response.ok) {
        throw new Error('Failed to navigate to ref');
      }
      const result = await response.json();
      if (result.ok && result.state) {
        const baseState = { ...result.state };
        setStudySnapshot(applyLocalFocus(baseState, pendingRef, fallbackSegment));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to navigate';
      setError(msg);
    } finally {
      if (!isLocalNavigation) {
        setIsLoading(false);
      }
    }
  }, [applyLocalFocus, normalizeRef, setLocalFocus, updatePreferredFocus, studySessionId, studySnapshot]);

  const loadStudySession = useCallback(async (sessionId: string) => {
    try {
      setIsLoading(true);
      setError(null);

      const snapshot = await api.getStudyState(sessionId);
      const focusRef = snapshot?.ref || null;
      setStudySessionId(sessionId);
      setStudySnapshot(applyPreferredFocus(snapshot, focusRef));
      updatePreferredFocus(focusRef);
      setCanNavigateBack(true);
      setCanNavigateForward(true);
      setIsActive(true);

      // For Daily Mode, check if all segments are already loaded
      if (sessionId.startsWith('daily-')) {
        try {
          const segmentsData = await api.getDailySegments(sessionId);
          debugLog('📊 Existing session segments:', segmentsData.loaded_segments, '/', segmentsData.total_segments);
          
          if (segmentsData.loaded_segments >= segmentsData.total_segments) {
            debugLog('✅ All segments already loaded, no polling needed');
            setIsBackgroundLoading(false);
          } else {
            debugLog('🔄 Some segments missing, starting polling');
            setIsBackgroundLoading(true);
            
            // Start polling for remaining segments
            const interval = setInterval(async () => {
              try {
                const segmentsData = await api.getDailySegments(sessionId);
                debugLog('📊 Polling segments:', segmentsData.loaded_segments, '/', segmentsData.total_segments);
                
                if (segmentsData.loaded_segments > 0) {
                  // Update study snapshot with new segments
                  setStudySnapshot(prev => {
                    if (!prev) return prev;
                    return applyPreferredFocus({
                      ...prev,
                      segments: segmentsData.segments
                    });
                  });
                  
                  // Stop polling if all segments are loaded
                  if (segmentsData.loaded_segments >= segmentsData.total_segments) {
                    debugLog('✅ All segments loaded, stopping polling');
                    clearInterval(interval);
                    setIsBackgroundLoading(false);
                    setSegmentPollingInterval(null);
                  }
                }
              } catch (error) {
                console.error('Failed to poll segments:', error);
                // Stop polling on error
                clearInterval(interval);
                setIsBackgroundLoading(false);
                setSegmentPollingInterval(null);
              }
            }, 1000);
            
            setSegmentPollingInterval(interval);
            
            // Stop polling after 30 seconds max
            setTimeout(() => {
              if (interval) {
                clearInterval(interval);
                setIsBackgroundLoading(false);
                setSegmentPollingInterval(null);
              }
            }, 30000);
          }
        } catch (error) {
          console.error('Failed to check existing segments:', error);
          setIsBackgroundLoading(false);
        }
      }

    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load study session';
      setError(msg);
      console.error(msg, e);
    } finally {
      setIsLoading(false);
    }
  }, [applyPreferredFocus, updatePreferredFocus]);

  const refreshStudySnapshot = useCallback(async () => {
    if (!studySessionId) return;
    try {
      const snapshot = await api.getStudyState(studySessionId);
      setStudySnapshot(applyPreferredFocus(snapshot));
    } catch (e) {
      console.error("Failed to refresh study snapshot:", e);
    }
  }, [applyPreferredFocus, studySessionId]);


  return {
    isActive,
    isLoading,
    error,
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
    refreshStudySnapshot, // Export the new function
  };
}
