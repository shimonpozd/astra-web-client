import type { NodeProps } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import styles from '../../SederMap2.module.css';

type NoteData = {
  text?: string;
  kind?: 'note' | 'label';
  color?: string;
  isDragging?: boolean;
  isSelected?: boolean;
  isResizable?: boolean;
};

export default function NoteNode({ data }: NodeProps<NoteData>) {
  return (
    <div
      className={`${styles.noteNode} ${data?.kind === 'label' ? styles.labelNode : ''} ${
        data?.isDragging ? styles.nodeDragging : ''
      } ${data?.isSelected ? styles.nodeSelected : ''}`}
      style={{ backgroundColor: data?.color || undefined }}
    >
      <NodeResizer
        isVisible={Boolean(data?.isResizable && data?.isSelected)}
        minWidth={data?.kind === 'label' ? 160 : 200}
        minHeight={data?.kind === 'label' ? 40 : 80}
        lineStyle={{ borderColor: 'rgba(99,102,241,0.45)' }}
        handleStyle={{ borderColor: 'rgba(99,102,241,0.65)', background: '#f8fafc' }}
      />
      <div className={styles.noteText}>{data?.text || '—'}</div>
    </div>
  );
}
