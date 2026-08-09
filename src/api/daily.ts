import { authorizedFetch } from '../lib/authorizedFetch';
import { API_BASE, apiRequest } from './client';

export interface DailyProgressEntry {
  session_id: string;
  category?: string | null;
  ref?: string | null;
  title?: string | null;
  ts?: string;
}

export interface DailyProgressDay {
  date: string;
  completed: boolean;
  entries: DailyProgressEntry[];
}

export interface DailyProgressResponse {
  today: string;
  streak: { current: number; best: number };
  history: DailyProgressDay[];
}

export interface VirtualDailyChat {
  session_id: string;
  title: string;
  he_title: string;
  title_ru?: string;
  display_value: string;
  he_display_value: string;
  display_value_ru?: string;
  ref: string;
  category: string;
  order: number;
  date: string;
  exists: boolean;
  stream: {
    stream_id: string;
    title: {
      en?: string;
      he?: string;
    };
    units_total: number;
    unit_index_today: number;
  };
}

export async function getDailyCalendar(): Promise<VirtualDailyChat[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const response = await authorizedFetch(`${API_BASE}/daily/calendar`, { signal: controller.signal });
    clearTimeout(timer);
    if (!response.ok) {
      throw new Error(`Failed to get daily calendar: ${response.statusText}`);
    }
    const data = await response.json();
    return data.virtual_chats || [];
  } catch (error) {
    console.error('Failed to fetch daily calendar:', error);
    return [];
  }
}

export async function createDailySessionLazy(sessionId: string): Promise<boolean> {
  try {
    const result = await apiRequest<{ created?: boolean }>(`/daily/create/${sessionId}`, { method: 'POST' });
    return result.created || false;
  } catch (error) {
    console.error('Failed to create daily session:', error);
    return false;
  }
}

export async function markDailyComplete(
  sessionId: string,
  completed: boolean
): Promise<{ streak?: { current: number; best: number }; date?: string }> {
  return apiRequest<{ streak?: { current: number; best: number }; date?: string }>(
    `/daily/${sessionId}/complete?completed=${completed}`,
    { method: 'PATCH' }
  );
}

export async function getDailyProgress(days: number = 90): Promise<DailyProgressResponse> {
  return apiRequest<DailyProgressResponse>(`/daily/progress?days=${days}`);
}

export async function getDailySegments(sessionId: string): Promise<{
  session_id: string;
  segments: any[];
  total_segments: number;
  loaded_segments: number;
}> {
  return apiRequest<{
    session_id: string;
    segments: any[];
    total_segments: number;
    loaded_segments: number;
  }>(`/daily/${sessionId}/segments`);
}
