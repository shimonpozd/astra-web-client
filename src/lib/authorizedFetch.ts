import { config } from '../config';
import { authStorage } from './authStorage';

const ADMIN_PREFIX = '/admin';
const API_PREFIX = '/api';

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

  const headers = new Headers(init.headers ?? {});
  const token = authStorage.getToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(request, { ...init, headers });
  if (response.status === 401) {
    authStorage.notifyUnauthorized();
  }
  return response;
}
