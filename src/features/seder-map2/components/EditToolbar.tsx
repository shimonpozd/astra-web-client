import styles from '../SederMap2.module.css';
import type { NodeTypeConfig } from '../types';

type Props = {
  isAdmin: boolean;
  editMode: boolean;
  eraseMode: boolean;
  edgeType: 'flow' | 'becomes' | 'contains' | 'reference';
  nodeTypes: NodeTypeConfig[];
  onToggleEdit: () => void;
  onToggleErase: () => void;
  onAddNode: (typeId: string) => void;
  onAddNote: (kind: 'note' | 'label') => void;
  onAddDomain: () => void;
  onEdgeTypeChange: (value: 'flow' | 'becomes' | 'contains' | 'reference') => void;
};

export default function EditToolbar({
  isAdmin,
  editMode,
  eraseMode,
  edgeType,
  nodeTypes,
  onToggleEdit,
  onToggleErase,
  onAddNode,
  onAddNote,
  onAddDomain,
  onEdgeTypeChange,
}: Props) {
  if (!isAdmin) return null;

  return (
    <div className={styles.toolbar}>
      <button type="button" className={editMode ? styles.toolbarActive : styles.toolbarButton} onClick={onToggleEdit}>
        {editMode ? 'Edit: ON' : 'Edit: OFF'}
      </button>
      <button
        type="button"
        className={eraseMode ? styles.toolbarActive : styles.toolbarButton}
        onClick={onToggleErase}
        disabled={!editMode}
      >
        Eraser
      </button>
      <div className={styles.toolbarGroup}>
        {nodeTypes.map((t) => (
          <button
            key={t.id}
            type="button"
            className={styles.toolbarButton}
            onClick={() => onAddNode(t.id)}
            disabled={!editMode}
          >
            + {t.id}
          </button>
        ))}
      </div>
      <div className={styles.toolbarGroup}>
        <button type="button" className={styles.toolbarButton} onClick={() => onAddNote('label')} disabled={!editMode}>
          + label
        </button>
        <button type="button" className={styles.toolbarButton} onClick={() => onAddNote('note')} disabled={!editMode}>
          + note
        </button>
        <button type="button" className={styles.toolbarButton} onClick={onAddDomain} disabled={!editMode}>
          + domain
        </button>
      </div>
      <div className={styles.toolbarGroup}>
        {(['flow', 'becomes', 'contains', 'reference'] as const).map((t) => (
          <button
            key={t}
            type="button"
            className={edgeType === t ? styles.toolbarActive : styles.toolbarButton}
            onClick={() => onEdgeTypeChange(t)}
            disabled={!editMode}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}
