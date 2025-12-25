export type YiddishPosTag =
  | 'NOUN'
  | 'VERB'
  | 'ADJ'
  | 'ADV'
  | 'PRON'
  | 'PREP'
  | 'CONJ'
  | 'PART'
  | 'DET'
  | 'HEB_LOAN';

export interface YiddishSichaMeta {
  work: string;
  volume: number;
  parsha: string;
  section: string;
  lang: 'yi';
}

export interface YiddishSichaListItem {
  id: string;
  title: string;
  meta: YiddishSichaMeta;
  progress_read_pct?: number;
  progress_vocab?: number;
  last_opened_ts?: number | string | null;
}

export interface YiddishParagraph {
  pid: string;
  text: string;
}

export interface YiddishToken {
  pid: string;
  start: number;
  end: number;
  surface: string;
  lemma: string;
  pos: YiddishPosTag;
  confidence?: number;
  learned?: boolean;
}

export interface YiddishNote {
  note_id: string;
  anchor: {
    pid: string;
    start: number;
    end: number;
    quote?: string;
  };
  type: string;
  content_html: string;
}

export interface YiddishSichaResponse {
  id: string;
  meta: YiddishSichaMeta;
  paragraphs: YiddishParagraph[];
  ru_paragraphs?: YiddishParagraph[];
  ru_available?: boolean;
  tokens: YiddishToken[];
  notes?: YiddishNote[];
  learned_map?: Record<string, string[]>;
  offsets_version?: string | number;
}

export interface YiddishSense {
  sense_id: string;
  gloss_ru: string;
  examples?: string[];
}

export interface YiddishVocabEntry {
  lemma: string;
  pos: YiddishPosTag;
  senses: YiddishSense[];
  attestations?: Array<{
    pid: string;
    surface: string;
    sense_id: string;
    start?: number;
    end?: number;
  }>;
}

export interface YiddishAttestationRequest {
  lemma: string;
  sense_id: string;
  pid: string;
  surface: string;
  start: number;
  end: number;
  context_sentence?: string;
}

export interface YiddishAttestationResponse {
  ok: boolean;
  learned: boolean;
}

export interface YiddishQueueEntry {
  lemma: string;
  sense_id: string;
  source_pid?: string;
}

export interface YiddishQueueUpdateRequest extends YiddishQueueEntry {
  action: 'add' | 'remove';
}

export interface YiddishQueueUpdateResponse {
  ok: boolean;
  queue: YiddishQueueEntry[];
}

export type YiddishExerciseType = 'cloze' | 'matching' | 'sense_choice';

export interface YiddishExamItem {
  type: YiddishExerciseType;
  payload: unknown;
}

export interface YiddishExamStartResponse {
  exam_id: string;
  items: YiddishExamItem[];
}

export interface YiddishTtsRequest {
  text: string;
  lang: 'yi';
  preferred_engine?: 'google' | 'espeak';
}

export interface YiddishTtsResponse {
  url: string;
  engine_used: 'google' | 'espeak' | 'none';
}

export interface YiddishWordCardSenseExample {
  yi: string;
  ru: string;
}

export interface YiddishWordCardSense {
  sense_id: string;
  gloss_ru_short: string;
  gloss_ru_full: string;
  usage_hints_ru?: string[];
  source_gloss_en: string;
  examples?: YiddishWordCardSenseExample[];
  confidence?: number;
}

export interface YiddishWordCard {
  schema: 'astra.yiddish.wordcard.v1';
  lang: 'yi';
  ui_lang: 'ru';
  word_surface: string;
  lemma: string;
  translit_ru: string;
  pos_default?: string | null;
  pos_ru_short?: string;
  pos_ru_full?: string;
  popup: {
    gloss_ru_short_list: string[];
  };
  senses: YiddishWordCardSense[];
  grammar?: {
    noun?: { gender?: string; plural?: string | null } | null;
    verb?: { infinitive?: string } | null;
    adj?: Record<string, string> | null;
  };
  etymology?: {
    present?: boolean;
    path?: Array<{ lang: string; term: string }>;
    summary_ru?: string;
    source_etymology_en?: string;
  };
  sources?: Array<{
    type: string;
    site?: string;
    title?: string;
    retrieved_at?: string;
  }>;
  flags?: {
    needs_review?: boolean;
    evidence_missing?: boolean;
  };
  morphology?: {
    prefixes?: Array<{ form: string; meaning_ru: string }>;
    suffixes?: Array<{ form: string; meaning_ru: string }>;
    base_lemma?: string;
    summary_ru?: string;
  } | null;
  version: number;
  _debug?: {
    evidence?: unknown;
    llm_output?: unknown;
  };
}
