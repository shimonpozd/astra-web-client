import { apiRequest } from './client';

export interface XpProfile {
  xp_total: number;
  level: number;
  xp_in_level: number;
  xp_to_next: number;
  last_level_up_at?: number | null;
}

export interface XpEventPayload {
  source: 'chat' | 'focus' | 'workbench' | 'lexicon' | 'daily';
  verb?: string;
  session_id?: string;
  ref?: string;
  title?: string;
  chars?: number;
  duration_ms?: number;
  amount?: number;
  event_id?: string;
  ts?: number;
}

export interface XpEvent {
  source: string;
  verb?: string;
  amount: number;
  ref?: string | null;
  title?: string | null;
  ts?: number | null;
}

export interface Achievement {
  category: string;
  level: string;
  value: number;
  to_next: number | null;
}

export async function getXpProfile(): Promise<XpProfile> {
  return apiRequest<XpProfile>('/xp/profile');
}

export async function postXpEvent(payload: XpEventPayload): Promise<XpProfile> {
  return apiRequest<XpProfile>('/xp/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function getXpHistory(limit: number = 50): Promise<XpEvent[]> {
  return apiRequest<XpEvent[]>(`/xp/history?limit=${limit}`);
}

export async function getAchievements(): Promise<Achievement[]> {
  return apiRequest<Achievement[]>('/achievements');
}
