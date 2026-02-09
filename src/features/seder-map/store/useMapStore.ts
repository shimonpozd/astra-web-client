import { create } from 'zustand';

export type ArticleViewMode = 'split' | 'he' | 'ru';

export type SederMapNode = {
  id: string;
  title_he?: string | null;
  title_ru?: string | null;
  article_id?: string | null;
  definition_id?: string | null;
  spine_parent_id?: string | null;
  node_type?: string | null;
  domain_id?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  width?: number | null;
  height?: number | null;
  status?: string | null;
  phase?: string | null;
};

export type SederMapEdge = {
  id: string;
  source_id: string;
  target_id: string;
  connection_type?: string | null;
};

export type SederLayout = {
  id: string;
  name?: string | null;
  is_canonical?: boolean | null;
  layout_json?: {
    nodes?: Array<{ id: string; x?: number; y?: number; width?: number; height?: number }>;
  } | null;
};

export type SederDomain = {
  id: string;
  title_he?: string | null;
  title_ru?: string | null;
  description?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  width?: number | null;
  height?: number | null;
};

export type SederMapNote = {
  id: string;
  kind?: 'note' | 'label' | string;
  title_he?: string | null;
  title_ru?: string | null;
  text_he?: string | null;
  text_ru?: string | null;
  color?: string | null;
  domain_id?: string | null;
  attached_node_id?: string | null;
  attached_edge_id?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  width?: number | null;
  height?: number | null;
};

export type EditFormState = {
  title_he: string;
  title_ru: string;
  node_type: string;
  phase: string;
  definition_id: string;
  spine_parent_id: string;
  domain_id: string;
};

export type MapStoreState = {
  loading: boolean;
  error: string | null;
  nodesData: SederMapNode[];
  edgesData: SederMapEdge[];
  notesData: SederMapNote[];
  domains: SederDomain[];
  layouts: SederLayout[];
  activeLayoutId: string | null;
  editMode: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  selectedDomainId: string | null;
  selectedNoteId: string | null;
  canvasCenter?: { x: number; y: number } | null;
  selectedEdgeType: 'flow' | 'becomes' | 'contains' | 'reference';
  article: any | null;
  segments: any[] | null;
  articleLoading: boolean;
  articleError: string | null;
  articleView: ArticleViewMode;
  editNodeOpen: boolean;
  editForm: EditFormState;
  showAdvanced: boolean;
  savingLayout: boolean;
  layoutError: string | null;
  flowNodes: any[];
  setState: (patch: Partial<MapStoreState>) => void;
};

export const useMapStore = create<MapStoreState>((set) => ({
  loading: true,
  error: null,
  nodesData: [],
  edgesData: [],
  notesData: [],
  domains: [],
  layouts: [],
  activeLayoutId: null,
  editMode: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  selectedDomainId: null,
  selectedNoteId: null,
  canvasCenter: null,
  selectedEdgeType: 'flow',
  article: null,
  segments: null,
  articleLoading: false,
  articleError: null,
  articleView: 'split',
  editNodeOpen: false,
  editForm: {
    title_he: '',
    title_ru: '',
    node_type: 'stage',
    phase: '',
    definition_id: '',
    spine_parent_id: '',
    domain_id: '',
  },
  showAdvanced: false,
  savingLayout: false,
  layoutError: null,
  flowNodes: [],
  setState: (patch) => set(patch),
}));
