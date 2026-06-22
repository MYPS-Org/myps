import { useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { BASEMAP_STYLE, METRO_MANILA_CENTER, DEFAULT_ZOOM } from './mapStyle';

export interface UseMapLibreMapResult {
  containerRef: RefObject<HTMLDivElement | null>;
  mapRef: RefObject<maplibregl.Map | null>;
  isMapReady: boolean;
}

export function useMapLibreMap(): UseMapLibreMapResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAP_STYLE,
      center: METRO_MANILA_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    const handleResize = () => map.resize();

    map.on('load', () => setIsMapReady(true));
    map.on('resize', handleResize);
    document.addEventListener('fullscreenchange', handleResize);
    window.addEventListener('resize', handleResize);

    mapRef.current = map;

    return () => {
      document.removeEventListener('fullscreenchange', handleResize);
      window.removeEventListener('resize', handleResize);
      map.remove();
      mapRef.current = null;
      setIsMapReady(false);
    };
  }, []);

  return { containerRef, mapRef, isMapReady };
}
