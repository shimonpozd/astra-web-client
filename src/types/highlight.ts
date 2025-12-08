export interface SageHighlight {
  slug: string;
  name_he?: string | null;
  name_ru?: string | null;
  period?: string | null;
  generation?: number | null;
  region?: string | null;
  period_label_ru?: string | null;
  lifespan?: string | null;
  regex_pattern: string;
}

export interface ConceptHighlight {
  slug: string;
  term_he?: string | null;
  search_patterns: string[];
  short_summary_html?: string | null;
}

export interface TalmudicConcept {
  slug: string;
  term_he: string;
  search_patterns: string[];
  short_summary_html?: string | null;
  full_article_html?: string | null;
  status: 'draft' | 'published';
  created_at?: string | null;
  updated_at?: string | null;
  generated_at?: string | null;
}
