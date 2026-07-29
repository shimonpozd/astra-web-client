import { authorizedFetch } from '../lib/authorizedFetch';
import { TextSegment } from '../types/text';

export type SugyaNodeType = 
  | 'Statement'
  | 'Question'
  | 'Attack'
  | 'Defense'
  | 'Proof'
  | 'Answer';

export interface SugyaNode {
  id: string;
  level: number;
  type: SugyaNodeType;
  title: string;
  ref?: string;
  start_anchor?: string;
  end_anchor?: string;
}

export interface SugyaMapData {
  sugya_title: string;
  mishnah_summary?: string;
  markdown_tree: string;
  nodes: SugyaNode[];
}

export interface SugyaMapRequest {
  ref?: string;
  segments?: Array<{
    ref: string;
    he_text?: string;
    heText?: string;
    en_text?: string;
    enText?: string;
    text?: string;
  }>;
  model?: string;
  force_recalculate?: boolean;
}

export async function calculateSugyaMap(
  ref: string, 
  segments?: TextSegment[],
  model?: string,
  forceRecalculate?: boolean
): Promise<SugyaMapData> {
  const payloadSegments = segments?.map((s) => ({
    ref: s.ref,
    he_text: s.heText || s.he_text || '',
    en_text: s.enText || s.en_text || s.text || '',
  }));

  const response = await authorizedFetch('/api/sugya/calculate-map', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ref,
      segments: payloadSegments,
      model,
      force_recalculate: forceRecalculate,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
    throw new Error(errorData.detail || `Failed to calculate sugya map (${response.status})`);
  }

  return await response.json();
}
