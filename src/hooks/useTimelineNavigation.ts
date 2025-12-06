import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface Transform {
  scale: number;
  x: number;
  y: number;
}

interface NavigationOptions {
  minScale?: number;
  maxScale?: number;
  bounds?: { minX?: number; maxX?: number; minY?: number; maxY?: number };
}

interface NavigationAPI {
  transform: Transform;
  panBy: (dx: number, dy: number, inertia?: { vx: number; vy: number }) => void;
  zoomAt: (point: { x: number; y: number }, factor: number) => void;
  applyViewport: (
    startYear: number,
    endYear: number,
    minYear: number,
    basePxPerYear: number,
    viewportWidthPx: number,
  ) => void;
  flyTo: (x: number, y: number, scale?: number) => void;
}

export function useTimelineNavigation(options: NavigationOptions = {}): NavigationAPI {
  const { minScale = 0.4, maxScale = 4, bounds } = options;
  const [transform, setTransform] = useState<Transform>({ scale: 1, x: 0, y: 0 });
  const velocity = useRef({ vx: 0, vy: 0 });
  const rafRef = useRef<number | null>(null);

  const clampScale = useCallback(
    (s: number) => Math.min(maxScale, Math.max(minScale, s)),
    [maxScale, minScale],
  );

  const clampPos = useCallback(
    (x: number, y: number, scale: number) => {
      const clampedX = bounds
        ? Math.min(bounds.maxX ?? Infinity, Math.max(bounds.minX ?? -Infinity, x))
        : x;
      const clampedY = bounds
        ? Math.min(bounds.maxY ?? Infinity, Math.max(bounds.minY ?? -Infinity, y))
        : y;
      return { x: clampedX, y: clampedY, scale };
    },
    [bounds],
  );

  const panBy = useCallback(
    (dx: number, dy: number, inertia?: { vx: number; vy: number }) => {
      setTransform((prev) => clampPos(prev.x + dx, prev.y + dy, prev.scale));
      if (inertia) {
        velocity.current = { vx: inertia.vx, vy: inertia.vy };
      }
    },
    [clampPos],
  );

  const zoomAt = useCallback(
    (point: { x: number; y: number }, factor: number) => {
      setTransform((prev) => {
        const nextScale = clampScale(prev.scale * factor);
        const scaleDelta = nextScale / prev.scale;
        const nx = point.x - (point.x - prev.x) * scaleDelta;
        const ny = point.y - (point.y - prev.y) * scaleDelta;
        return clampPos(nx, ny, nextScale);
      });
    },
    [clampPos, clampScale],
  );

  const flyTo = useCallback(
    (x: number, y: number, scale?: number) => {
      setTransform((prev) => clampPos(x, y, clampScale(scale ?? prev.scale)));
    },
    [clampPos, clampScale],
  );

  const applyViewport = useCallback(
    (
      startYear: number,
      endYear: number,
      minYear: number,
      basePxPerYear: number,
      viewportWidthPx: number,
    ) => {
      const yearsVisible = Math.max(1, endYear - startYear);
      const desiredScale = clampScale(viewportWidthPx / (yearsVisible * basePxPerYear));
      const desiredX = -(startYear - minYear) * basePxPerYear * desiredScale;
      setTransform((prev) => clampPos(desiredX, prev.y, desiredScale));
    },
    [clampPos, clampScale],
  );

  // inertia
  useEffect(() => {
    const step = () => {
      velocity.current.vx *= 0.92;
      velocity.current.vy *= 0.92;
      if (Math.abs(velocity.current.vx) < 0.05 && Math.abs(velocity.current.vy) < 0.05) {
        rafRef.current = null;
        return;
      }
      setTransform((prev) => clampPos(prev.x + velocity.current.vx, prev.y + velocity.current.vy, prev.scale));
      rafRef.current = requestAnimationFrame(step);
    };
    if (velocity.current.vx !== 0 || velocity.current.vy !== 0) {
      if (!rafRef.current) rafRef.current = requestAnimationFrame(step);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [clampPos, transform]);

  return useMemo(
    () => ({
      transform,
      panBy,
      zoomAt,
      applyViewport,
      flyTo,
    }),
    [transform, panBy, zoomAt, applyViewport, flyTo],
  );
}
