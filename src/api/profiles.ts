import { apiRequest } from './client';

export interface ProfileImage {
  url?: string;
  alt?: string;
}

export interface ProfileFacts {
  title_en?: string;
  title_he?: string;
  lifespan?: string;
  period?: string;
  compPlace?: string;
  pubPlace?: string;
  categories?: string[];
  authors?: string[] | string;
  links?: Record<string, string>;
  images?: ProfileImage[];
  generated_at?: string;
}

export interface ProfileResponse {
  ok: boolean;
  slug: string;
  title_en?: string;
  title_he?: string;
  summary_html?: string;
  summary_work_html?: string | null;
  summary_author_html?: string | null;
  facts?: { work?: any; author?: any };
  authors?: string[] | string | null;
  lifespan?: string | null;
  period?: string | null;
  comp_place?: string | null;
  pub_place?: string | null;
  json_raw?: any;
  error?: string;
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  source?: 'manual' | 'generated';
}

export interface ProfileListItem {
  slug: string;
  title_en?: string | null;
  title_he?: string | null;
  is_verified?: boolean;
  verified_by?: string | null;
  verified_at?: string | null;
  updated_at?: string | null;
  source?: 'manual' | 'generated';
}

export async function getProfile(slug: string): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>(`/profile?slug=${encodeURIComponent(slug)}`);
}

export async function updateProfile(payload: {
  slug: string;
  summary_html?: string | null;
  facts?: any;
  title_en?: string;
  title_he?: string;
  title_ru?: string;
}): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>('/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function regenerateProfile(slug: string): Promise<ProfileResponse> {
  return apiRequest<ProfileResponse>(`/profile/regenerate?slug=${encodeURIComponent(slug)}`, {
    method: 'POST',
  });
}

export async function deleteProfile(slug: string): Promise<void> {
  return apiRequest<void>(`/profile?slug=${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
}

export async function listProfiles(params?: {
  q?: string;
  unverified?: boolean;
  limit?: number;
}): Promise<{ ok: boolean; items: ProfileListItem[] }> {
  const search = new URLSearchParams();
  if (params?.q) search.set('q', params.q);
  if (params?.unverified) search.set('unverified', 'true');
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();

  return apiRequest<{ ok: boolean; items: ProfileListItem[] }>(`/profile/list${qs ? `?${qs}` : ''}`);
}
