import type { EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';

export default function ReferenceEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath(props);
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{ stroke: '#94a3b8', strokeWidth: 2, strokeDasharray: '2 4' }}
      />
      <EdgeLabelRenderer />
    </>
  );
}
