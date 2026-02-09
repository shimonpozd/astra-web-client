import type { LucideIcon } from 'lucide-react';

export type MapNode = {
  id: string;
  title_he?: string | null;
  title_ru?: string | null;
  node_type?: string | null;
  domain_id?: string | null;
  spine_parent_id?: string | null;
  definition_id?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
};

export type MapEdge = {
  id: string;
  source_id: string;
  target_id: string;
  connection_type?: string | null;
};

export type MapDomain = {
  id: string;
  title_he?: string | null;
  title_ru?: string | null;
  description?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  width?: number | null;
  height?: number | null;
};

export type MapNote = {
  id: string;
  kind?: 'note' | 'label' | string;
  title_ru?: string | null;
  text_ru?: string | null;
  color?: string | null;
  domain_id?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  width?: number | null;
  height?: number | null;
};

export type SelectedTarget =
  | { kind: 'node'; id: string }
  | { kind: 'note'; id: string }
  | { kind: 'domain'; id: string }
  | null;

export type InspectorForm = {
  title_he: string;
  title_ru: string;
  description: string;
  node_type: string;
  domain_id: string;
  spine_parent_id: string;
  definition_id: string;
  text: string;
  width: string;
  height: string;
};

export type NodeTypeConfig = {
  id: string;
  icon: LucideIcon;
  className: string;
};
