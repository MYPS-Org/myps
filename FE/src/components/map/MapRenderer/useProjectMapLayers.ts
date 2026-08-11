import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import type { LayerVisibilityState, MapLayerDefinition, PopupFieldConfig, ProjectFeatureProperties } from './types';
import { buildPopupHtml, computeBoundsAndCentroid, groupFeaturesByLayer } from './geoJsonUtils';

export interface UseProjectMapLayersResult {
  visibility: LayerVisibilityState;
  toggleLayer: (id: string) => void;
  isLoading: boolean;
  error: string | null;
}

const sourceId = (layerId: string) => `source-${layerId}`;
const lineLayerId = (layerId: string) => `${layerId}-line`;
const fillLayerId = (layerId: string) => `${layerId}-fill`;
const outlineLayerId = (layerId: string) => `${layerId}-outline`;
const pointLayerId = (layerId: string) => `${layerId}-point`;
const sublayerIdsFor = (layerId: string) => [
  lineLayerId(layerId),
  fillLayerId(layerId),
  outlineLayerId(layerId),
  pointLayerId(layerId),
];

const emptyFeatureCollection = (): GeoJSON.FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export function useProjectMapLayers(
  mapRef: RefObject<maplibregl.Map | null>,
  isMapReady: boolean,
  styleGeneration: number,
  geoJsonData: GeoJSON.FeatureCollection | null | undefined,
  layers: MapLayerDefinition[],
  popupFields?: PopupFieldConfig[]
): UseProjectMapLayersResult {
  const [visibility, setVisibility] = useState<LayerVisibilityState>(() =>
    Object.fromEntries(layers.map((layer) => [layer.id, true]))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Switching basemaps replaces the whole style, wiping our sources/layers, so this
  // rebuilds the skeleton (and restores per-layer visibility) every time styleGeneration
  // changes, in addition to the initial isMapReady transition.
  const visibilityRef = useRef(visibility);
  useEffect(() => {
    visibilityRef.current = visibility;
  }, [visibility]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const handleFeatureClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const properties = (feature.properties ?? {}) as ProjectFeatureProperties;
      new maplibregl.Popup({ className: 'myps-map-popup' })
        .setLngLat(e.lngLat)
        .setHTML(buildPopupHtml(properties, popupFields))
        .addTo(map);
    };
    const handleMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    layers.forEach((layer) => {
      const srcId = sourceId(layer.id);
      if (!map.getSource(srcId)) {
        map.addSource(srcId, { type: 'geojson', data: emptyFeatureCollection() });
      }

      if (!map.getLayer(fillLayerId(layer.id))) {
        map.addLayer({
          id: fillLayerId(layer.id),
          type: 'fill',
          source: srcId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'fill-color': layer.color, 'fill-opacity': 0.3 },
        });
      }
      if (!map.getLayer(outlineLayerId(layer.id))) {
        map.addLayer({
          id: outlineLayerId(layer.id),
          type: 'line',
          source: srcId,
          filter: ['==', ['geometry-type'], 'Polygon'],
          paint: { 'line-color': layer.color, 'line-width': 2 },
        });
      }
      if (!map.getLayer(lineLayerId(layer.id))) {
        map.addLayer({
          id: lineLayerId(layer.id),
          type: 'line',
          source: srcId,
          filter: ['==', ['geometry-type'], 'LineString'],
          paint: { 'line-color': layer.color, 'line-width': 4 },
        });
      }
      if (!map.getLayer(pointLayerId(layer.id))) {
        map.addLayer({
          id: pointLayerId(layer.id),
          type: 'circle',
          source: srcId,
          filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
          paint: {
            'circle-color': layer.color,
            'circle-radius': 6,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#ffffff',
          },
        });
      }

      [lineLayerId(layer.id), fillLayerId(layer.id), pointLayerId(layer.id)].forEach((sublayerId) => {
        map.on('click', sublayerId, handleFeatureClick);
        map.on('mouseenter', sublayerId, handleMouseEnter);
        map.on('mouseleave', sublayerId, handleMouseLeave);
      });

      const layerVisible = visibilityRef.current[layer.id] ?? true;
      sublayerIdsFor(layer.id).forEach((sublayerId) => {
        if (map.getLayer(sublayerId)) {
          map.setLayoutProperty(sublayerId, 'visibility', layerVisible ? 'visible' : 'none');
        }
      });
    });

    return () => {
      layers.forEach((layer) => {
        [lineLayerId(layer.id), fillLayerId(layer.id), pointLayerId(layer.id)].forEach((sublayerId) => {
          map.off('click', sublayerId, handleFeatureClick);
          map.off('mouseenter', sublayerId, handleMouseEnter);
          map.off('mouseleave', sublayerId, handleMouseLeave);
        });
      });
    };
  }, [mapRef, isMapReady, styleGeneration, layers, popupFields]);

  // Feed the grouped GeoJSON into each bucket's source whenever the data changes, and
  // again whenever the style reloads (a basemap switch wipes source data back to empty).
  // Bounds are only (re)fit on an actual data change, so switching basemaps doesn't
  // jerk the camera back to the fitted view.
  const lastFitDataRef = useRef<GeoJSON.FeatureCollection | null | undefined>(undefined);
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    if (!geoJsonData) {
      setError(null);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const grouped = groupFeaturesByLayer(geoJsonData, layers);
      layers.forEach((layer) => {
        const source = map.getSource(sourceId(layer.id)) as GeoJSONSource | undefined;
        source?.setData(grouped[layer.id]);
      });

      if (lastFitDataRef.current !== geoJsonData) {
        lastFitDataRef.current = geoJsonData;
        const { bounds, centroid } = computeBoundsAndCentroid(geoJsonData);
        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
        } else {
          map.setCenter(centroid);
        }
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error rendering GeoJSON:', err);
      setError('Failed to render map data');
      setIsLoading(false);
    }
  }, [mapRef, isMapReady, styleGeneration, geoJsonData, layers]);

  const toggleLayer = useCallback(
    (id: string) => {
      const map = mapRef.current;
      if (!map) return;

      setVisibility((prev) => {
        const nextVisible = !prev[id];
        sublayerIdsFor(id).forEach((sublayerId) => {
          if (map.getLayer(sublayerId)) {
            map.setLayoutProperty(sublayerId, 'visibility', nextVisible ? 'visible' : 'none');
          }
        });
        return { ...prev, [id]: nextVisible };
      });
    },
    [mapRef]
  );

  return { visibility, toggleLayer, isLoading, error };
}
