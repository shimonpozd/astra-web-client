import { apiRequest } from '../client';

export interface AdminUserApiKey {
  id: string;
  provider: 'openrouter' | 'openai';
  last_four: string;
  daily_limit: number | null;
  usage_today: number;
  last_reset_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface AdminUserSummary {
  id: string;
  username: string;
  role: 'admin' | 'member';
  is_active: boolean;
  created_manually: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
  api_keys: AdminUserApiKey[];
  phone_number: string | null;
  active_session_count: number;
  total_session_count: number;
}

export interface CreateAdminUserPayload {
  username: string;
  password: string;
  role: 'admin' | 'member';
  is_active?: boolean;
}

export interface UpdateAdminUserPayload {
  password?: string;
  role?: 'admin' | 'member';
  is_active?: boolean;
}

export interface CreateApiKeyPayload {
  provider?: 'openrouter' | 'openai';
  api_key: string;
  daily_limit?: number | null;
}

export interface UpdateApiKeyPayload {
  daily_limit?: number | null;
  is_active?: boolean;
}

export interface AdminUserSession {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at: string | null;
  expires_at: string;
}

export interface AdminUserLoginEvent {
  id: string;
  username: string | null;
  success: boolean;
  reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export async function adminListUsers(): Promise<AdminUserSummary[]> {
  return apiRequest<AdminUserSummary[]>('/users');
}

export async function adminListUserSessions(userId: string): Promise<AdminUserSession[]> {
  return apiRequest<AdminUserSession[]>(`/users/${userId}/sessions`);
}

export async function adminRevokeSession(userId: string, sessionId: string): Promise<void> {
  return apiRequest<void>(`/users/${userId}/sessions/${sessionId}`, {
    method: 'DELETE',
  });
}

export async function adminListUserLoginEvents(userId: string, limit: number = 20): Promise<AdminUserLoginEvent[]> {
  return apiRequest<AdminUserLoginEvent[]>(`/users/${userId}/login-events?limit=${limit}`);
}

export async function adminCreateUser(payload: CreateAdminUserPayload): Promise<AdminUserSummary> {
  return apiRequest<AdminUserSummary>('/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...payload, created_manually: true }),
  });
}

export async function adminUpdateUser(userId: string, payload: UpdateAdminUserPayload): Promise<AdminUserSummary> {
  return apiRequest<AdminUserSummary>(`/users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminCreateUserApiKey(userId: string, payload: CreateApiKeyPayload): Promise<AdminUserApiKey> {
  return apiRequest<AdminUserApiKey>(`/users/${userId}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminUpdateUserApiKey(
  userId: string,
  keyId: string,
  payload: UpdateApiKeyPayload
): Promise<AdminUserApiKey> {
  return apiRequest<AdminUserApiKey>(`/users/${userId}/api-keys/${keyId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function adminDeleteUserApiKey(userId: string, keyId: string): Promise<void> {
  return apiRequest<void>(`/users/${userId}/api-keys/${keyId}`, {
    method: 'DELETE',
  });
}
