import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import L from 'leaflet';
import type { FeatureCollection } from 'geojson';
import { regionGroup, regionKey, regionMatchesSelection, type RegionBudget } from './dashboardRegions';
import './dashboardRegions.css';

export function useRegionBoundaries(mapRef: RefObject<L.Map | null>, budgets: RegionBudget[], selected: string | null, area: string, selectionVersion: number, onSelect: (name: string) => void) {
  const [data, setData] = useState<FeatureCollection | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const layers = useRef(new Map<string, L.Polygon>());
  const callback = useRef(onSelect);
  useEffect(() => { callback.current = onSelect; }, [onSelect]);

  useEffect(() => {
    const abort = new AbortController();
    setError(false);
    fetch('/assets/maps/philippines-regions.json', { signal: abort.signal })
      .then(response => { if (!response.ok) throw new Error('Boundary load failed'); return response.json(); })
      .then((json: FeatureCollection) => {
        if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw new Error('Invalid boundaries');
        setData(json);
      })
      .catch(() => { if (!abort.signal.aborted) setError(true); });
    return () => abort.abort();
  }, [retry]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !data) return;
    const regionLayers = layers.current;
    const group = L.geoJSON(data, {
      style: { color: '#64748b', weight: 1.2, fillColor: '#38bdf8', fillOpacity: 0.12, className: 'dashboard-region-shape' },
      onEachFeature: (feature, layer) => {
        const name = String(feature.properties?.adm1_en ?? '');
        const key = regionKey(name);
        const polygon = layer as L.Polygon;
        regionLayers.set(key, polygon);
        polygon.bindTooltip(name, { sticky: true });
        polygon.on('click', () => callback.current(name));
        polygon.on('add', () => {
          const element = polygon.getElement();
          if (!element) return;
          element.setAttribute('tabindex', '0');
          element.setAttribute('role', 'button');
          element.setAttribute('aria-label', `Select ${name}`);
          element.addEventListener('keydown', event => {
            const keyEvent = event as KeyboardEvent;
            if (keyEvent.key === 'Enter' || keyEvent.key === ' ') {
              keyEvent.preventDefault();
              keyEvent.stopPropagation();
              callback.current(name);
            }
          });
        });
      },
    }).addTo(map);
    return () => { group.remove(); regionLayers.clear(); };
  }, [data, mapRef]);

  // Keep data refreshes separate from the camera: updating a budget never moves the map.
  useEffect(() => {
    const map = mapRef.current;
    const polygon = selected ? layers.current.get(selected) : undefined;
    if (!map || !polygon) return;
    map.stop().flyToBounds(polygon.getBounds(), {
      paddingTopLeft: [35, 90], paddingBottomRight: [35, 35], maxZoom: selected === 'NCR' ? 11 : 8,
      duration: 1.2, animate: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    });
  }, [selected, selectionVersion, data, mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const key = selected ? regionKey(selected) : area === 'All' ? null : area;
    const selectedBounds = L.latLngBounds([]);
    for (const [name, polygon] of layers.current) {
      const active = key !== null && regionMatchesSelection(name, key);
      const group = regionGroup(name);
      const color = group === 'Visayas' ? '#16a34a' : group === 'Mindanao' ? '#e11d48' : '#0284c7';
      polygon.setStyle({ color: active ? '#fff' : '#64748b', weight: active ? 3 : 1.2, fillColor: color, fillOpacity: active ? 0.8 : key ? 0.08 : 0.16 });
      const element = polygon.getElement();
      element?.classList.toggle('is-selected', active);
      element?.setAttribute('aria-pressed', String(active));
      if (active) {
        polygon.bringToFront();
        selectedBounds.extend(polygon.getBounds());
      }
    }
    if (!key || !selectedBounds.isValid()) return;
    const matches = budgets.filter(row => regionMatchesSelection(row.name, key, row.island));
    const share = matches.reduce((sum, row) => sum + row.sharePercent, 0);
    const amount = matches.reduce((sum, row) => sum + row.amount, 0);
    const card = document.createElement('div');
    card.className = 'dashboard-region-card';
    const title = document.createElement('strong');
    title.textContent = key;
    const figure = document.createElement('div');
    figure.className = 'dashboard-region-figure';
    figure.setAttribute('aria-label', `${share.toFixed(2)} percent of total national budget`);
    const caption = document.createElement('div');
    caption.textContent = matches.length ? 'of total national budget' : 'No budget records for this region';
    const detail = document.createElement('div');
    detail.className = 'dashboard-region-detail';
    detail.textContent = `₱${(amount / 1e9).toFixed(2)} B`;
    card.append(title, figure, caption, detail);
    const marker = L.marker(selectedBounds.getCenter(), {
      icon: L.divIcon({ html: card, className: 'dashboard-region-popup', iconSize: [220, 136], iconAnchor: [110, 150] }),
      interactive: false, keyboard: false, zIndexOffset: 1000,
    }).addTo(map);
    let frame = 0;
    const start = performance.now();
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const progress = reduced ? 1 : Math.min((now - start) / 1000, 1);
      figure.textContent = `${(share * (1 - Math.pow(1 - progress, 3))).toFixed(2)}%`;
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    tick(start);
    return () => { cancelAnimationFrame(frame); marker.remove(); };
  }, [selected, area, selectionVersion, budgets, data, mapRef]);

  return { boundaryError: error, retryBoundaries: () => setRetry(value => value + 1) };
}
