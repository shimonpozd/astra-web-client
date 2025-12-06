import type { PanelActions, PanelQuickAction } from '../types/chat';
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

const buildAction = (id: string, message: string, ref: string, source: PanelQuickAction['source']) => ({
  id,
  label: 'Объясни',
  message,
  ref,
  source,
});

export const buildStudyQuickActions = ({
  snapshot,
  includeFocus = true,
  leftPanelVisible = true,
  rightPanelVisible = true,
}: BuildStudyQuickActionsParams): PanelActions => {
  if (!snapshot) return {};

  const focusRef = includeFocus
    ? normalizeRefString(snapshot.discussion_focus_ref ?? snapshot.ref)
    : null;

  const leftWorkbenchRef = leftPanelVisible
    ? extractWorkbenchRef(snapshot.workbench?.left)
    : null;

  const rightWorkbenchRef = rightPanelVisible
    ? extractWorkbenchRef(snapshot.workbench?.right)
    : null;

  const actions: PanelActions = {};

  if (focusRef) {
    actions.focus = [
      buildAction('focus-explain', `Объясни выделенный текст: ${focusRef}`, focusRef, 'focus'),
    ];
  }

  if (leftWorkbenchRef) {
    actions.leftWorkbench = [
      buildAction(
        'left-explain',
        `Объясни комментарий: ${leftWorkbenchRef}`,
        leftWorkbenchRef,
        'commentary',
      ),
    ];
  }

  if (rightWorkbenchRef) {
    actions.rightWorkbench = [
      buildAction(
        'right-explain',
        `Объясни комментарий: ${rightWorkbenchRef}`,
        rightWorkbenchRef,
        'commentary',
      ),
    ];
  }

  return actions;
};

export { normalizeRefString, extractWorkbenchRef };


