import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { Tag } from 'lucide-react';
import styles from '../../SederMap2.module.css';
import type { NodeTypeConfig } from '../../types';

type SederNodeData = {
  title_he?: string;
  title_ru?: string;
  node_type?: string;
  isDragging?: boolean;
  isSelected?: boolean;
};

type Props = NodeProps<SederNodeData> & {
  nodeTypeMap: Map<string, NodeTypeConfig>;
};

export default function SederNode({ data, nodeTypeMap }: Props) {
  const nodeType = data?.node_type || 'concept';
  const config = nodeTypeMap.get(nodeType) ?? nodeTypeMap.get('concept');
  const Icon = config?.icon ?? Tag;

  return (
    <div
      className={`${styles.node} ${config ? styles[config.className] : ''} ${
        data?.isDragging ? styles.nodeDragging : ''
      } ${data?.isSelected ? styles.nodeSelected : ''}`}
    >
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.nodeIcon}>
        <Icon size={16} strokeWidth={2} />
      </div>
      <div className={styles.nodeText}>
        <div className={styles.nodeHe} dir="rtl">
          {data?.title_he || '—'}
        </div>
        <div className={styles.nodeRu}>{data?.title_ru || '—'}</div>
      </div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}
