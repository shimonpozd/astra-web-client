import type { NodeProps } from '@xyflow/react';
import { NodeResizer } from '@xyflow/react';
import styles from '../../SederMap2.module.css';

type DomainData = {
  title_he?: string;
  title_ru?: string;
  description?: string;
  isResizable?: boolean;
};

export default function DomainNode({ data, selected, dragging }: NodeProps<DomainData>) {
  return (
    <div
      className={`${styles.domainNode} ${dragging ? styles.nodeDragging : ''} ${
        selected ? styles.nodeSelected : ''
      }`}
    >
      <NodeResizer
        isVisible={Boolean(data?.isResizable && selected)}
        minWidth={400}
        minHeight={140}
        lineStyle={{ borderColor: 'rgba(14,116,144,0.45)' }}
        handleStyle={{ borderColor: 'rgba(14,116,144,0.7)', background: '#f8fafc' }}
      />
      <div className={styles.domainTitle}>
        <div className={styles.domainHe} dir="rtl">
          {data?.title_he || '—'}
        </div>
        <div className={styles.domainRu}>{data?.title_ru || '—'}</div>
      </div>
      {data?.description ? <div className={styles.domainDesc}>{data.description}</div> : null}
    </div>
  );
}
