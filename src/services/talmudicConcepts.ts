import { config } from '../config';
import { authorizedFetch } from '../lib/authorizedFetch';
import { TalmudicConcept } from '../types/highlight';

const API_BASE = config.apiBaseUrl;

export interface GenerateConceptResponse {
  short_summary_html: string;
  full_article_html: string;
  search_patterns: string[];
}

export async function listConcepts(): Promise<TalmudicConcept[]> {
  const resp = await authorizedFetch(`${API_BASE}/admin/talmudic_concepts`);
  if (!resp.ok) {
    throw new Error('Failed to load concepts');
  }
  const data = await resp.json();
  return (data?.items as TalmudicConcept[]) ?? [];
}

export async function getConcept(slug: string): Promise<TalmudicConcept> {
  const resp = await authorizedFetch(`${API_BASE}/admin/talmudic_concepts/${encodeURIComponent(slug)}`);
  if (!resp.ok) {
    throw new Error('Concept not found');
  }
  return (await resp.json()) as TalmudicConcept;
}

export async function saveConcept(concept: TalmudicConcept, opts?: { update?: boolean }): Promise<TalmudicConcept> {
  const isUpdate = opts?.update ?? false;
  const method = isUpdate ? 'PUT' : 'POST';
  const url =
    isUpdate
      ? `${API_BASE}/admin/talmudic_concepts/${encodeURIComponent(concept.slug)}`
      : `${API_BASE}/admin/talmudic_concepts`;

  const resp = await authorizedFetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(concept),
  });
  if (!resp.ok) {
    throw new Error('Failed to save concept');
  }
  return (await resp.json()) as TalmudicConcept;
}

export async function deleteConcept(slug: string): Promise<void> {
  const resp = await authorizedFetch(`${API_BASE}/admin/talmudic_concepts/${encodeURIComponent(slug)}`, {
    method: 'DELETE',
  });
  if (!resp.ok) {
    throw new Error('Failed to delete concept');
  }
}

export async function generateConceptContent(term_he: string): Promise<GenerateConceptResponse> {
  const resp = await authorizedFetch(`${API_BASE}/llm/generate-concept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ term_he }),
  });
  if (!resp.ok) {
    throw new Error('Failed to generate concept content');
  }
  return (await resp.json()) as GenerateConceptResponse;
}
