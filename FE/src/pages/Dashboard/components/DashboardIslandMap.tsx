import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { RegionBudget } from './dashboardRegions';
import { useRegionBoundaries } from './useRegionBoundaries';

export type MapArea = 'All' | 'Luzon' | 'NCR' | 'Northern Luzon' | 'Southern Luzon' | 'Visayas' | 'Mindanao';

// View extents, not administrative boundaries. Include Palawan in Southern Luzon
// and the Sulu archipelago in Mindanao.
const areas: Record<MapArea, { bounds: L.LatLngBoundsExpression; center: L.LatLngExpression; color: string }> = {
  All: { bounds: [[4.4, 116.8], [21.3, 127]], center: [12.8, 122], color: '#334155' },
  Luzon: { bounds: [[7.7, 116.8], [21.3, 124.5]], center: [16, 121], color: '#0284c7' },
  NCR: { bounds: [[14.33, 120.88], [14.8, 121.15]], center: [14.6, 120.98], color: '#0369a1' },
  'Northern Luzon': { bounds: [[14.7, 119.7], [21.3, 122.6]], center: [17.2, 121.1], color: '#0284c7' },
  'Southern Luzon': { bounds: [[7.7, 116.8], [14.9, 124.5]], center: [13.2, 121.7], color: '#0284c7' },
  Visayas: { bounds: [[9, 121.8], [12.9, 126.2]], center: [11.1, 123.6], color: '#2e7d32' },
  Mindanao: { bounds: [[4.4, 119.3], [10.6, 126.7]], center: [7.7, 124.7], color: '#d81b60' },
};

interface Props {
  area: MapArea;
  onSelect: (area: MapArea) => void;
  onEnlarge?: () => void;
  enlarged?: boolean;
  regions: RegionBudget[];
  selectedRegion: string | null;
  selectionVersion: number;
  onRegionSelect: (name: string) => void;
}

export default function DashboardIslandMap({ area, onSelect, onEnlarge, enlarged = false, regions, selectedRegion, selectionVersion, onRegionSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const selectRef = useRef(onSelect);
  const [tileError, setTileError] = useState(false);
  useEffect(() => { selectRef.current = onSelect; }, [onSelect]);

  useEffect(() => {
    if (!container.current) return;
    const map = L.map(container.current, { scrollWheelZoom: false, minZoom: 4, maxZoom: 18, zoomSnap: 0.25 });
    mapRef.current = map;
    map.fitBounds(areas.All.bounds, { padding: [35, 45] });
    // A neutral basemap without the offshore outlines baked into OSM Standard.
    const tiles = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
      // This service guarantees worldwide coverage through level 13.
      maxNativeZoom: 13,
      attribution: 'Tiles &copy; <a href="https://www.esri.com">Esri</a>, HERE, Garmin, &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, and the GIS user community',
    }).addTo(map);
    tiles.on('tileerror', () => setTileError(true));
    tiles.on('tileload', () => setTileError(false));
    for (const name of ['NCR', 'Northern Luzon', 'Southern Luzon', 'Visayas', 'Mindanao'] as const) {
      const region = areas[name];
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = name;
      button.title = `Zoom to ${name}`;
      button.style.cssText = `background:${region.color};color:white;border:2px solid white;border-radius:16px;padding:5px 9px;font:700 11px/16px sans-serif;white-space:nowrap;box-shadow:0 2px 8px #0004;cursor:pointer`;
      button.addEventListener('click', () => selectRef.current(name));
      L.DomEvent.disableClickPropagation(button);
      L.marker(region.center, {
        icon: L.divIcon({ html: button, className: '', iconSize: [120, 30], iconAnchor: [60, 15] }),
        keyboard: false,
      }).addTo(map);
    }
    const observer = new ResizeObserver(() => map.invalidateSize({ pan: false }));
    observer.observe(container.current);
    return () => { observer.disconnect(); map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || selectedRegion) return;
    map.stop();
    const options = { padding: [35, 45] as L.PointTuple, maxZoom: area === 'NCR' ? 12 : 8, duration: 1.2 };
    if (!map.getZoom() || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      map.fitBounds(areas[area].bounds, options);
    } else {
      map.flyToBounds(areas[area].bounds, options);
    }
  }, [area, selectedRegion]);

  const { boundaryError, retryBoundaries } = useRegionBoundaries(mapRef, regions, selectedRegion, area, selectionVersion, onRegionSelect);

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-cyan-300/40 bg-slate-900">
      <div className="flex flex-wrap items-center gap-2 p-3 text-xs text-white">
        <span className="mr-auto font-bold" aria-live="polite">{selectedRegion ?? (area === 'All' ? 'Philippines' : area)}</span>
        <button type="button" className="rounded-lg bg-white/15 px-3 py-2 hover:bg-white/25" onClick={() => {
          onSelect('All');
          mapRef.current?.stop().flyToBounds(areas.All.bounds, { padding: [35, 45], duration: 1.2, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches });
        }}>All Philippines</button>
        {onEnlarge && <button type="button" className="rounded-lg bg-cyan-700 px-3 py-2 hover:bg-cyan-600" onClick={onEnlarge}>Enlarge</button>}
      </div>
      <div ref={container} role="region" aria-label="Interactive Philippines island group map" className="relative z-0 w-full bg-sky-100" style={{ height: enlarged ? '60vh' : '560px', minHeight: 360 }} />
      {boundaryError && <p role="status" className="px-3 py-2 text-xs text-amber-200">Region shapes could not load. <button type="button" onClick={retryBoundaries} className="underline">Retry</button></p>}
      {tileError && <p role="status" className="px-3 py-2 text-xs text-amber-200">Map tiles could not load. Check your connection. Area selection remains available.</p>}
      <p className="px-3 py-2 text-center text-xs text-slate-300">Click a region to see its budget share. Drag to pan; use + / − to zoom.</p>
    </div>
  );
}
