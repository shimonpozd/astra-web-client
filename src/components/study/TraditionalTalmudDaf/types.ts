import { SageHighlight, ConceptHighlight } from '../../../types/highlight';

export interface TraditionalComment {
  ref: string;
  anchorRef: string;
  commentator: string;
  he: string;
  en: string;
  dh?: string;
}

export type CompiledSageHighlight = SageHighlight & { regex: RegExp };
export type CompiledConceptHighlight = ConceptHighlight & { regexes: RegExp[] };

export interface TextToken {
  clean: string;
  stem: string;
  startHtml: number;
  endHtml: number;
}

export interface TraditionalTalmudDafProps {
  dafRef: string;
  segments: any[];
  onSegmentClick?: (ref: string) => void;
  onLexiconDoubleClick?: (word: string, context?: string) => void;
  sageHighlights?: SageHighlight[];
  conceptHighlights?: ConceptHighlight[];
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onDafChange?: (nextDafRef: string) => void;
  isAdmin?: boolean;
}

export interface ReaderCategoryConfig {
  loadCommentaryBy: 'daf' | 'segment';
  useTraditionalScript: boolean;
}

export const READER_CONFIG: Record<string, ReaderCategoryConfig> = {
  talmud: {
    loadCommentaryBy: 'daf',
    useTraditionalScript: true,
  },
  tanakh: {
    loadCommentaryBy: 'segment',
    useTraditionalScript: false,
  },
  shulchan_arukh_oc: {
    loadCommentaryBy: 'segment',
    useTraditionalScript: false,
  },
  shulchan_arukh_yd: {
    loadCommentaryBy: 'segment',
    useTraditionalScript: false,
  },
  rambam: {
    loadCommentaryBy: 'segment',
    useTraditionalScript: false,
  },
  default: {
    loadCommentaryBy: 'segment',
    useTraditionalScript: false,
  },
};
