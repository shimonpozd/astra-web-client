import { useMemo, useRef, useState, type MouseEvent } from 'react';
import { TimelinePerson } from '@/types/timeline';

interface MinimapProps {
  people: TimelinePerson[];
  minYear: number;
  maxYear: number;
  viewStart: number;
  viewEnd: number;
  onBrush: (start: number, end: number) => void;
}

export function Minimap({ people, minYear, maxYear, viewStart, viewEnd, onBrush }: MinimapProps) {
  const width = 320;
  const height = 90;
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<'left' | 'right' | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const bins = useMemo(() => {
    const binCount = 100;
    const binSize = (maxYear - minYear) / binCount;
    const arr = new Array(binCount).fill(0);
    people.forEach((p) => {
      const year = p.birthYear ?? p.lifespan_range?.start ?? p.flouritYear ?? minYear;
      const idx = Math.min(binCount - 1, Math.max(0, Math.floor((year - minYear) / binSize)));
      arr[idx] += 1;
    });
    const maxVal = Math.max(1, ...arr);
    return arr.map((v) => v / maxVal);
  }, [people, minYear, maxYear]);

  const xScale = (year: number) => ((year - minYear) / (maxYear - minYear)) * width;
  const brushX = xScale(viewStart);
  const brushW = xScale(viewEnd) - xScale(viewStart);

  const handleMouseMove = (e: MouseEvent<SVGSVGElement>) => {
    if (!dragging && !resizing) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (e.clientX - rect.left) / width;
    const windowSize = viewEnd - viewStart;
    if (resizing === 'left') {
      const newStart = minYear + ratio * (maxYear - minYear);
      onBrush(Math.min(newStart, viewEnd - 1), viewEnd);
    } else if (resizing === 'right') {
      const newEnd = minYear + ratio * (maxYear - minYear);
      onBrush(viewStart, Math.max(newEnd, viewStart + 1));
    } else {
      const start = minYear + ratio * (maxYear - minYear) - windowSize / 2;
      onBrush(start, start + windowSize);
    }
  };

  const handleMouseUp = () => {
    setDragging(false);
    setResizing(null);
  };

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card/90 backdrop-blur-md border border-border/60 rounded-xl shadow-xl px-3 py-2">
      <div className="text-[11px] text-muted-foreground mb-1">Навигатор</div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {bins.map((v, i) => (
          <rect
            key={i}
            x={(i / bins.length) * width}
            y={height - v * (height - 20)}
            width={width / bins.length + 1}
            height={v * (height - 20)}
            fill="#64748b"
            opacity={0.35}
          />
        ))}
        <rect
          x={brushX}
          y={0}
          width={Math.max(12, brushW)}
          height={height}
          fill="rgba(56,189,248,0.12)"
          stroke="#0ea5e9"
          strokeWidth={1.4}
          rx={4}
          onMouseDown={() => setDragging(true)}
        />
        {/* Resize handles */}
        <rect
          x={brushX - 4}
          y={0}
          width={8}
          height={height}
          fill="transparent"
          onMouseDown={() => setResizing('left')}
        />
        <rect
          x={brushX + brushW - 4}
          y={0}
          width={8}
          height={height}
          fill="transparent"
          onMouseDown={() => setResizing('right')}
        />
      </svg>
    </div>
  );
}
