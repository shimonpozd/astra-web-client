import { config } from '../config';
import { authStorage } from './authStorage';
import { LoginResponse, refreshSession } from '../services/auth';

const ADMIN_PREFIX = '/admin';
const API_PREFIX = '/api';

let refreshPromise: Promise<LoginResponse> | null = null;

async function ensureFreshToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshSession().finally(() => {
      refreshPromise = null;
    });
  }
  const data = await refreshPromise;
  authStorage.setToken(data.access_token);
  authStorage.setUser(data.user);
  return data.access_token;
}

function buildHeaders(base: HeadersInit, token: string | null): Headers {
  const headers = new Headers(base);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return headers;
}

export async function authorizedFetch(input: RequestInfo, init: RequestInit = {}) {
  let request: RequestInfo = input;
  if (typeof input === 'string') {
    if (input.startsWith(ADMIN_PREFIX)) {
      request = config.adminUrl(input.slice(ADMIN_PREFIX.length) || '/');
    } else if (input.startsWith(API_PREFIX)) {
      request = config.apiUrl(input.slice(API_PREFIX.length) || '/');
    } else if (input.startsWith('/')) {
      request = config.apiUrl(input);
    }
  }

  const baseHeaders = init.headers ?? {};
  const token = authStorage.getToken();
  const doFetch = (headers: Headers) => fetch(request, { ...init, headers });

  let response = await doFetch(buildHeaders(baseHeaders, token));
  if (response.status === 401) {
    try {
      const freshToken = await ensureFreshToken();
      response = await doFetch(buildHeaders(baseHeaders, freshToken));
      if (response.status === 401) {
        authStorage.notifyUnauthorized();
      }
    } catch (error) {
      authStorage.notifyUnauthorized();
    }
  }
  return response;
}
