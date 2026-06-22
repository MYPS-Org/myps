import { useCallback, useEffect, useState, type RefObject } from 'react';
import maplibregl, { type GeoJSONSource, type MapLayerMouseEvent } from 'maplibre-gl';
import type { LayerVisibilityState, MapLayerDefinition, ProjectFeatureProperties } from './types';
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
  geoJsonData: GeoJSON.FeatureCollection | null | undefined,
  layers: MapLayerDefinition[]
): UseProjectMapLayersResult {
  const [visibility, setVisibility] = useState<LayerVisibilityState>(() =>
    Object.fromEntries(layers.map((layer) => [layer.id, true]))
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build the (empty) source + sublayers per bucket once the map's style has loaded.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isMapReady) return;

    const handleFeatureClick = (e: MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const properties = (feature.properties ?? {}) as ProjectFeatureProperties;
      new maplibregl.Popup().setLngLat(e.lngLat).setHTML(buildPopupHtml(properties)).addTo(map);
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
    });
  }, [mapRef, isMapReady, layers]);

  // Feed the grouped GeoJSON into each bucket's source whenever the data changes.
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

      const { bounds, centroid } = computeBoundsAndCentroid(geoJsonData);
      if (!bounds.isEmpty()) {
        map.fitBounds(bounds, { padding: 50, maxZoom: 15, duration: 1000 });
      } else {
        map.setCenter(centroid);
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error rendering GeoJSON:', err);
      setError('Failed to render map data');
      setIsLoading(false);
    }
  }, [mapRef, isMapReady, geoJsonData, layers]);

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
