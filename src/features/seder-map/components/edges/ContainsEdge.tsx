import type { EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';

export default function ContainsEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath(props);
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{ stroke: '#64748b', strokeWidth: 2.5, strokeDasharray: '6 4' }}
      />
      <EdgeLabelRenderer />
    </>
  );
}
