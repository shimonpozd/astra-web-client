import { authorizedFetch } from '../lib/authorizedFetch';
import { API_BASE, apiRequest } from './client';
import { processStream, StreamHandler } from './streaming';

export async function getStudyState(sessionId: string): Promise<any> {
  const result = await apiRequest<{ ok: boolean; state: any }>(`/study/state?session_id=${encodeURIComponent(sessionId)}`);
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from get study state');
  }
  return result.state;
}

export async function getLexicon(word: string): Promise<any> {
  return apiRequest<any>(`/study/lexicon?word=${encodeURIComponent(word)}`);
}

export async function getTalmudComments(ref: string): Promise<any> {
  return apiRequest<any>(`/study/talmud/comments?ref=${encodeURIComponent(ref)}`);
}

export async function getBookshelfCategories(): Promise<Array<{ name: string; color: string }>> {
  return apiRequest<Array<{ name: string; color: string }>>('/study/categories');
}

export async function getBookshelfItems(sessionId: string, ref: string, category?: string): Promise<any> {
  return apiRequest<any>('/study/bookshelf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, ref, categories: category ? [category] : undefined }),
  });
}

export async function sendStudyMessage(
  sessionId: string,
  text: string,
  handler: StreamHandler,
  agentId?: string,
  selectedPanelId?: string | null
): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/study/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        text,
        agent_id: agentId,
        selected_panel_id: selectedPanelId,
      }),
    });
    await processStream(response, handler);
  } catch (error) {
    console.error('Failed to send study message:', error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}

export async function resolveRef(text: string): Promise<any> {
  return apiRequest<any>('/study/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

export async function setFocus(sessionId: string, ref: string, focusRef?: string): Promise<any> {
  const result = await apiRequest<{ ok: boolean; state: any }>('/study/set_focus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: sessionId,
      ref,
      focus_ref: focusRef ?? ref,
      window_size: 30,
      navigation_type: 'drill_down',
    }),
  });
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from set_focus');
  }
  return result.state;
}

export async function navigateBack(sessionId: string): Promise<any> {
  const result = await apiRequest<{ ok: boolean; state: any }>('/study/back', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from back');
  }
  return result.state;
}

export async function navigateForward(sessionId: string): Promise<any> {
  const result = await apiRequest<{ ok: boolean; state: any }>('/study/forward', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from forward');
  }
  return result.state;
}

export async function setDiscussionFocus(sessionId: string, ref: string): Promise<any> {
  const result = await apiRequest<{ ok: boolean; state: any }>('/study/chat/set_focus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, ref }),
  });
  if (!result.ok || !result.state) {
    throw new Error('Invalid response from set_discussion_focus');
  }
  return result.state;
}
