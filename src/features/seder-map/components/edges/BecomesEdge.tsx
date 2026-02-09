import type { EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';

export default function BecomesEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath(props);
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{ stroke: '#f97316', strokeWidth: 3 }}
      />
      <EdgeLabelRenderer />
    </>
  );
}
