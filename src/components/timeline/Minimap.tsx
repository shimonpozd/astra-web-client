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
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-card/95 backdrop-blur-md border-2 border-border/70 rounded-xl shadow-2xl px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-semibold text-foreground">Навигатор</div>
        <div className="text-[10px] text-muted-foreground">
          {Math.round(viewStart)} — {Math.round(viewEnd)}
        </div>
      </div>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="cursor-pointer"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Градиент для плотности */}
        <defs>
          <linearGradient id="densityGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#1e40af" stopOpacity="0.3" />
          </linearGradient>
        </defs>
        
        {/* Плотность персон */}
        {bins.map((v, i) => (
          <rect
            key={i}
            x={(i / bins.length) * width}
            y={height - v * (height - 24)}
            width={width / bins.length + 1}
            height={v * (height - 24)}
            fill="url(#densityGradient)"
            opacity={0.5}
            className="transition-opacity hover:opacity-70"
          />
        ))}
        
        {/* Временная шкала */}
        <line
          x1={0}
          y1={height - 2}
          x2={width}
          y2={height - 2}
          stroke="hsl(var(--border))"
          strokeWidth={1}
          opacity={0.5}
        />
        
        {/* Brush (окно просмотра) */}
        <rect
          x={brushX}
          y={2}
          width={Math.max(12, brushW)}
          height={height - 4}
          fill="rgba(59, 130, 246, 0.15)"
          stroke="#3b82f6"
          strokeWidth={2}
          rx={4}
          className="cursor-move transition-all"
          onMouseDown={() => setDragging(true)}
        />
        
        {/* Resize handles */}
        <rect
          x={brushX - 3}
          y={2}
          width={6}
          height={height - 4}
          fill="#3b82f6"
          opacity={0.6}
          className="cursor-ew-resize hover:opacity-100"
          onMouseDown={() => setResizing('left')}
          rx={2}
        />
        <rect
          x={brushX + brushW - 3}
          y={2}
          width={6}
          height={height - 4}
          fill="#3b82f6"
          opacity={0.6}
          className="cursor-ew-resize hover:opacity-100"
          onMouseDown={() => setResizing('right')}
          rx={2}
        />
      </svg>
    </div>
  );
}
