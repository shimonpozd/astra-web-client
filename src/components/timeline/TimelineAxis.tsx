interface TimelineAxisProps {
  ticks: number[];
  yearToX: (year: number) => number;
  height?: number;
}

export function TimelineAxis({ ticks, yearToX, height = 60 }: TimelineAxisProps) {
  return (
    <g className="timeline-axis" aria-label="Временная ось">
      <line
        x1={yearToX(ticks[0] ?? 0)}
        x2={yearToX(ticks[ticks.length - 1] ?? 0)}
        y1={height}
        y2={height}
        stroke="hsl(var(--foreground))"
        strokeWidth={2}
        opacity={0.35}
      />
      {ticks.map((year) => {
        const major = year % 100 === 0;
        return (
          <g key={year}>
            <line
              x1={yearToX(year)}
              x2={yearToX(year)}
              y1={height - (major ? 18 : 10)}
              y2={height + (major ? 14 : 8)}
              stroke="hsl(var(--foreground))"
              strokeWidth={major ? 1.8 : 1}
              opacity={major ? 0.6 : 0.35}
            />
            {major && (
              <text
                x={yearToX(year)}
                y={height + 24}
                textAnchor="middle"
                className="text-[11px] font-semibold text-muted-foreground"
                fill="currentColor"
              >
                {year}
              </text>
            )}
          </g>
        );
      })}
    </g>
  );
}
