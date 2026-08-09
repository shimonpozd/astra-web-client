import { config } from '../config';
import { authorizedFetch } from '../lib/authorizedFetch';

export const API_BASE = config.apiBaseUrl;

export interface ApiRequestOptions extends RequestInit {
  fallback?: any;
}

export async function apiRequest<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { fallback, ...fetchOptions } = options;
  try {
    const response = await authorizedFetch(`${API_BASE}${endpoint}`, fetchOptions);
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      try {
        const json = JSON.parse(errorText);
        if (json.detail) {
          errorMessage = typeof json.detail === 'string' ? json.detail : JSON.stringify(json.detail);
        } else if (json.message) {
          errorMessage = json.message;
        }
      } catch {
        if (errorText) errorMessage = errorText;
      }
      throw new Error(errorMessage);
    }

    const text = await response.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  } catch (error) {
    if (fallback !== undefined) {
      console.warn(`apiRequest error for ${endpoint}, returning fallback:`, error);
      return fallback as T;
    }
    throw error;
  }
}
