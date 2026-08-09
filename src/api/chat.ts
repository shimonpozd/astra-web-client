import { DocV1 } from '../types/text';
import { debugLog } from '../utils/debugLogger';
import { authorizedFetch } from '../lib/authorizedFetch';
import { API_BASE, apiRequest } from './client';
import { processStream, StreamHandler } from './streaming';

export interface Chat {
  session_id: string;
  name: string;
  last_modified: string;
  type: 'chat' | 'study' | 'daily';
  completed?: boolean;
  display_value?: string;
  display_value_he?: string;
  display_value_ru?: string;
  daily_category?: string;
  stale?: boolean;
  daily_stream?: {
    stream_id: string;
    units_total: number;
    unit_index_today: number;
  };
}

export interface Message {
  id: string | number;
  role: 'user' | 'assistant' | 'system' | 'source';
  content: string | DocV1 | null;
  content_type?: 'text.v1' | 'doc.v1' | 'thought.v1';
  timestamp: number | Date;
}

export interface ChatRequest {
  text: string;
  session_id?: string;
  agent_id?: string;
  context?: 'focus' | 'workbench-left' | 'workbench-right';
}

interface ChatHistoryResponse {
  history: Message[];
}

export async function getChatList(): Promise<Chat[]> {
  return apiRequest<Chat[]>('/sessions', { fallback: [] });
}

export async function getChatHistory(sessionId: string): Promise<Message[]> {
  const data = await apiRequest<ChatHistoryResponse>(`/chats/${sessionId}`, { fallback: { history: [] } });
  return data.history || [];
}

export async function deleteChat(sessionId: string): Promise<void> {
  return apiRequest<void>(`/chats/${sessionId}`, { method: 'DELETE' });
}

export async function deleteDailySession(sessionId: string): Promise<void> {
  debugLog('Daily session deletion:', {
    sessionId,
    note: "Daily sessions are virtual and don't exist until created",
  });
  debugLog('Daily session "deleted" (virtual session)');
}

export async function deleteSession(sessionId: string, sessionType: 'chat' | 'study' | 'daily'): Promise<void> {
  if (sessionType === 'daily') {
    return deleteDailySession(sessionId);
  }

  const url = `/sessions/${sessionId}/${sessionType}`;
  debugLog('API deleteSession call:', { url, sessionId, sessionType, method: 'DELETE' });
  await apiRequest<void>(url, { method: 'DELETE' });
  debugLog('API deleteSession successful');
}

export async function sendMessage(request: ChatRequest, handler: StreamHandler): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    await processStream(response, handler);
  } catch (error) {
    console.error('Failed to send message:', error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}

export async function sendMessageWithBlocks(request: ChatRequest, handler: StreamHandler): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/chat/stream-blocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
    await processStream(response, handler);
  } catch (error) {
    console.error('Failed to send message with blocks:', error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}

export async function explainTerm(term: string, contextText: string, handler: StreamHandler): Promise<void> {
  try {
    const response = await authorizedFetch(`${API_BASE}/actions/explain-term`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ term, context_text: contextText }),
    });

    if (!response.body) {
      throw new Error('Response body is empty');
    }

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        handler.onComplete?.();
        break;
      }
      if (value) {
        handler.onChunk?.(value);
      }
    }
  } catch (error) {
    console.error('Failed to explain term:', error);
    handler.onError?.(error instanceof Error ? error : new Error('Unknown stream error'));
  }
}
