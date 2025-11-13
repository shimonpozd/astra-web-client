import type { ComposerQuickAction } from '../components/chat/MessageComposer';
import type { StudySnapshot } from '../types/study';

const normalizeRefString = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
};

const extractWorkbenchRef = (item: any): string | null => {
  if (!item) return null;
  if (typeof item === 'string') {
    return normalizeRefString(item);
  }
  if (typeof item === 'object') {
    if (typeof item.ref === 'string') {
      const normalized = normalizeRefString(item.ref);
      if (normalized) return normalized;
    }
    if (typeof item.heRef === 'string') {
      const normalized = normalizeRefString(item.heRef);
      if (normalized) return normalized;
    }
    if (typeof item.tref === 'string') {
      const normalized = normalizeRefString(item.tref);
      if (normalized) return normalized;
    }
  }
  return null;
};

interface BuildStudyQuickActionsParams {
  snapshot?: StudySnapshot | null;
  includeFocus?: boolean;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
}

export const buildStudyQuickActions = ({
  snapshot,
  includeFocus = true,
  leftPanelVisible = true,
  rightPanelVisible = true,
}: BuildStudyQuickActionsParams): ComposerQuickAction[] => {
  if (!snapshot) return [];

  const focusRef = includeFocus
    ? normalizeRefString(snapshot.discussion_focus_ref ?? snapshot.ref)
    : null;

  const leftWorkbenchRef = leftPanelVisible
    ? extractWorkbenchRef(snapshot.workbench?.left)
    : null;

  const rightWorkbenchRef = rightPanelVisible
    ? extractWorkbenchRef(snapshot.workbench?.right)
    : null;

  const actions: ComposerQuickAction[] = [];

  if (focusRef) {
    actions.push({
      id: 'focus',
      label: `Фокус: Объясни ${focusRef}`,
      message: `Объясни ${focusRef}`,
    });
  }

  if (leftWorkbenchRef) {
    actions.push({
      id: 'left_workbench',
      label: `Левая панель: Объясни ${leftWorkbenchRef}`,
      message: `Объясни ${leftWorkbenchRef}`,
    });
  }

  if (rightWorkbenchRef) {
    actions.push({
      id: 'right_workbench',
      label: `Правая панель: Объясни ${rightWorkbenchRef}`,
      message: `Объясни ${rightWorkbenchRef}`,
    });
  }

  return actions;
};

export { normalizeRefString, extractWorkbenchRef };

