import { useEffect, useRef, useState } from 'react';
import { useSkyData } from './useSkyData';
import { SolarSystemWidget } from './SolarSystemWidget';
import { SkyViewer } from './SkyViewer';
import { HoverInfo } from './types';

export function SkyPanorama({
  lat,
  lon,
  elevation = 0,
  timestamp,
  showTwilightHint = true,
}: {
  lat: number;
  lon: number;
  elevation?: number;
  timestamp: Date;
  showTwilightHint?: boolean;
}) {
  const data = useSkyData({ lat, lon, elevation, timestamp });
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);
  const hoverPlanet = hoverInfo?.kind === 'planet' ? hoverInfo.name : null;
  const skyRef = useRef<HTMLDivElement | null>(null);
  const [skyHeight, setSkyHeight] = useState(0);
  const [isRowLayout, setIsRowLayout] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(min-width: 768px)');
    const update = () => setIsRowLayout(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!skyRef.current || !isRowLayout) return;
    const obs = new ResizeObserver((entries) => {
      const { height } = entries[0].contentRect;
      setSkyHeight(height);
    });
    obs.observe(skyRef.current);
    return () => obs.disconnect();
  }, [isRowLayout]);

  return (
    <div className="flex flex-col gap-4 h-full md:flex-row">
      <SolarSystemWidget
        hoverPlanet={hoverPlanet}
        observerLat={lat}
        observerLon={lon}
        className="flex-none self-start md:self-stretch"
        style={isRowLayout && skyHeight ? { width: skyHeight, height: skyHeight } : undefined}
      />
      <div ref={skyRef} className="flex-1 min-h-0 h-full">
        <SkyViewer
          data={data}
          hoverInfo={hoverInfo}
          onHoverChange={setHoverInfo}
          showTwilightHint={showTwilightHint}
        />
      </div>
    </div>
  );
}
