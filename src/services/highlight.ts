import { config } from '../config';
import { authorizedFetch } from '../lib/authorizedFetch';
import { SageHighlight, ConceptHighlight } from '../types/highlight';

const API_BASE = config.apiBaseUrl;

export async function fetchSageHighlights(): Promise<SageHighlight[]> {
  try {
    const response = await authorizedFetch(`${API_BASE}/highlight/sages`);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const data = await response.json();
    return (data?.items as SageHighlight[]) ?? [];
  } catch (err) {
    console.error('Failed to load sage highlights', err);
    return [];
  }
}

export async function fetchConceptHighlights(): Promise<ConceptHighlight[]> {
  try {
    const response = await authorizedFetch(`${API_BASE}/highlight/concepts`);
    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const data = await response.json();
    return (data?.items as ConceptHighlight[]) ?? [];
  } catch (err) {
    console.error('Failed to load concept highlights', err);
    return [];
  }
}
