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

export async function addSageMapping(sageSlug: string, rawText: string): Promise<boolean> {
  try {
    const response = await authorizedFetch(`${API_BASE}/highlight/sages/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sage_slug: sageSlug, raw_text: rawText }),
    });
    return response.ok;
  } catch (err) {
    console.error('Failed to add sage mapping', err);
    return false;
  }
}

export async function createSageProfile(data: {
  name: string;
  period?: string;
  period_ru?: string;
  region?: string;
  generation?: number;
}): Promise<{ ok: boolean; slug?: string; error?: string }> {
  try {
    const response = await authorizedFetch(`${API_BASE}/profile/author_only`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: data.name,
        period: data.period || 'amoraim',
        period_ru: data.period_ru,
        region: data.region,
        generation: data.generation,
      }),
    });
    const result = await response.json();
    return result;
  } catch (err: any) {
    console.error('Failed to create sage profile', err);
    return { ok: false, error: err?.message || 'Failed to create sage profile' };
  }
}

export async function addCustomConcept(termHe: string, pattern: string, shortSummaryHtml?: string, slug?: string): Promise<boolean> {
  try {
    const response = await authorizedFetch(`${API_BASE}/highlight/concepts/custom`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        term_he: termHe,
        pattern: pattern,
        short_summary_html: shortSummaryHtml,
        slug: slug,
      }),
    });
    return response.ok;
  } catch (err) {
    console.error('Failed to add custom concept', err);
    return false;
  }
}

export async function addConceptMapping(conceptSlug: string, rawText: string): Promise<boolean> {
  try {
    const response = await authorizedFetch(`${API_BASE}/highlight/concepts/mapping`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ concept_slug: conceptSlug, raw_text: rawText }),
    });
    return response.ok;
  } catch (err) {
    console.error('Failed to add concept mapping', err);
    return false;
  }
}


