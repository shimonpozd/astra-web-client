export interface PanelQuickAction {
  id: string;
  label: string;
  message: string;
  ref: string;
  source?: 'focus' | 'commentary';
  disabled?: boolean;
  disabledReason?: string;
}

export interface PanelActions {
  focus?: PanelQuickAction[];
  leftWorkbench?: PanelQuickAction[];
  rightWorkbench?: PanelQuickAction[];
}

export interface Persona {
  id: string;
  name: string;
  description?: string;
  systemPrompt?: string;
}
