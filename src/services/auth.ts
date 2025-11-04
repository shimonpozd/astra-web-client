import { config } from '../config';
import { authStorage, StoredUser } from '../lib/authStorage';

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: StoredUser;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await fetch(config.apiUrl('/auth/login'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  if (!response.ok) {
    const message = await response.text().catch(() => 'Invalid credentials');
    throw new Error(message || 'Failed to login');
  }

  return response.json() as Promise<LoginResponse>;
}

export function logout() {
  authStorage.clear();
}
