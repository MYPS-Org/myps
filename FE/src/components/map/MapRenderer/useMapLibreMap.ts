import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import { BASEMAPS, DEFAULT_BASEMAP, METRO_MANILA_CENTER, DEFAULT_ZOOM, type BasemapId } from './mapStyle';

export interface UseMapLibreMapResult {
  containerRef: RefObject<HTMLDivElement | null>;
  mapRef: RefObject<maplibregl.Map | null>;
  isMapReady: boolean;
  basemap: BasemapId;
  setBasemap: (id: BasemapId) => void;
  // Bumped every time the map's style (re)loads, so consumers that add their own
  // sources/layers know when to recreate them after a basemap switch wipes the style.
  styleGeneration: number;
}

export function useMapLibreMap(): UseMapLibreMapResult {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [isMapReady, setIsMapReady] = useState(false);
  const [basemap, setBasemapState] = useState<BasemapId>(DEFAULT_BASEMAP);
  const [styleGeneration, setStyleGeneration] = useState(0);

  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: BASEMAPS[DEFAULT_BASEMAP].style,
      center: METRO_MANILA_CENTER,
      zoom: DEFAULT_ZOOM,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    const handleResize = () => map.resize();
    const handleLoad = () => {
      setIsMapReady(true);
      setStyleGeneration((generation) => generation + 1);
    };

    map.on('load', handleLoad);
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
      setStyleGeneration(0);
    };
  }, []);

  const setBasemap = useCallback((id: BasemapId) => {
    const map = mapRef.current;
    if (!map) return;

    setBasemapState(id);
    map.once('style.load', () => setStyleGeneration((generation) => generation + 1));
    map.setStyle(BASEMAPS[id].style);
  }, []);

  return { containerRef, mapRef, isMapReady, basemap, setBasemap, styleGeneration };
}
