import type { EdgeProps } from '@xyflow/react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, MarkerType } from '@xyflow/react';

const EDGE_COLOR = 'hsl(var(--primary))';

export default function FlowEdge(props: EdgeProps) {
  const [edgePath] = getBezierPath(props);
  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={MarkerType.ArrowClosed}
        style={{ stroke: EDGE_COLOR, strokeWidth: 3 }}
      />
      <EdgeLabelRenderer />
    </>
  );
}
