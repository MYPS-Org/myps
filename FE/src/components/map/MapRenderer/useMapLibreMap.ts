import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-csp-worker.js?url';
import { BASEMAPS, DEFAULT_BASEMAP, METRO_MANILA_CENTER, DEFAULT_ZOOM, type BasemapId } from './mapStyle';

// maplibre-gl's default worker is built at runtime by string-concatenating two of its
// own module factories and blob-URL-ing the result (see maplibre-gl's dist/maplibre-gl.js).
// That trick only works if those factories stay standalone — but our production minifier
// hoists/dedupes helpers those factories reference out to the surrounding chunk's module
// scope, so the extracted worker string ends up calling a helper that was never included
// in it (e.g. "ReferenceError: <mangled-name> is not defined" inside the worker), which
// silently kills all GeoJSON/vector-tile rendering while raster basemap tiles (no worker
// needed) keep working. Point at maplibre's prebuilt CSP worker bundle instead — a real,
// separately-built static asset that's never toString()-extracted from our own bundle.
maplibregl.setWorkerUrl(maplibreWorkerUrl);

export interface UseMapLibreMapResult {
  containerRef: RefObject<HTMLDivElement | null>;
  // Attach this to the OUTER wrapper div (the one that also holds our own floating widgets --
  // basemap switcher, Export PDF, Regions panel), not the inner div MapLibre itself owns.
  // FullscreenControl defaults to fullscreening the map's own container (containerRef), which
  // is a child of that wrapper -- our widgets, as SIBLINGS of containerRef rather than
  // descendants of whatever actually goes fullscreen, would otherwise vanish the moment
  // fullscreen activates (the Fullscreen API only displays the fullscreened element and its
  // descendants). Passed into FullscreenControl's own `container` option below instead.
  fullscreenContainerRef: RefObject<HTMLDivElement | null>;
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
  const fullscreenContainerRef = useRef<HTMLDivElement>(null);
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
      // Needed so canvas.toDataURL() (the PDF export button) can actually read back the
      // rendered frame -- WebGL clears its drawing buffer after each render by default (a
      // perf optimization), so without this a capture taken any time after that frame has
      // already been presented comes back blank. Small, constant cost; not opt-in per export
      // since there's no reliable way to flip it on only for the one frame being captured.
      canvasContextAttributes: { preserveDrawingBuffer: true },
      // Attribution is added explicitly below instead (compact: true) -- the default control
      // MapLibre would otherwise auto-add decides compact-vs-full by container width, and our
      // map sits in a card narrower than MapLibre's own breakpoint for that, so it was starting
      // fully expanded ("MapLibre | © OpenStreetMap contributors") rather than collapsed to
      // just the (i) icon.
      attributionControl: false,
    });

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.FullscreenControl({ container: fullscreenContainerRef.current ?? undefined }),
      'top-right'
    );
    map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
    // compact: true alone isn't enough -- MapLibre's own AttributionControl source
    // (_updateCompact, in maplibre-gl's attribution_control.ts) unconditionally force-opens
    // the very first time compact mode activates (adds the 'open' attribute and
    // maplibregl-compact-show), and only ever auto-collapses later, in response to the user
    // dragging the map. There's no public option to start collapsed, so this corrects the DOM
    // state addControl() just produced synchronously above. It only needs doing once: that
    // forcing logic is itself gated on the container NOT already having the
    // maplibregl-compact class, which it does from here on, so later style reloads (basemap
    // switches) won't force it back open.
    containerRef.current.querySelector('.maplibregl-ctrl-attrib')?.removeAttribute('open');
    containerRef.current.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');

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
    map.once('style.load', () => {
      setStyleGeneration((generation) => generation + 1);
    });
    // diff: false forces a full style reload so 'style.load' fires — the diff path
    // (default) silently strips our runtime-added project layers/sources when they're
    // absent from the target basemap style, and never fires 'style.load' to rebuild them.
    map.setStyle(BASEMAPS[id].style, { diff: false });
  }, []);

  return { containerRef, fullscreenContainerRef, mapRef, isMapReady, basemap, setBasemap, styleGeneration };
}
