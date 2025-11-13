import { config } from '../config';
import { authStorage, StoredUser } from '../lib/authStorage';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: StoredUser;
}

export interface RegisterPayload {
  username: string;
  password: string;
  phone_number?: string;
}

const JSON_HEADERS = {
  'Content-Type': 'application/json',
};

async function parseLoginResponse(response: Response): Promise<LoginResponse> {
  if (!response.ok) {
    const message = await response.text().catch(() => 'Authentication failed');
    throw new Error(message || 'Authentication failed');
  }
  return response.json() as Promise<LoginResponse>;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(config.apiUrl('/auth/login'), {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  return parseLoginResponse(response);
}

export async function register(payload: RegisterPayload): Promise<LoginResponse> {
  const response = await fetch(config.apiUrl('/auth/register'), {
    method: 'POST',
    headers: JSON_HEADERS,
    credentials: 'include',
    body: JSON.stringify(payload),
  });
  return parseLoginResponse(response);
}

export async function refreshSession(): Promise<LoginResponse> {
  const response = await fetch(config.apiUrl('/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
  });
  return parseLoginResponse(response);
}

export async function logout(): Promise<void> {
  await fetch(config.apiUrl('/auth/logout'), {
    method: 'POST',
    credentials: 'include',
  }).catch(() => undefined);
  authStorage.clear();
}
