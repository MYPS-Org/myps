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
      // We drive resize() ourselves below, off a ResizeObserver on the container — that
      // reacts to the container's actual box (sidebar reflows, fullscreen, etc.), not
      // just window resize, and avoids double-triggering against MapLibre's own tracker.
      trackResize: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(new maplibregl.FullscreenControl(), 'top-right');

    // Coalesce bursts of ResizeObserver/fullscreenchange callbacks (fired mid-drag,
    // before the surrounding layout has necessarily settled) into one resize() per
    // animation frame, by which point layout for that frame is final.
    let resizeFrame: number | null = null;
    const scheduleResize = () => {
      if (resizeFrame !== null) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        map.resize();
      });
    };

    const resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(containerRef.current);
    document.addEventListener('fullscreenchange', scheduleResize);

    const handleLoad = () => {
      setIsMapReady(true);
      setStyleGeneration((generation) => generation + 1);
    };

    map.on('load', handleLoad);

    mapRef.current = map;

    return () => {
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeObserver.disconnect();
      document.removeEventListener('fullscreenchange', scheduleResize);
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
    console.log('[map-debug] setBasemap called', id); // TEMP DEBUG
    map.once('style.load', () => {
      console.log('[map-debug] style.load fired for', id); // TEMP DEBUG
      setStyleGeneration((generation) => generation + 1);
    });
    map.setStyle(BASEMAPS[id].style);
  }, []);

  return { containerRef, mapRef, isMapReady, basemap, setBasemap, styleGeneration };
}
