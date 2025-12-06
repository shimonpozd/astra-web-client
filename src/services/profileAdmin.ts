import { authorizedFetch } from '../lib/authorizedFetch';
import { ProfileResponse } from './api';

export interface CreateAuthorPayload {
  name: string;
  wiki_url?: string | null;
  raw_text?: string | null;
  period?: string | null;
  period_ru?: string | null;
  region?: string | null;
  generation?: number | null;
  sub_period?: string | null;
}

export async function createAuthorProfile(payload: CreateAuthorPayload): Promise<ProfileResponse> {
  const response = await authorizedFetch('/api/profile/author_only', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || 'Failed to create author profile');
  }
  return response.json();
}
